import { DirectionalLightOld, PointLightOld } from 'core/components/camera/LightSource';
import Mesh from 'core/components/Mesh';
import Transform from 'core/components/Transform';
import EntityManager from "core/EntityManager";
import Frustum from 'core/physics/Frustum';
import ResourceManager from "core/resources/ResourceManager";
import { System } from "core/systems/EntityComponentSystem";
import { mat4, vec3, vec4 } from "gl-matrix";
import Graphics, { RenderPass } from "../../core/Graphics";
import BufferUtils from "../../util/BufferUtils";
import DirectionalLight from 'core/light/DirectionalLight';
import PointLight from 'core/light/PointLight';

/**
 * Knows of global buffers / textures (to bind them)
 * Knows of global buffer layout (calculates and writes data to it)
 * Has to bind all groups / vertex shaders
 */
export default class Renderer implements System {

    private projectionViewMatrix: mat4 = mat4.create();

    private toRender = {
        dirLights: [],
        pointLights: [],
    }

    constructor(private graphics: Graphics,
                private entityManager: EntityManager,
                private resourceManager: ResourceManager) {
    }

    public update(deltaTime: number): void {
        const scene = this.entityManager.scenes[0];
        scene.update();


        mat4.multiply(this.projectionViewMatrix, scene.projectionMatrix.get(), scene.camera.viewMatrix());
        // scene.updateFrustum(this.projectionViewMatrix);
        // this.toRender()
    }

    render(): void {
        const scene = this.entityManager.scenes[0];
        const { camera } = scene;
        const floatsPerDirLightStruct = 12;
        const floatsPerPointLightStruct = 12;
        const bytesForDirLight = Float32Array.BYTES_PER_ELEMENT * DirectionalLight.MAX_DIRECTION_LIGHTS * floatsPerDirLightStruct;
        const bytesForSpotLight = Float32Array.BYTES_PER_ELEMENT * PointLight.MAX_POINT_LIGHTS * floatsPerPointLightStruct;
        const bytesForMetadata = Uint32Array.BYTES_PER_ELEMENT * 2
        const bufferData = new ArrayBuffer(bytesForDirLight + bytesForSpotLight + bytesForMetadata);
        const dataView = new DataView(bufferData);
        let byteOffset = 0;

        const dirLights = this.entityManager.getComponentsWithId<DirectionalLight>(DirectionalLight.ID);

        if (dirLights.length > DirectionalLight.MAX_DIRECTION_LIGHTS) {
            throw new Error(`Too many directional lights. Max is ${DirectionalLight.MAX_DIRECTION_LIGHTS}, provided: ${dirLights.length}`);
        }
        if (dirLights.find(l => l.hasChanged)) {
            for (let i = 0; i < DirectionalLight.MAX_DIRECTION_LIGHTS; i++) {
                const dirLight = dirLights[i];
                if (dirLight) {
                    byteOffset = writeFloatArray(dataView, byteOffset, dirLight.direction.toArray());
                    byteOffset = writeFloatArray(dataView, byteOffset, dirLight.color.toArray());
                    byteOffset = writeFloatArray(dataView, byteOffset, [dirLight.intensity, 0, 0, 0]);
                    // dirLight.hasChanged = false;
                } else {
                    // padding
                    byteOffset = writeFloatArray(dataView, byteOffset, new Float32Array(floatsPerDirLightStruct));
                }
            }

        }
        if (byteOffset < bytesForDirLight) {
            console.warn("[DIRECTIONAL] Byte offset differs from expected. Expected: ", bytesForDirLight, " Actual: ", byteOffset, " Padding: ", bytesForDirLight - byteOffset);
        }
        const pointLights: [PointLight, Transform][] = [];
        for (const lightEntity of scene.getVisibleLights()) {
            const [pointLight, transform] = this.entityManager.getComponents<[PointLight, Transform]>(lightEntity, PointLight.ID, Transform.ID);

            if (pointLight) {
                pointLights.push([pointLight, transform]);
            }
        }


        if (pointLights.length > PointLight.MAX_POINT_LIGHTS) {
            throw new Error(`Too many point lights. Max is ${PointLight.MAX_POINT_LIGHTS}, provided: ${pointLights.length}`);
        }

        for (let i = 0; i < PointLight.MAX_POINT_LIGHTS; i++) {
            const pointLight = pointLights[i];
            if (pointLight) {
            // if (i < pointLights.length) {
                const [pointLight, transform] = pointLights[i];
                const position = vec4.transformMat4(vec4.create(), vec4.fromValues(...pointLight.position), transform.createModelMatrix());

                byteOffset = writeFloatArray(dataView, byteOffset, position);
                byteOffset = writeFloatArray(dataView, byteOffset, pointLight.color.toArray());
                // byteOffset = writeFloatArray(dataView, byteOffset, [pointLight.intensity, pointLight.constant, pointLight.linear, pointLight.quadratic]);
                byteOffset = writeFloatArray(dataView, byteOffset, [pointLight.intensity, pointLight.constantAttenuation, pointLight.linearAttenuation, pointLight.quadraticAttenuation]);
            } else {
                // padding
                byteOffset = writeFloatArray(dataView, byteOffset, new Float32Array(floatsPerPointLightStruct));
            }
        }

        if (byteOffset < bytesForDirLight + bytesForSpotLight) {
            console.warn(`[POINT] byte offset: ${byteOffset} does not match expected: ${bytesForDirLight + bytesForSpotLight}`);
        }

        dataView.setUint32(byteOffset, dirLights.length, true);
        dataView.setUint32(byteOffset + 4, pointLights.length, true);

        if (!camera) {
            console.error('No camera present in the scene. Will not attempt render anything');
            return;
        }
        const entitiesToRender = scene.getVisibleEntities();

        const viewMatrix = scene.camera.viewMatrix();
        const projectionMatrix = scene.projectionMatrix;
        const data = BufferUtils.mergeFloat32Arrays([
            this.projectionViewMatrix as Float32Array,
            projectionMatrix.get(),
            viewMatrix,
            new Float32Array([...camera.position, 1]),
            new Float32Array([...camera.forward, 1]), // TODO: This may not be correct
            new Float32Array([...camera.up, 1]), // TODO: This may not be correct
            new Float32Array([projectionMatrix.zNear, projectionMatrix.zFar, projectionMatrix.fov, projectionMatrix.aspectRatio]),
        ]);
        // console.log(data.byteLength)
        this.resourceManager.bufferManager.writeToGlobalBuffer('Camera', data);
        this.resourceManager.bufferManager.writeToGlobalBuffer('Light', new Uint8Array(bufferData));
        // FAKE DATA
        this.resourceManager.bufferManager.writeToGlobalBuffer('Time', new Float32Array([1.0, 1.0, 1.0, 1.0]));

        const renderPass = this.graphics.beginRenderPass();

        renderPass.setBindGroup(0, this.resourceManager.globalBindGroup);

        for (const [pipeline, meshes] of entitiesToRender) {
            renderPass.usePipeline(pipeline);

            // rateLimitedLog.logMax(entitiesToRender.size, `Using pipeline: ${pipeline.toString()} for ${meshes.size} meshes`);
            for (const [mesh, entities] of meshes) {
                renderPass.setVertexBuffer(0, mesh.geometry.vertexBuffer);
                mesh.setBindGroup(this.graphics, renderPass);
                if (!mesh.instanceBuffers) {
                    renderPass.drawIndexed(mesh.geometry.indexBuffer, mesh.geometry.indices);
                    continue;
                }

                const { bufferId, bindGroupId } = mesh.instanceBuffers[0];
                renderPass.setBindGroup(2, bindGroupId);

                for (let index = 0; index < entities.length; index++) {
                    const [_, transform] = entities[index];
                    this.graphics.writeToBuffer(
                        bufferId,
                        transform as Float32Array,
                        index * ( 64 + 64 )
                    );
                    const modelInverseTranspose = mat4.create();
                    mat4.invert(modelInverseTranspose, transform);
                    mat4.transpose(modelInverseTranspose, modelInverseTranspose);

                    this.graphics.writeToBuffer(
                        bufferId,
                        modelInverseTranspose as Float32Array,
                        index * 128 + 64
                    );
                }

                // rateLimitedLog.logMax(meshes.size, `Batching instanced draw for ${entities.length} instances`);
                renderPass.drawInstanced(mesh.geometry.indexBuffer, mesh.geometry.indices, entities.length);
            }
        }
        // this.renderFrustum(renderPass);

        renderPass.submit();
    }

    private extracted(byteOffset: number, dataView: DataView<ArrayBuffer>, floatsPerDirLightStruct: number, bytesForDirLight: number) {

    }

    private renderFrustum(renderPass: RenderPass) {
        const frustumEntities = this.entityManager.getEntitiesHavingAll(Frustum.ID, Mesh.ID);
        frustumEntities.forEach(frustum => {
            const mesh = this.entityManager.getComponent<Mesh>(frustum, Mesh.ID);
            renderPass.usePipeline(mesh.pipelineId)
            renderPass.setVertexBuffer(0, mesh.geometry.vertexBuffer);
            // this.graphics.writeToBuffer(mesh.geometry.vertexBuffer, new Float32Array([
            //     // Near plane
            //     -0.1, -0.1, 0.1,  // Near bottom-left
            //     0.1, -0.1, 0.1,  // Near bottom-right
            //     0.1, 0.1, 0.1,  // Near top-right
            //     -0.1, 0.1, 0.1,  // Near top-left
            //
            //     // Far plane
            //     -1000, -1000, -1000, // Far bottom-left
            //     1000, -1000, -1000, // Far bottom-right
            //     1000, 1000, -1000, // Far top-right
            //     -1000, 1000, -1000  // Far top-left
            // ]))
            renderPass.drawSimple(8);
            // renderPass.drawIndexed(mesh.geometry.indexBuffer, mesh.geometry.indices);
        });
    }

    private mockPointLights(): PointLightOld[] {
        return [
            // {
            //     position: [25.0, 25.0, 10.0, 1.0],  // Above the object
            //     color: [0.0, 0.0, 1.0, 1.0],   // White light
            //     intensity: 3.0,                // Bright
            //     constant: 1.0,                 // Baseline attenuation
            //     linear: 0.05,                  // Slow linear falloff
            //     quadratic: 0.01                // Realistic quadratic falloff
            // },
            // {
            //     position: [20.0, 10.0, 10.0, 1.0],  // Far light
            //     color: [1.0, 0.0, 1.0, 1.0],        // Red light
            //     intensity: 2.5,                     // Moderate
            //     constant: 1.0,
            //     linear: 0.1,
            //     quadratic: 0.02
            // },
            // {
            //     position: [-30.0, 20.0, 0.0, 1.0],   // Nearby light
            //     color: [1.0, 1.0, 0.0, 1.0],        // Blue light
            //     intensity: 1.0,                     // Bright spotlight
            //     constant: 1.0,
            //     linear: 0.005,
            //     quadratic: 0.005
            // }
        ];
    }

    private mockDirectedLights(): DirectionalLightOld[] {
        return [
            {
                direction: [-10.0, -5.0, 1.0, 1.0],  // Light coming diagonally from above
                color: [1.0, 1.0, 1.0, 1.0],         // White light
                intensity: 1.0                  // Brightness multiplier (acts like scaling)
            },
            // {
            //     direction: [-5.0, -15.0, 0.0, -5.0],  // Light coming diagonally from above
            //     color: [1.0, 1.0, 1.0, 1.0],         // White light
            //     intensity: 1.0                  // Brightness multiplier (acts like scaling)
            // },
            {
                direction: [5.0, -1.0, 0.0, 1.0],    // Light coming from the horizon
                color: [1.0, 0.8, 0.6, 1.0],         // Warm orange tone
                intensity: 0.6                 // Softer light for a sunset effect
            }
        ];
    }
}

function getFrustumCorners(viewProjectionMatrix: mat4) {
    const invVP = mat4.invert(mat4.create(), viewProjectionMatrix);
    const clipCorners = [
        [-1, 1, -1, 1], // Near Top Left
        [1, 1, -1, 1], // Near Top Right
        [-1, -1, -1, 1], // Near Bottom Left
        [1, -1, -1, 1], // Near Bottom Right
        [-1, 1, 1, 1], // Far Top Left
        [1, 1, 1, 1], // Far Top Right
        [-1, -1, 1, 1], // Far Bottom Left
        [1, -1, 1, 1], // Far Bottom Right
    ];

    // Transform from clip space to world space
    return clipCorners.map(corner => {
        const worldCorner = vec4.transformMat4(vec4.create(), corner as vec4, invVP);
        return vec3.fromValues(
            worldCorner[0] / worldCorner[3],
            worldCorner[1] / worldCorner[3],
            worldCorner[2] / worldCorner[3]
        );
    });
}


function writeFloatArray(dataView: DataView, byteOffset: number, array: number[] | Float32Array<any>): number {
    for (let i = 0; i < array.length; i++) {
        dataView.setFloat32(byteOffset, array[i], true);
        byteOffset += Float32Array.BYTES_PER_ELEMENT;
    }

    return byteOffset;
}
