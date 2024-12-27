import Graphics, { BindGroupId, BindGroupLayoutId } from 'core/Graphics';
import BindGroup from 'core/resources/BindGroup';
import BindGroupLayout from 'core/resources/BindGroupLayout';
import BufferManager from 'core/resources/BufferManager';
import { FragmentShaderName, VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import { BufferData, BufferDescription } from 'core/resources/gpu/BufferDescription';
import { DEFAULT_PIPELINE_OPTIONS, PipelineOptions, UniformVisibility } from 'core/resources/gpu/GpuShaderData';
import ShaderManager from 'core/resources/shader/ShaderManager';
import TextureManager from 'core/resources/TextureManager';
import Texture from "core/texture/Texture";
import DebugUtil from '../../util/debug/DebugUtil';
import logger from 'util/Logger';
import ObjectUtils from 'util/ObjectUtils';
import glBasicFragmentShader from 'webgl/shaders/basic/basicFragmentShader.frag';
import glBasicVertexShader from 'webgl/shaders/basic/basicVertexShader.vert';
import glBasicVertexShaderInstanced from 'webgl/shaders/basic/basicVertexShaderInstanced.vert';
import glShapeFragmentShader from 'webgl/shaders/debug/outlinedShapeFragmentShader.frag';
import glShapeVertexShader from 'webgl/shaders/debug/outlinedShapeVertexShader.vert';
import glPBRLightFragmentShader from 'webgl/shaders/light/pbrFragment.frag';
import glPhongLightFragmentShader from 'webgl/shaders/light/phongFragment.frag';
import glLightVertexShader from 'webgl/shaders/light/vertexShader.vert';
import glTerrainFragmentShader from 'webgl/shaders/terrain/terrainFragmentShader.frag';
import glTerrainVertexShader from 'webgl/shaders/terrain/terrainVertexShader.vert';
import WebGPUGraphics from 'webgpu/graphics/WebGPUGraphics';
import gpuBasicFragment from 'webgpu/shaders/basic/basicFragmentShader.wgsl';
import basicFragmentShaderInstanced from 'webgpu/shaders/basic/basicFragmentShaderInstanced.wgsl';
import gpuBasicVertex from 'webgpu/shaders/basic/basicVertexShader.wgsl';
import gpuBasicVertexInstanced from 'webgpu/shaders/basic/basicVertexShaderInstanced.wgsl';
import gpuSphereFragmentShader from 'webgpu/shaders/debug/sphereFragmentShader.wgsl';
import gpuSphereVertexShader from 'webgpu/shaders/debug/sphereVertexShader.wgsl';
import gpuPBRLightFragmentShader from 'webgpu/shaders/light/pbrFragment.wgsl';
import gpuPhongLightFragmentShader from 'webgpu/shaders/light/phongFragment.wgsl';
import gpuLightVertexShader from 'webgpu/shaders/light/vertexShader.wgsl';
import gpuTerrainFragmentShader from 'webgpu/shaders/terrain/terrainFragmentShader.wgsl';
import gpuTerrainVertexShader from 'webgpu/shaders/terrain/terrainVertexShader.wgsl';
import { BindGroupHelper } from 'core/rendering/Helpers';
import Globals from '../../engine/Globals';


export type PipelineHash = string;

export default class ResourceManager {

    private bindGroupLayoutsCache: Record<string, BindGroupLayoutId> = {}

    public textureManager: TextureManager;
    public bufferManager: BufferManager;

    public globalBindGroup!: BindGroupId;

    constructor(private graphics: Graphics) {
        DebugUtil.addToWindowObject('gpuResourceManager', this);
        this.textureManager = new TextureManager(graphics);
        this.bufferManager = new BufferManager(graphics);
        // this.globalBindGroup = this.createGlobalBindGroup();
    }

    public async init() {
        return await Promise.all([
            this.textureManager.create1x1Texture(Texture.DEFAULT_ALBEDO_MAP, new Uint8ClampedArray([255, 255, 255, 255])),
            this.textureManager.create1x1Texture(Texture.DEFAULT_NORMAL_MAP, new Uint8ClampedArray([128, 128, 255, 255])),
            this.textureManager.create1x1Texture(Texture.DEFAULT_METALLIC_ROUGHNESS_MAP, new Uint8ClampedArray([255, 255, 255, 255])),
        ]).then(() => {
            this.globalBindGroup = this.createGlobalBindGroup()
        });
        // new BindGroupHelper(this, 'global', [
        //     { name: 'Camera', type: 'uniform', visibility: UniformVisibility.VERTEX | UniformVisibility.FRAGMENT, byteLength: 80 },
        //     { name: 'Light', type: 'uniform', visibility: UniformVisibility.FRAGMENT, byteLength: 464 },
        //     { name: 'Time', type: 'uniform', visibility: UniformVisibility.VERTEX | UniformVisibility.FRAGMENT, byteLength: 16 },
        //     { name: 'TexturesArray', type: 'texture-array', visibility: UniformVisibility.FRAGMENT, depth: TextureManager.TEXTURE_ARRAY_LAYERS },
        //     { name: 'Sampler', type: 'sampler', visibility: UniformVisibility.FRAGMENT, samplerType: 'filtering', config:  },
        //     { name: 'EnvCubeMap', type: 'cube-texture', visibility: UniformVisibility.FRAGMENT },
        //     { name: 'EnvSampler', type: 'sampler', visibility: UniformVisibility.FRAGMENT },
        //     { name: 'ShadowMap', type: 'texture-array', visibility: UniformVisibility.FRAGMENT, depth: Globals.MAX_SHADOW_CASTING_LIGHTS },
        //     { name: 'ShadowMapSampler', type: 'sampler', visibility: UniformVisibility.FRAGMENT },
        // ])
    }

    private createGlobalBindGroup() {
        return this.graphics.createBindGroup(this.getOrCreateLayout(ShaderManager.GLOBAL_BIND_GROUP), {
            label: 'global',
            entries: [
                {
                    type: 'uniform',
                    bufferId: this.bufferManager.globalBuffers.get('Camera')!,
                    binding: 0,
                    name: 'Camera',
                },
                {
                    type: 'uniform',
                    bufferId: this.bufferManager.globalBuffers.get('Light')!,
                    binding: 1,
                    name: 'Light',
                },
                {
                    type: 'uniform',
                    bufferId: this.bufferManager.globalBuffers.get('Time')!,
                    binding: 2,
                    name: 'Time',
                },
                {
                    type: 'texture-array',
                    bufferId: this.textureManager.getTextureArrayIdForSize(TextureManager.MAX_TEXTURE_ARRAY_SIZE),
                    depth: TextureManager.TEXTURE_ARRAY_LAYERS,
                    binding: 3,
                    name: 'TexturesArray',
                }, {
                    type: 'sampler',
                    bufferId: this.graphics.createSampler({
                        label: 'global-sampler',
                        magFilter: 'linear',
                        minFilter: 'linear',
                        // mipmapFilter: 'nearest',
                        addressModeU: 'repeat',
                        addressModeV: 'repeat',
                        addressModeW: 'repeat',
                        targetTexture: this.textureManager.getTextureArrayIdForSize(TextureManager.MAX_TEXTURE_ARRAY_SIZE),
                    }),
                    binding: 4,
                    name: 'GlobalSampler',
                },
                {
                    type: 'cube-texture',
                    name: 'EnvCubeMap',
                    bufferId: this.textureManager.getEnvironmentMap(),
                    binding: 5,
                }, {
                    type: 'sampler',
                    name: 'EnvSampler',
                    bufferId: this.graphics.createSampler({
                        label: 'env-sampler',
                        magFilter: 'linear',
                        minFilter: 'linear',
                        // mipmapFilter: 'linear',
                        addressModeU: 'clamp-to-edge',
                        addressModeV: 'clamp-to-edge',
                        addressModeW: 'clamp-to-edge',
                        targetTexture: this.textureManager.getEnvironmentMap(),
                    }),
                    binding: 6,
                },
                {
                    type: 'texture-array',
                    name: 'ShadowMap',
                    bufferId: this.textureManager.getShadowMap(),
                    binding: 7,
                }, {
                    type: 'sampler',
                    name: 'ShadowMapSampler',
                    bufferId: this.graphics.createSampler({
                        label: 'ShadowMapSampler',
                        magFilter: 'linear',
                        minFilter: 'linear',
                        mipmapFilter: 'linear',
                        addressModeU: 'clamp-to-edge',
                        addressModeV: 'clamp-to-edge',
                        addressModeW: 'clamp-to-edge',
                        compare: 'less',
                        targetTexture: this.textureManager.getShadowMap(),
                    }),
                    binding: 8,
                },
            ]
        });
    }

    public getOrCreateLayout(bindGroupLayout: BindGroupLayout): BindGroupLayoutId {
        const uniqueKey = bindGroupLayout.label;
        if (!this.bindGroupLayoutsCache[uniqueKey]) {
            this.bindGroupLayoutsCache[uniqueKey] = this.graphics.createShaderLayout({ ...bindGroupLayout });
        } else {
            // console.warn(`Taking bind group layout from cache: ${ uniqueKey }`)
        }

        return this.bindGroupLayoutsCache[uniqueKey];
    }

    public createBuffer(description: BufferDescription, data?: BufferData) {
        // TODO: Use buffer manager
        if (data) {
            return this.graphics.createBufferWithData(description, data);
        } else {
            return this.graphics.createBuffer(description);
        }
    }

    public createBindGroup(bindGroupLayoutId: BindGroupLayoutId,
                           bindGroup: BindGroup): BindGroupId {
        return this.graphics.createBindGroup(bindGroupLayoutId, bindGroup);
    }

    private mergeWithDefaultOptions(pipelineOptions: Partial<PipelineOptions>): PipelineOptions {
        return ObjectUtils.mergePartial(pipelineOptions, DEFAULT_PIPELINE_OPTIONS);
    }

    private getFragmentSource(shaderName: FragmentShaderName) {
        if (this.graphics instanceof WebGPUGraphics) {
            return this.getWebGpuFragmentSource(shaderName);
        }

        return this.getWebGlFragmentSource(shaderName);
    }

    private getVertexSource(shaderName: VertexShaderName) {
        if (this.graphics instanceof WebGPUGraphics) {
            return this.getWebGpuVertexSource(shaderName);
        }

        return this.getWebGlVertexSource(shaderName);
    }

    private getWebGpuVertexSource(shaderName: VertexShaderName) {
        switch (shaderName) {
            case VertexShaderName.LIT_TANGENTS_VEC4:
                return gpuBasicVertex;
            case VertexShaderName.UNLIT_GEOMETRY:
                return gpuSphereVertexShader;
            case VertexShaderName.UNUSED_OLD_BASIC_INSTANCED:
                return gpuBasicVertexInstanced;
            case VertexShaderName.LIT_GEOMETRY:
                return gpuLightVertexShader;
            case VertexShaderName.TERRAIN:
                return gpuTerrainVertexShader
            default: {
                logger.warn(`Unknown vertex shader name: ${shaderName}. Defaulting to basic!`);
                return gpuBasicVertex;
            }
        }
    }

    private getWebGlVertexSource(shaderName: VertexShaderName) {
        switch (shaderName) {
            case VertexShaderName.LIT_TANGENTS_VEC4:
                return glBasicVertexShader
            case VertexShaderName.UNUSED_OLD_BASIC_INSTANCED:
                return glBasicVertexShaderInstanced;
            case VertexShaderName.UNLIT_GEOMETRY:
                return glShapeVertexShader;
            case VertexShaderName.LIT_GEOMETRY:
                return glLightVertexShader;
            case VertexShaderName.TERRAIN:
                return glTerrainVertexShader
            default: {
                logger.warn(`Unknown vertex shader name: ${shaderName}. Defaulting to basic!`);
                return glBasicVertexShader;
            }
        }
    }

    private getWebGpuFragmentSource(shaderName: FragmentShaderName) {
        switch (shaderName) {
            case FragmentShaderName.BASIC:
                return gpuBasicFragment;
            case FragmentShaderName.UNLIT:
                return gpuSphereFragmentShader;
            case FragmentShaderName.BASIC_INSTANCED:
                return basicFragmentShaderInstanced;
            case FragmentShaderName.PHONG_LIT:
                return gpuPhongLightFragmentShader;
            case FragmentShaderName.PBR:
                return gpuPBRLightFragmentShader;
            case FragmentShaderName.TERRAIN:
                return gpuTerrainFragmentShader;
            default: {
                logger.warn(`Unknown fragment shader name: ${shaderName}. Defaulting to basic!`);
                return gpuBasicFragment;
            }
        }
    }

    private getWebGlFragmentSource(shaderName: FragmentShaderName) {
        switch (shaderName) {
            case FragmentShaderName.BASIC:
            case FragmentShaderName.BASIC_INSTANCED:
                return glBasicFragmentShader;
            case FragmentShaderName.UNLIT:
                return glShapeFragmentShader
            case FragmentShaderName.PHONG_LIT:
                return glPhongLightFragmentShader;
            case FragmentShaderName.PBR:
                return glPBRLightFragmentShader;
            case FragmentShaderName.TERRAIN:
                return glTerrainFragmentShader;
            default: {
                logger.warn(`Unknown fragment shader name: ${shaderName}. Defaulting to basic!`);
                return glBasicFragmentShader;
            }
        }
    }
}
