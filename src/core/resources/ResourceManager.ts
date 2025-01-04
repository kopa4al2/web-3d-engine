import Graphics, { BindGroupId, BindGroupLayoutId } from 'core/Graphics';
import BindGroup from 'core/resources/BindGroup';
import BindGroupLayout from 'core/resources/BindGroupLayout';
import BufferManager from 'core/resources/BufferManager';
import { BufferData, BufferDescription } from 'core/resources/gpu/BufferDescription';
import ShaderManager from 'core/resources/shader/ShaderManager';
import TextureManager from 'core/resources/TextureManager';
import Texture from 'core/texture/Texture';
import DebugUtil from '../../utils/debug/DebugUtil';


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
            // console.warn(`Taking bind group layout from cache: ${ uniqueKey }`, this.bindGroupLayoutsCache)
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
}
