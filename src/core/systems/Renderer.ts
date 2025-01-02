import Component from "core/components/Component";
import Transform from 'core/components/Transform';
import EntityManager from "core/EntityManager";
import DirectionalLight from 'core/light/DirectionalLight';
import PointLight from 'core/light/PointLight';
import SpotLight from "core/light/SpotLight";
import { BindGroupHelper } from "core/rendering/Helpers";
import LightRenderer from "core/rendering/LightRenderer";
import { BufferId, BufferUsage } from "core/resources/gpu/BufferDescription";
import { UniformVisibility } from "core/resources/gpu/GpuShaderData";
import ResourceManager from "core/resources/ResourceManager";
import { createStruct } from "core/resources/shader/DefaultBindGroupLayouts";
import ShaderManager from "core/resources/shader/ShaderManager";
import Scene from "core/Scene";
import { System } from "core/systems/EntityComponentSystem";
import { TextureId } from "core/texture/Texture";
import PromiseQueue from 'core/utils/PromiseQueue';
import { mat4, vec3, vec4 } from "gl-matrix";
import Graphics, { BindGroupId, PipelineId } from "../../core/Graphics";
import Globals from '../../engine/Globals';
import BufferUtils from "../../util/BufferUtils";
import DebugCanvas from "../../util/debug/DebugCanvas";
import FullScreenQuad from "../../util/debug/FullScreenQuad";
import ThrottleUtil from "../../util/ThrottleUtil";

/**
 * Knows of global buffers / textures (to bind them)
 * Knows of global buffer layout (calculates and writes data to it)
 * Has to bind all groups / vertex shaders
 */
export default class Renderer implements System {

    private projectionViewMatrix: mat4 = mat4.create();

    private readonly shadowPassPipeline: PipelineId;
    private readonly lights = new Map<Component, { texture: TextureId, layer: number }>();
    private promiseQueue = new PromiseQueue();

    private debugBuffer: BufferId;

    // @ts-ignore
    private fullScreenQuads;

    private shadowPassBindGroupHelper: BindGroupHelper;
    private lightsRenderer: LightRenderer;

    constructor(private graphics: Graphics,
                private entityManager: EntityManager,
                private resourceManager: ResourceManager,
                private shaderManager: ShaderManager) {
        // this.fullScreenQuads = new FullScreenQuad(graphics, resourceManager);
        this.lightsRenderer = new LightRenderer();
        this.shadowPassBindGroupHelper = new BindGroupHelper(resourceManager, 'lightViewProjMatrix', [{
            type: 'uniform',
            name: 'ShadowMapGlobal',
            visibility: UniformVisibility.FRAGMENT | UniformVisibility.VERTEX,
            byteLength: 16 * Float32Array.BYTES_PER_ELEMENT,
        }]);
        this.debugBuffer = resourceManager.createBuffer({
            label: 'debug-buffer-1',
            usage: BufferUsage.COPY_DST | BufferUsage.MAP_READ,
            byteLength: Globals.SHADOW_PASS_TEXTURE_SIZE * Globals.SHADOW_PASS_TEXTURE_SIZE * Float32Array.BYTES_PER_ELEMENT
        })

        const layout1 = this.resourceManager.getOrCreateLayout({
            label: 'InstanceBufferLayout',
            entries: [createStruct('modelMatrix', 'storage', 0, UniformVisibility.VERTEX | UniformVisibility.FRAGMENT)]
        });
        this.shadowPassPipeline = this.shaderManager.createShadowPass(this.shadowPassBindGroupHelper.bindGroupLayoutId, layout1);
        this.debugVisualizeTexture = ThrottleUtil.throttle(this.debugVisualizeTexture.bind(this), 100);
    }

    public update(deltaTime: number): void {
        const scene = this.entityManager.scenes[0];
        scene.update();

        mat4.multiply(this.projectionViewMatrix, scene.projectionMatrix.get(), scene.camera.viewMatrix());
    }

    render(): void {
        const scene = this.entityManager.scenes[0];
        const { camera } = scene;

        if (!camera) {
            console.error('No camera present in the scene. Will not attempt render anything');
            return;
        }

        const dirLights: DirectionalLight[] = [];
        const pointLights: [PointLight, Transform][] = [];
        const spotLights: [SpotLight, Transform][] = [];
        for (const lightEntity of scene.getVisibleLights()) {
            const [directionalLight, pointLight, spotLight, transform] = this.entityManager
                .getComponents<[DirectionalLight, PointLight, SpotLight, Transform]>
                (lightEntity, DirectionalLight.ID, PointLight.ID, SpotLight.ID, Transform.ID);

            if (directionalLight) {
                dirLights.push(directionalLight);
            }
            if (pointLight) {
                pointLights.push([pointLight, transform]);
            }
            if (spotLight) {
                spotLights.push([spotLight, transform]);
            }
        }

        if (dirLights.length > DirectionalLight.MAX_DIRECTION_LIGHTS) {
            throw new Error(`Too many directional lights. Max is ${DirectionalLight.MAX_DIRECTION_LIGHTS}, provided: ${dirLights.length}`);
        }

        if (pointLights.length > PointLight.MAX_POINT_LIGHTS) {
            throw new Error(`Too many point lights. Max is ${PointLight.MAX_POINT_LIGHTS}, provided: ${pointLights.length}`);
        }

        if (spotLights.length > SpotLight.MAX_SPOT_LIGHTS) {
            throw new Error(`Too many point lights. Max is ${SpotLight.MAX_SPOT_LIGHTS}, provided: ${spotLights.length}`);
        }

        this.lightsRenderer.bufferLights(dirLights, pointLights, spotLights);
        const viewMatrix = scene.camera.viewMatrix();
        const projectionMatrix = scene.projectionMatrix;
        const lightViewProjMatrices: mat4[] = Array(Globals.MAX_SHADOW_CASTING_LIGHTS);
        const entitiesToRender = scene.getVisibleEntities();

        if (Globals.ENABLE_SHADOW_CASTINGS) {
            this.performShadowPass(spotLights, lightViewProjMatrices, scene);
        }

        const data = BufferUtils.mergeFloat32Arrays([
            this.projectionViewMatrix as Float32Array,
            projectionMatrix.get(),
            viewMatrix,
            Globals.ENABLE_SHADOW_CASTINGS ? lightViewProjMatrices[0] : mat4.create(),
            new Float32Array([...camera.position, 1]),
            new Float32Array([...camera.forward, 1]),
            new Float32Array([...camera.up, 1]),
            new Float32Array([projectionMatrix.zNear, projectionMatrix.zFar, projectionMatrix.fov, projectionMatrix.aspectRatio]),
        ]);

        this.resourceManager.bufferManager.writeToGlobalBuffer('Camera', data);
        this.resourceManager.bufferManager.writeToGlobalBuffer('Light', this.lightsRenderer.bufferView);
        // FAKE DATA
        this.resourceManager.bufferManager.writeToGlobalBuffer('Time', new Float32Array([1.0, 1.0, 1.0, 1.0]));


        const renderPass = this.graphics.beginRenderPass();

        renderPass.setBindGroup(0, this.resourceManager.globalBindGroup);

        for (const [pipeline, meshes] of entitiesToRender) {
            renderPass.usePipeline(pipeline);
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

                renderPass.drawInstanced(mesh.geometry.indexBuffer, mesh.geometry.indices, entities.length);
            }
        }

        renderPass.submit();
    }


    private performShadowPass(spotLights: [SpotLight, Transform][], lightViewProjMatrices: mat4[], scene: Scene) {
        for (let i = 0; i < Globals.MAX_SHADOW_CASTING_LIGHTS; i++) {
            if (spotLights[i]) {
                const [spotLight, transform] = spotLights[i];

                if (!this.lights.has(spotLight)) {
                    this.lights.set(spotLight, {
                        texture: this.resourceManager.textureManager.getShadowMap(),
                        layer: this.resourceManager.textureManager.getShadowMapLayer()
                    });
                }

                const textureId = this.lights.get(spotLight)!.texture;
                const baseArrayLayer = this.lights.get(spotLight)!.layer;

                const shadowPass = this.graphics.beginRenderPass({
                    label: `shadow-pass-${spotLight.id.description}`,
                    depthAttachment: {
                        textureId: textureId,
                        textureView: {
                            baseArrayLayer: baseArrayLayer,
                            aspect: 'depth-only',
                            dimension: '2d-array'
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
                shadowPass.setBindGroup(0, this.shadowPassBindGroupHelper.bindGroupId);


                // SPOT LIGHT
                const SHADOW_MAP_ASPECT_RATIO = Globals.SHADOW_PASS_TEXTURE_SIZE / Globals.SHADOW_PASS_TEXTURE_SIZE;
                const SHADOW_MAP_Z_NEAR = 0.1;
                const SHADOW_MAP_Z_FAR = Math.sqrt(spotLight.intensity / spotLight.quadraticAttenuation);
                const SHADOW_MAP_FOV = Math.PI / 4;
                const projectionMatrix = mat4.perspectiveZO(mat4.create(), SHADOW_MAP_FOV, SHADOW_MAP_ASPECT_RATIO, SHADOW_MAP_Z_NEAR, SHADOW_MAP_Z_FAR);

                const rotationMatrix = mat4.fromQuat(mat4.create(), transform.worldTransform.rotation);
                mat4.transpose(rotationMatrix, rotationMatrix);
                const translationMatrix = mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), transform.worldTransform.position));
                const viewMat = mat4.multiply(mat4.create(), rotationMatrix, translationMatrix);
                const lightViewProjMatrix = mat4.multiply(mat4.create(), projectionMatrix, viewMat);

                // DIRECTIONAL LIGHT
                // const dirLight = dirLights[0];
                // const lightDirection = vec3.fromValues(dirLight.direction[0], dirLight.direction[1], dirLight.direction[2]);
                // const max = vec3.fromValues(10, 10, 10);
                // const min = vec3.fromValues(-10, -10, -10);
                // const lightViewProjMatrix = calculateDirectionalLightVPMatrixv2(lightDirection, { min, max });
                lightViewProjMatrices[0] = lightViewProjMatrix;
                this.graphics.writeToBuffer(this.shadowPassBindGroupHelper.bufferId, lightViewProjMatrix as Float32Array);
                for (const [pipeline, meshes] of scene.getVisibleEntities()) {
                    if (pipeline.description!.includes('SKY')) {
                        // TODO: Ugly hack
                        console.debug('skipping', pipeline.description);
                        continue;
                    }
                    for (const [mesh, entities] of meshes) {
                        shadowPass.setVertexBuffer(0, mesh.geometry.vertexBuffer);
                        if (!mesh.instanceBuffers) {
                            shadowPass.drawIndexed(mesh.geometry.indexBuffer, mesh.geometry.indices);
                            continue;
                        }

                        const { bufferId, bindGroupId } = mesh.instanceBuffers[0];
                        shadowPass.setBindGroup(1, bindGroupId);
                        for (let index = 0; index < entities.length; index++) {
                            const [_, transform] = entities[index];
                            this.graphics.writeToBuffer(bufferId, transform as Float32Array, index * 64);
                            shadowPass.drawInstanced(mesh.geometry.indexBuffer, mesh.geometry.indices, entities.length);
                        }
                    }
                }

                shadowPass.submit();
                if (Globals.ENABLE_DEBUG_SHADOW) {
                    this.debugVisualizeTexture(textureId);
                }
            }
        }
    }

    private debugVisualizeTexture(textureId: symbol) {
        // this.graphics
        //     ._getTextureData!(textureId, this.debugBuffer)
        //     .then(data =>
        //         DebugCanvas.visualizeDepth(data, Globals.SHADOW_PASS_TEXTURE_SIZE, Globals.SHADOW_PASS_TEXTURE_SIZE));
        // if (this.graphics._getTextureData) {

        this.promiseQueue.addLimitedTask(60, () => this.graphics
            ._getTextureData!(textureId, this.debugBuffer)
            .then(data => DebugCanvas
                .visualizeDepth(data, Globals.SHADOW_PASS_TEXTURE_SIZE, Globals.SHADOW_PASS_TEXTURE_SIZE)));
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


/*

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
}*/


function calculateDirectionalLightVPMatrix(lightDirection: vec3, sceneBounds: {
    min: vec3;
    max: vec3
}, shadowPadding = 2.0): mat4 {
    // Normalize the light direction
    // const normalizedLightDir = lightDirection;
    const normalizedLightDir = vec3.create();
    vec3.normalize(normalizedLightDir, lightDirection);

    // Extract min and max bounds of the scene
    const { min: minBounds, max: maxBounds } = sceneBounds;

    // Calculate the center and extent of the scene bounds
    const center = vec3.fromValues(0, 0, 0);
    // const center = vec3.create();
    // vec3.add(center, minBounds, maxBounds);
    // vec3.scale(center, center, 0.5);

    // const extent = vec3.create();
    // vec3.subtract(extent, maxBounds, minBounds);
    // vec3.scale(extent, extent, 0.5);

    // const reducedExtent = vec3.create();
    // vec3.subtract(reducedExtent, extent, vec3.fromValues(shadowPadding, shadowPadding, shadowPadding));

    // Create a view matrix for the directional light
    const up = vec3.fromValues(0.0, 1.0, 0.0);
    if (Math.abs(vec3.dot(normalizedLightDir, up)) > 0.99999) {
        vec3.set(up, 1.0, 0.0, 0.0);
    }

    const right = vec3.create();
    vec3.cross(right, up, normalizedLightDir);
    vec3.normalize(right, right);
    vec3.cross(up, normalizedLightDir, right);

    // const viewMatrix = mat4.create();
    // mat4.identity(viewMatrix);
    // mat4.set(viewMatrix,
    //     right[0], up[0], -normalizedLightDir[0], 0.0,
    //     right[1], up[1], -normalizedLightDir[1], 0.0,
    //     right[2], up[2], -normalizedLightDir[2], 0.0,
    //     -vec3.dot(right, center), -vec3.dot(up, center), vec3.dot(normalizedLightDir, center), 1.0
    // );

    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix,
        center, vec3.add(vec3.create(), center, lightDirection), up);
    // Create an orthographic projection matrix based on the scene bounds
    const left = -10;
    const rightExtent = 10;
    const bottom = -10;
    const top = 10;
    const near = -10.0;
    const far = 100.0;
    // const left = -extent[0];
    // const rightExtent = extent[0];
    // const bottom = -extent[1];
    // const top = extent[1];
    // const near = -extent[2];
    // const far = extent[2];

    const projectionMatrix = mat4.create();
    mat4.orthoZO(projectionMatrix, left, rightExtent, bottom, top, near, far);

    // Combine view and projection matrices
    const vpMatrix = mat4.create();
    mat4.multiply(vpMatrix, projectionMatrix, viewMatrix);

    return vpMatrix;
}

function calculateDirectionalLightVPMatrixv2(
    lightDirection: vec3,
    sceneBounds: { min: vec3; max: vec3 },
    shadowPadding: number = 0.5
): mat4 {
    // Normalize the light direction
    const normalizedLightDir = vec3.create();
    vec3.normalize(normalizedLightDir, lightDirection);

    // Extract min and max bounds of the scene
    const { min: minBounds, max: maxBounds } = sceneBounds;

    // Calculate the center and extent of the scene bounds
    const center = vec3.create();
    vec3.scaleAndAdd(center, minBounds, maxBounds, 0.5);

    const extent = vec3.create();
    vec3.subtract(extent, maxBounds, minBounds);
    vec3.scale(extent, extent, 0.5);

    // Add shadow padding
    vec3.add(extent, extent, vec3.fromValues(shadowPadding, shadowPadding, shadowPadding));

    // Create a view matrix for the directional light
    const up = vec3.fromValues(0.0, 1.0, 0.0);
    if (Math.abs(vec3.dot(normalizedLightDir, up)) > 0.9999) {
        vec3.set(up, 1.0, 0.0, 0.0);
    }

    const right = vec3.create();
    vec3.cross(right, up, normalizedLightDir);
    vec3.normalize(right, right);
    vec3.cross(up, normalizedLightDir, right);

    const viewMatrix = mat4.create();
    mat4.identity(viewMatrix);
    mat4.set(viewMatrix,
        right[0], up[0], -normalizedLightDir[0], 0.0,
        right[1], up[1], -normalizedLightDir[1], 0.0,
        right[2], up[2], -normalizedLightDir[2], 0.0,
        -vec3.dot(right, center), -vec3.dot(up, center), vec3.dot(normalizedLightDir, center), 1.0
    );

    // Create an orthographic projection matrix based on the scene bounds
    const left = -extent[0];
    const rightExtent = extent[0];
    const bottom = -extent[1];
    const top = extent[1];
    // const near = 0.1;
    // const far = 10.0;
    const near = -extent[2];
    const far = extent[2];

    const projectionMatrix = mat4.create();
    mat4.orthoZO(projectionMatrix, left, rightExtent, bottom, top, near, far);

    // Combine view and projection matrices
    const vpMatrix = mat4.create();
    mat4.multiply(vpMatrix, projectionMatrix, viewMatrix);

    return vpMatrix;
}


/*
// OLD DIR LIGHTS

const lightDataBuffer = new ArrayBuffer(bytesForDirLight + bytesForPointLights + bytesForSpotLights + bytesForMetadata);
        const dataView = new DataView(lightDataBuffer);

if (dirLights.find(l => l.hasChanged)) {
    for (let i = 0; i < DirectionalLight.MAX_DIRECTION_LIGHTS; i++) {
        const dirLight = dirLights[i];
        if (dirLight) {
            byteOffset = writeFloatArray(dataView, byteOffset, dirLight.direction);
            byteOffset = writeFloatArray(dataView, byteOffset, dirLight.color.toArray());
            byteOffset = writeFloatArray(dataView, byteOffset, [dirLight.intensity, 0, 0, 0]);
            // dirLight.hasChanged = false;
        } else {
            // padding
            byteOffset = writeFloatArray(dataView, byteOffset, new Float32Array(floatsPerDirLightStruct));
        }
    }

}
*/


/*
// OLD SPOT LIGHT
for (let i = 0; i < SpotLight.MAX_SPOT_LIGHTS; i++) {
    const spotLightTuple = spotLights[i];
    if (spotLightTuple) {

        const direction = vec4.transformQuat(vec4.create(), vec4.fromValues(0, 0, -1.0, 0.0), transform.worldTransform.rotation);
        vec4.normalize(direction, direction);

        byteOffset = writeFloatArray(dataView, byteOffset, transform.worldTransform.position, 1.0);
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
}*/


/*
// OLD POINT LIGHT
for (let i = 0; i < PointLight.MAX_POINT_LIGHTS; i++) {
    const pointLightTuple = pointLights[i];
    if (pointLightTuple) {
        byteOffset = writeFloatArray(dataView, byteOffset, position);
        byteOffset = writeFloatArray(dataView, byteOffset, pointLight.color.toArray());
        byteOffset = writeFloatArray(dataView, byteOffset, [pointLight.intensity, pointLight.constant, pointLight.linear, pointLight.quadratic]);
        byteOffset = writeFloatArray(dataView, byteOffset, [pointLight.intensity, pointLight.constantAttenuation, pointLight.linearAttenuation, pointLight.quadraticAttenuation]);
    } else {
        // padding
        byteOffset = writeFloatArray(dataView, byteOffset, new Float32Array(floatsPerPointLightStruct));
    }
}*/


/*
    // OLD META DATA

    dataView.setUint32(byteOffset, dirLights.length, true);
    dataView.setUint32(byteOffset + 4, pointLights.length, true);
    dataView.setUint32(byteOffset + 8, spotLights.length, true);
 */
