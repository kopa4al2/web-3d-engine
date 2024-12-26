import Component from "core/components/Component";
import Mesh from 'core/components/Mesh';
import Transform from 'core/components/Transform';
import EntityManager, { EntityId } from "core/EntityManager";
import DirectionalLight from 'core/light/DirectionalLight';
import PointLight from 'core/light/PointLight';
import spotLight from "core/light/SpotLight";
import SpotLight from "core/light/SpotLight";
import Frustum from 'core/physics/Frustum';
import { BufferId, BufferUsage } from "core/resources/gpu/BufferDescription";
import { UniformVisibility } from "core/resources/gpu/GpuShaderData";
import ResourceManager from "core/resources/ResourceManager";
import { createStruct } from "core/resources/shader/DefaultBindGroupLayouts";
import ShaderManager from "core/resources/shader/ShaderManager";
import Scene from "core/Scene";
import { System } from "core/systems/EntityComponentSystem";
import { TextureId, TextureType, TextureUsage } from "core/texture/Texture";
import { mat4, quat, vec3, vec4 } from "gl-matrix";
import Graphics, { BindGroupId, PipelineId, RenderPass } from "../../core/Graphics";
import BufferUtils from "../../util/BufferUtils";
import DebugCanvas from "../../util/DebugCanvas";
import JavaMap from "../../util/JavaMap";
import { rateLimitedLog } from "../../util/Logger";
import ThrottleUtil from "../../util/ThrottleUtil";
import Globals from '../../engine/Globals';

/**
 * Knows of global buffers / textures (to bind them)
 * Knows of global buffer layout (calculates and writes data to it)
 * Has to bind all groups / vertex shaders
 */
export default class Renderer implements System {

    private projectionViewMatrix: mat4 = mat4.create();

    private readonly shadowPassPipeline: PipelineId;
    private readonly shadowPassGlobalBuffer: BufferId;
    private readonly shadowPassModelBuffer: BufferId;
    private readonly shadowPassBindGroup: BindGroupId;
    private readonly lights: WeakMap<Component, { texture: TextureId, layer: number }> = new WeakMap();


    constructor(private graphics: Graphics,
                private entityManager: EntityManager,
                private resourceManager: ResourceManager,
                private shaderManager: ShaderManager) {
        const bufferLength = 256;
        const mat4ByteLength = 16 * Float32Array.BYTES_PER_ELEMENT;
        const shadowPassGlobal = createStruct('shadow-pass-global', 'uniform', 0, UniformVisibility.VERTEX, mat4ByteLength);
        const shadowPassModel = createStruct('shadow-pass-model', 'uniform', 1, UniformVisibility.VERTEX, mat4ByteLength);
        const layout = this.resourceManager.getOrCreateLayout({
            label: 'ShadowPass',
            entries: [shadowPassGlobal, shadowPassModel]
        })
        const modelBuffer = this.resourceManager.createBuffer({
            byteLength: mat4ByteLength,
            label: 'ShadowPassModelBuffer',
            usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
        });
        const globalBuffer = this.resourceManager.createBuffer({
            byteLength: bufferLength,
            label: 'ShadowGlobalBuffer',
            usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
        })

        const bindGroup = this.resourceManager.createBindGroup(layout, {
            label: 'ShadowPassGlobalBindGroup',
            entries: [{ ...shadowPassGlobal, bufferId: globalBuffer }, { ...shadowPassModel, bufferId: modelBuffer }]
        });

        this.shadowPassGlobalBuffer = globalBuffer;
        this.shadowPassModelBuffer = modelBuffer;
        this.shadowPassBindGroup = bindGroup;
        this.shadowPassPipeline = this.shaderManager.createShadowPass(layout);
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
        const floatsPerSpotLightStruct = 20; // 18 floats + 2 padding
        const bytesForDirLight = Float32Array.BYTES_PER_ELEMENT * DirectionalLight.MAX_DIRECTION_LIGHTS * floatsPerDirLightStruct;
        const bytesForPointLights = Float32Array.BYTES_PER_ELEMENT * PointLight.MAX_POINT_LIGHTS * floatsPerPointLightStruct;
        const bytesForSpotLights = Float32Array.BYTES_PER_ELEMENT * SpotLight.MAX_SPOT_LIGHTS * floatsPerSpotLightStruct;
        const bytesForMetadata = Uint32Array.BYTES_PER_ELEMENT * 3;
        const bufferData = new ArrayBuffer(bytesForDirLight + bytesForPointLights + bytesForSpotLights + bytesForMetadata);
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
        const spotLights: [SpotLight, Transform][] = [];
        for (const lightEntity of scene.getVisibleLights()) {
            const [pointLight, spotLight, transform] = this.entityManager
                .getComponents<[PointLight, SpotLight, Transform]>(lightEntity, PointLight.ID, SpotLight.ID, Transform.ID);

            if (pointLight) {
                pointLights.push([pointLight, transform]);
            }
            if (spotLight) {
                spotLights.push([spotLight, transform]);
            }
        }


        if (pointLights.length > PointLight.MAX_POINT_LIGHTS) {
            throw new Error(`Too many point lights. Max is ${PointLight.MAX_POINT_LIGHTS}, provided: ${pointLights.length}`);
        }

        for (let i = 0; i < PointLight.MAX_POINT_LIGHTS; i++) {
            const pointLightTuple = pointLights[i];
            if (pointLightTuple) {
                // if (i < pointLights.length) {
                const [pointLight, transform] = pointLightTuple;
                const { x, y, z } = pointLight.position.xyz;
                const position = vec4.transformMat4(vec4.create(), vec4.fromValues(x, y, z, 1.0), transform.getWorldMatrix());

                byteOffset = writeFloatArray(dataView, byteOffset, position);
                byteOffset = writeFloatArray(dataView, byteOffset, pointLight.color.toArray());
                // byteOffset = writeFloatArray(dataView, byteOffset, [pointLight.intensity, pointLight.constant, pointLight.linear, pointLight.quadratic]);
                byteOffset = writeFloatArray(dataView, byteOffset, [pointLight.intensity, pointLight.constantAttenuation, pointLight.linearAttenuation, pointLight.quadraticAttenuation]);
            } else {
                // padding
                byteOffset = writeFloatArray(dataView, byteOffset, new Float32Array(floatsPerPointLightStruct));
            }
        }

        if (spotLights.length > SpotLight.MAX_SPOT_LIGHTS) {
            throw new Error(`Too many point lights. Max is ${SpotLight.MAX_SPOT_LIGHTS}, provided: ${spotLights.length}`);
        }

        for (let i = 0; i < SpotLight.MAX_SPOT_LIGHTS; i++) {
            const spotLightTuple = spotLights[i];
            if (spotLightTuple) {
                const [spotLight, transform] = spotLightTuple;

                const direction = vec4.transformQuat(vec4.create(), vec4.fromValues(0, 0, -1.0, 0.0), transform.worldTransform.rotation);
                vec4.normalize(direction, direction);

                byteOffset = writeFloatArray(dataView, byteOffset, transform.worldTransform.position, 1);
                byteOffset = writeFloatArray(dataView, byteOffset, direction);
                byteOffset = writeFloatArray(dataView, byteOffset, spotLight.color);
                byteOffset = writeFloatArray(dataView, byteOffset,
                    [spotLight.data.innerCutoff, spotLight.data.outerCutoff, spotLight.intensity,
                        spotLight.constantAttenuation, spotLight.linearAttenuation, spotLight.quadraticAttenuation,
                        1, 1]);
            } else {
                // padding
                byteOffset = writeFloatArray(dataView, byteOffset, new Float32Array(floatsPerSpotLightStruct));
            }
        }

        if (byteOffset !== bytesForDirLight + bytesForPointLights + bytesForSpotLights) {
            console.warn(`[SPOT LIGHT] byte offset: ${byteOffset} does not match expected: ${bytesForDirLight + bytesForPointLights}`);
        }

        dataView.setUint32(byteOffset, dirLights.length, true);
        dataView.setUint32(byteOffset + 4, pointLights.length, true);
        dataView.setUint32(byteOffset + 8, spotLights.length, true);

        if (!camera) {
            console.error('No camera present in the scene. Will not attempt render anything');
            return;
        }
        const entitiesToRender = scene.getVisibleEntities();

        const lightViewProjMatrices: mat4[] = Array(Globals.MAX_SHADOW_CASTING_LIGHTS).fill(mat4.create());

        for (let i = 0; i < Globals.MAX_SHADOW_CASTING_LIGHTS; i++) {
            if (spotLights[i]) {
                const [spotLight, transform] = spotLights[i];

                if (!this.lights.has(spotLight)) {
                    this.lights.set(spotLight, {
                        texture: this.resourceManager.textureManager.getShadowMap(),
                        layer: this.resourceManager.textureManager.getShadowMapLayer()
                    });
                }

                const shadowPass = this.graphics.beginRenderPass({
                    label: `shadow-pass-${spotLight.id.description}`,
                    depthAttachment: {
                        textureId: this.lights.get(spotLight)!.texture,
                        textureView: {
                            baseArrayLayer: this.lights.get(spotLight)!.layer,
                            aspect: 'depth-only',
                            dimension: '2d'
                        }
                    },
                    colorAttachment: { skip: true },
                    viewport: {
                        x: 0, y: 0,
                        width: Globals.SHADOW_PASS_TEXTURE_SIZE,
                        height: Globals.SHADOW_PASS_TEXTURE_SIZE
                    }
                });
                shadowPass.usePipeline(this.shadowPassPipeline);
                shadowPass.setBindGroup(0, this.shadowPassBindGroup);


                const SHADOW_MAP_ASPECT_RATIO = Globals.SHADOW_PASS_TEXTURE_SIZE / Globals.SHADOW_PASS_TEXTURE_SIZE;
                const SHADOW_MAP_Z_NEAR = 0.1;
                const SHADOW_MAP_Z_FAR = 100.0;
                const SHADOW_MAP_FOV = Math.PI / 4;
                const projectionMatrix = mat4.perspectiveZO(mat4.create(), SHADOW_MAP_FOV, SHADOW_MAP_ASPECT_RATIO, SHADOW_MAP_Z_NEAR, SHADOW_MAP_Z_FAR);

                const position = transform.worldTransform.position;
                const direction = vec3.transformQuat(
                    vec3.create(),
                    vec3.fromValues(0, 0, -1.0),
                    transform.worldTransform.rotation);
                vec3.normalize(direction, direction);
                const target = vec3.add(vec3.create(), position, direction);
                const up = vec3.fromValues(0, 1, 0);
                const lightViewMatrix = mat4.targetTo(mat4.create(), position, target, up);

                const viewMat = mat4.create();

                const rotationMatrix = mat4.create();
                mat4.fromQuat(rotationMatrix, transform.worldTransform.rotation);
                mat4.transpose(rotationMatrix, rotationMatrix);
                const translationMatrix = mat4.create();
                // mat4.fromTranslation(translationMatrix, vec3.negate(vec3.create(), transform.worldTransform.position));
                mat4.fromTranslation(translationMatrix, vec3.negate(transform.worldTransform.position, transform.worldTransform.position));
                mat4.multiply(viewMat, rotationMatrix, translationMatrix);
                const lightProjViewMatrix = mat4.multiply(mat4.create(), projectionMatrix, lightViewMatrix);
                lightViewProjMatrices[i] = lightProjViewMatrix;
                this.graphics.writeToBuffer(this.shadowPassGlobalBuffer, lightProjViewMatrix as Float32Array);
                for (const [pipeline, meshes] of scene.getVisibleEntities()) {
                    for (const [mesh, entities] of meshes) {
                        shadowPass.setVertexBuffer(0, mesh.geometry.vertexBuffer);
                        for (let index = 0; index < entities.length; index++) {
                            const [_, transform] = entities[index];
                            this.graphics.writeToBuffer(this.shadowPassModelBuffer, transform as Float32Array);
                            shadowPass.drawIndexed(mesh.geometry.indexBuffer, mesh.geometry.indices);
                        }
                    }
                }
                shadowPass.submit();
                if (i <= 0) {
                    this.graphics._getTextureData!(this.lights.get(spotLight)!.texture)
                        .then(data => DebugCanvas.visualizeDepth(data, Globals.SHADOW_PASS_TEXTURE_SIZE, Globals.SHADOW_PASS_TEXTURE_SIZE));
                }
            }
        }

        const viewMatrix = scene.camera.viewMatrix();
        const projectionMatrix = scene.projectionMatrix;
        const data = BufferUtils.mergeFloat32Arrays([
            this.projectionViewMatrix as Float32Array,
            projectionMatrix.get(),
            viewMatrix,
            lightViewProjMatrices[0],
            lightViewProjMatrices[1],
            new Float32Array([...camera.position, 1]),
            new Float32Array([...camera.forward, 1]), // TODO: This may not be correct
            new Float32Array([...camera.up, 1]), // TODO: This may not be correct
            new Float32Array([projectionMatrix.zNear, projectionMatrix.zFar, projectionMatrix.fov, projectionMatrix.aspectRatio]),
        ]);

        this.resourceManager.bufferManager.writeToGlobalBuffer('Camera', data);
        this.resourceManager.bufferManager.writeToGlobalBuffer('Light', new Uint8Array(bufferData));
        // FAKE DATA
        this.resourceManager.bufferManager.writeToGlobalBuffer('Time', new Float32Array([1.0, 1.0, 1.0, 1.0]));


        const renderPass = this.graphics.beginRenderPass();

        renderPass.setBindGroup(0, this.resourceManager.globalBindGroup);

        for (const [pipeline, meshes] of entitiesToRender) {
            renderPass.usePipeline(pipeline);

            // TODO: Try to render instanced - multiple values share the same instance buffer but are rendered separately
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
                        index * (64 + 64)
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

    private drawShadowPass(scene: Scene) {
        // const dirLights = this.entityManager.getComponentsWithId<DirectionalLight>(DirectionalLight.ID);
        // if (dirLights.length <= 0) {
        //     return;
        // }

        // const spotLights = scene.getVisibleLights()
        //     .map(lightEntity => this.entityManager.getComponents<[SpotLight, Transform]>(lightEntity, SpotLight.ID, Transform.ID))
        //     .filter(spotLights => spotLights && spotLights[0] && spotLights[1]);
        //
        // if (!spotLights || spotLights.length === 0) {
        //     return;
        // }

        // for (const [spotLight, transform] of spotLights) {
        //     if (!this.lights.has(spotLight)) {
        //         this.lights.set(spotLight, {
        //             texture: this.resourceManager.textureManager.getShadowMap(),
        //             layer: this.resourceManager.textureManager.getShadowMapLayer()
        //         });
        //     }

        // const shadowPass = this.graphics.beginRenderPass({
        //     label: `shadow-pass-${spotLight.id.description}`,
        //     depthAttachment: {
        //         textureId: this.lights.get(spotLight)!.texture,
        //         textureView: {
        //             baseArrayLayer: this.lights.get(spotLight)!.layer,
        //             aspect: 'depth-only',
        //             dimension: '2d'
        //         }
        //     },
        //     colorAttachment: { skip: true },
        //     viewport: { x: 0, y: 0, width: Globals.SHADOW_PASS_TEXTURE_SIZE, height: Globals.SHADOW_PASS_TEXTURE_SIZE }
        // });
        // shadowPass.usePipeline(this.shadowPassPipeline);
        // shadowPass.setBindGroup(0, this.shadowPassBindGroup);
        //
        //
        // const projectionMatrix = mat4.perspectiveZO(mat4.create(),
        //     Math.PI / 4,
        //     1,
        //     0.1,
        //     100.0);
        // const position = transform.worldTransform.position;
        // const direction = vec3.transformQuat(vec3.create(), vec3.fromValues(0, 0, -1.0), transform.worldTransform.rotation);
        // vec3.normalize(direction, direction);
        // const target = vec3.add(vec3.create(), position, direction);
        // const up = vec3.fromValues(0, 1, 0);
        // const lightViewMatrix = mat4.targetTo(mat4.create(), position, target, up);
        //
        // const viewMat = mat4.create();
        //
        // const rotationMatrix = mat4.create();
        // mat4.fromQuat(rotationMatrix, transform.worldTransform.rotation);
        //
        // mat4.transpose(rotationMatrix, rotationMatrix);
        //
        // const translationMatrix = mat4.create();
        // // mat4.fromTranslation(translationMatrix, this.position);
        // mat4.fromTranslation(translationMatrix, vec3.negate(vec3.create(), transform.worldTransform.position));
        //
        // // Combine rotation and translation to get the view matrix
        // mat4.multiply(viewMat, rotationMatrix, translationMatrix);
        //
        // // const lightProjViewMatrix = this.projectionViewMatrix;
        // const lightProjViewMatrix = mat4.multiply(mat4.create(), projectionMatrix, lightViewMatrix);
        // this.graphics.writeToBuffer(this.shadowPassGlobalBuffer, lightProjViewMatrix as Float32Array);
        // for (const [pipeline, meshes] of scene.getVisibleEntities()) {
        //     for (const [mesh, entities] of meshes) {
        //         shadowPass.setVertexBuffer(0, mesh.geometry.vertexBuffer);
        //         // mesh.setBindGroup(this.graphics, renderPass);
        //         for (let index = 0; index < entities.length; index++) {
        //             const [_, transform] = entities[index];
        //             this.graphics.writeToBuffer(this.shadowPassModelBuffer, transform as Float32Array);
        //             shadowPass.drawIndexed(mesh.geometry.indexBuffer, mesh.geometry.indices);
        //         }
        //     }
        // }
        // // for (const meshData of scene.getVisibleEntities().values()) {
        // //     for (const mesh of meshData.keys()) {
        // //         this.graphics.writeToBuffer(this.shadowPassModelBuffer, mat4.create() as Float32Array);
        // //         // this.graphics.writeToBuffer(this.shadowPassModelBuffer, mesh.transform.getWorldMatrix() as Float32Array);
        // //         shadowPass.setVertexBuffer(0, mesh.geometry.vertexBuffer);
        // //         shadowPass.drawIndexed(mesh.geometry.indexBuffer, mesh.geometry.indices);
        // //     }
        // // }
        // shadowPass.submit();
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


function writeFloatArray(dataView: DataView, byteOffset: number, array: number[] | Float32Array<any>, ...more: number[]): number {
    for (let i = 0; i < array.length; i++) {
        dataView.setFloat32(byteOffset, array[i], true);
        byteOffset += Float32Array.BYTES_PER_ELEMENT;
    }

    for (let i = 0; i < more.length; i++) {
        dataView.setFloat32(byteOffset, more[i], true);
        byteOffset += Float32Array.BYTES_PER_ELEMENT;
    }

    return byteOffset;
}
