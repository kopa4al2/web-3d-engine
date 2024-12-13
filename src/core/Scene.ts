import CameraComponent from "core/components/camera/CameraComponent";
import LightSource from "core/components/camera/LightSource";
import ProjectionMatrix from "core/components/camera/ProjectionMatrix";
import Mesh from 'core/components/Mesh';
import Transform, { ModelMatrix } from 'core/components/Transform';
import EntityManager, { EntityId } from "core/EntityManager";
import { PipelineId } from 'core/Graphics';
import BoundingSphere from 'core/physics/BoundingSphere';
import Frustum from 'core/physics/Frustum';
import { Blend } from 'core/resources/gpu/Blend';
import { mat4, vec3 } from 'gl-matrix';
import Bitmask from 'util/BitMask';
import DebugUtil from 'util/DebugUtil';
import JavaMap from 'util/JavaMap';


export default class Scene {
    public static readonly CHANGED = 0b001;

    public flags: Bitmask<number> = new Bitmask();

    // For each mesh a tuple with entity - transform
    private readonly meshes: JavaMap<PipelineId, JavaMap<Mesh, [EntityId, ModelMatrix][]>>;
    private readonly frustum: Frustum;

    private _frustumFn?: (frustum: Frustum) => Mesh;

    constructor(public camera: CameraComponent,
                public projectionMatrix: ProjectionMatrix,
                public lightSource: LightSource,
                private entityManager: EntityManager,
                private entities: EntityId[] = []) {
        DebugUtil.addToWindowObject('scene', this);
        this.flags.setFlag(Scene.CHANGED);
        this.meshes = new JavaMap();
        // this.meshes = new SortedMap<PipelineId, JavaMap<Mesh, [EntityId, ModelMatrix][]>>((m1:PipelineId, m2:PipelineId )=> 1);
        this.frustum = new Frustum();
    }

    public _setFrustumFn(frustumFn: (frustum: Frustum) => Mesh) {
        this._frustumFn = frustumFn;
    }

    public evalFrustumMesh() {
        return this._frustumFn!(this.frustum);
    }

    public addEntity(id: EntityId) {
        this.entities.push(id);
        this.sortEntities();
        this.flags.setFlag(Scene.CHANGED)
    }

    public addEntities(...ids: EntityId[]) {
        ids.forEach(e => this.entities.push(e));
        this.sortEntities();
        this.flags.setFlag(Scene.CHANGED)
    }

    public updateFrustum(viewProjectionMatrix: mat4) {
        this.frustum.update(viewProjectionMatrix);
    }

    public update() {
        if (!this.hasChanged()) {
            return;
        }
        // TODO: Do not clear every time
        // TODO: Handle spatial
        // TODO: Handle bounding box
        this.meshes.clear();
        const culled: Mesh[] = [];
        this.entities.forEach(entity => {
            const [transform, mesh] = this.entityManager.getComponents<Transform, Mesh>(entity, Transform.ID, Mesh.ID)
            if (transform && mesh) {
                const { pipelineId, geometry } = mesh;

                if (!this.frustum.isSphereWithinFrustum(geometry.getBoundingVolume(BoundingSphere), this.camera.viewMatrix())) {
                    // console.log('Frustum culling: ', mesh.pipelineId)
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

                entitiesByMesh.get(mesh).push([entity, transform.createModelMatrix()]);
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

    public hasChanged() {
        return true; // TODO Temporrary disabled to test
        // return this.flags.hasFlag(Scene.CHANGED);
    }

    private sortEntities() {
        // const blendModes: Record<BlendMode, number> = { 'none': 0, 'alpha': 1, 'additive': 2 };
        this.entities.sort((e1, e2) => {
            const [transform1, mesh1] = this.entityManager.getComponents<Transform, Mesh>(e1, Transform.ID, Mesh.ID);
            const [transform2, mesh2] = this.entityManager.getComponents<Transform, Mesh>(e2, Transform.ID, Mesh.ID);
            if (!mesh1 || !mesh2) {
                return -1;
            }
            const blendMode1 = mesh1.material.descriptor.properties.blendMode as Blend;
            const blendMode2 = mesh2.material.descriptor.properties.blendMode as Blend;

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
