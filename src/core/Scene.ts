import CameraComponent from "core/components/camera/CameraComponent";
import ProjectionMatrix from "core/components/camera/ProjectionMatrix";
import Mesh from 'core/components/Mesh';
import OrderComponent from "core/components/OrderComponent";
import Transform, { ModelMatrix } from 'core/components/Transform';
import EntityManager, { EntityId } from "core/EntityManager";
import { PipelineId } from 'core/Graphics';
import PointLight from 'core/light/PointLight';
import SpotLight from "core/light/SpotLight";
import BoundingSphere from 'core/physics/BoundingSphere';
import Frustum from 'core/physics/Frustum';
import { Blend } from 'core/resources/gpu/Blend';
import { mat4, vec3 } from 'gl-matrix';
import Bitmask from 'util/BitMask';
import DebugUtil from 'util/DebugUtil';
import JavaMap from 'util/JavaMap';


export default class Scene {
    public static readonly DEFAULT = 0b000;
    public static readonly ENTITY_ADDED = 0b001;
    public static readonly CHANGED = 0b010;

    public flags: Bitmask<number> = new Bitmask();

    // For each mesh a tuple with entity - transform
    private readonly meshes: JavaMap<PipelineId, JavaMap<Mesh, [EntityId, ModelMatrix][]>>;
    private readonly frustum: Frustum;
    private lights: EntityId[];


    constructor(public camera: CameraComponent,
                public projectionMatrix: ProjectionMatrix,
                private entityManager: EntityManager,
                private entities: EntityId[] = []) {
        DebugUtil.addToWindowObject('scene', this);
        this.flags.setFlag(Scene.CHANGED);
        this.meshes = new JavaMap();
        this.frustum = new Frustum();
        this.lights = [];
    }

    public setSkyBox(skyBox: Mesh): void {
        if (!this.meshes.has(skyBox.pipelineId)) {
            this.meshes.set(skyBox.pipelineId, new JavaMap());
        }
        this.meshes.get(skyBox.pipelineId).set(skyBox, []);
    }

    public addEntity(id: EntityId) {
        this.entities.push(id);
        this.flags.setFlag(Scene.CHANGED);
        this.flags.setFlag(Scene.ENTITY_ADDED);
    }

    public addEntities(...ids: EntityId[]) {
        ids.forEach(e => this.entities.push(e));
        this.flags.setFlag(Scene.CHANGED);
        this.flags.setFlag(Scene.ENTITY_ADDED);
    }

    public updateFrustum(viewProjectionMatrix: mat4) {
        this.frustum.update(viewProjectionMatrix);
    }

    public update() {
        // if (this.flags.hasFlag(Scene.ENTITY_ADDED)) {
        //     this.sortEntities()
        //     this.flags.toggleFlag(Scene.ENTITY_ADDED);
        // }

        // if (this.flags.hasFlag(Scene.CHANGED)) {
        //     this.flags.toggleFlag(Scene.CHANGED);
        //     this.updateMeshes();
        // }

        this.sortEntities();
        this.updateMeshes();
    }

    private updateMeshes() {
        this.lights = [];
        this.meshes.clear();
        const culled: Mesh[] = [];
        this.entities.forEach(entity => {
            if (this.entityManager.hasAnyComponent(entity, PointLight.ID, SpotLight.ID)) {
                this.lights.push(entity);
                return;
            }
            const [transform, mesh] = this.entityManager.getComponents<[Transform, Mesh]>(entity, Transform.ID, Mesh.ID);

            if (mesh) {
                const { pipelineId, geometry } = mesh;

                if (!this.frustum.isSphereWithinFrustum(geometry.getBoundingVolume(BoundingSphere), this.camera.viewMatrix())) {
                    console.warn('Frustum culling: ', mesh.pipelineId)
                    culled.push(mesh);
                    return;
                }

                if (!this.meshes.has(pipelineId)) {
                    this.meshes.set(pipelineId, new JavaMap<Mesh, [EntityId, ModelMatrix][]>());
                }

                const entitiesByMesh = this.meshes.get(pipelineId);
                if (!entitiesByMesh.has(mesh)) {
                    entitiesByMesh.set(mesh, []);
                }

                entitiesByMesh.get(mesh).push([entity, transform ? transform.getWorldMatrix() : mat4.create()]);
            }
        });
        this.flags.clearFlag(Scene.CHANGED);
        if (culled.length > 0) {
            // rateLimitedLog.log('Culled entities: ', culled);
            // console.log('Culled entities: ', culled);
        }
    }

    public getEntities(): EntityId[] {
        return this.entities;
    }

    public getVisibleEntities(): JavaMap<PipelineId, JavaMap<Mesh, [EntityId, ModelMatrix][]>> {
        return this.meshes;
    }

    public getVisibleLights() {
        return this.lights;
    }

    private sortEntities() {
        this.entities.sort((e1, e2) => {
            const [transform1, mesh1, order1] = this.entityManager.getComponents<[Transform, Mesh, OrderComponent]>(e1, Transform.ID, Mesh.ID, OrderComponent.ID);
            const [transform2, mesh2, order2] = this.entityManager.getComponents<[Transform, Mesh, OrderComponent]>(e2, Transform.ID, Mesh.ID, OrderComponent.ID);

            if (order1 || order2) {
                return (order2?.order || -1) - (order1?.order || -1);
            }

            if (!mesh1 || !mesh2) {
                return -1;
            }

            const blendMode1 = mesh1.material.descriptor.properties.colorAttachment?.blendMode as Blend;
            const blendMode2 = mesh2.material.descriptor.properties.colorAttachment?.blendMode as Blend;

            // Sort by blend mode first
            if (blendMode1 !== blendMode2) {
                return this.compareBlendModes(blendMode1, blendMode2);
            }


            // If both are transparent (same blend mode), sort by distance from camera
            if (this.simplifyBlend(blendMode1) !== 'none') {
                // Only apply distance sorting to transparent entities
                const pos1 = transform1.position;
                const pos2 = transform2.position;

                const dist1 = Math.hypot(
                    pos1[0] - this.camera.position[0],
                    pos1[1] - this.camera.position[1],
                    pos1[2] - this.camera.position[2]
                );

                const dist2 = Math.hypot(
                    pos2[0] - this.camera.position[0],
                    pos2[1] - this.camera.position[1],
                    pos2[2] - this.camera.position[2]
                );

                // Sort back-to-front for transparency
                return dist2 - dist1;
            }

            // Equal blend modes and opaque, no further sorting needed
            return 0;
        })
    }

    // Helper for sorting based on blend mode
    blendModeOrder = {
        'none': 0,      // No blending, treated as opaque
        'alpha': 1,     // Standard alpha blending, rendered after opaque
        'additive': 2   // Additive blending, rendered last
    };

    private compareBlendModes(bl1?: Blend, bl2?: Blend) {
        const blend1 = this.simplifyBlend(bl1);

        const blend2 = this.simplifyBlend(bl2);

        return this.blendModeOrder[blend1] - this.blendModeOrder[blend2];
    }

    private simplifyBlend(blend: Blend | undefined) {
        if (!blend || !blend.color) {
            return 'none';
        }

        return blend.color.srcFactor === 'src-alpha' && blend.color.dstFactor === 'one-minus-src-alpha'
            ? 'alpha'
            : blend.color.dstFactor === 'one' ? 'additive' : 'none';
    }
}


// export function isSphereInFrustum(planes: Frustum, center: vec3, radius: number) {
//     for (const plane of [planes.left, planes.right, planes.bottom, planes.top, planes.near, planes.far]) {
//         // Calculate the signed distance from the center of the sphere to the plane
//         const distance = plane[0] * center[0] + plane[1] * center[1] + plane[2] * center[2] + plane[3];
//         if (distance < -radius) {
//             return false; // Sphere is completely outside this plane
//         }
//     }
//     return true; // Sphere is within or intersecting the frustum
// }


function transformBoundingSphere(center: vec3, radius: number, modelMatrix: mat4) {
    const transformedCenter = vec3.transformMat4(vec3.create(), center, modelMatrix);

    // Calculate approximate scale from model matrix for non-uniform scale
    const scaleX = vec3.length([modelMatrix[0], modelMatrix[1], modelMatrix[2]]);
    const scaleY = vec3.length([modelMatrix[4], modelMatrix[5], modelMatrix[6]]);
    const scaleZ = vec3.length([modelMatrix[8], modelMatrix[9], modelMatrix[10]]);
    const scale = Math.max(scaleX, scaleY, scaleZ);

    const transformedRadius = radius * scale;

    return { transformedCenter, transformedRadius };
}
