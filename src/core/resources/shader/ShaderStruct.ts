import { BindGroupEntryType } from 'core/resources/BindGroup';
import { BufferData } from 'core/resources/gpu/BufferDescription';
import { UniformVisibility } from 'core/resources/gpu/GpuShaderData';
import Bitmask from 'util/BitMask';

export type TextureStruct = { readonly type: 'texture-array' | 'texture' | 'cube-texture' } & {
    sampleType: | 'float' | 'unfilterable-float' | 'depth' | 'sint' | 'uint'
}

export type SamplerStruct = { readonly type: 'sampler' } & {
    samplerType: 'filtering' | 'non-filtering' | 'comparison'
}

type ShaderType = {
    readonly type: BindGroupEntryType,
    readonly binding: number,
    readonly name: ShaderStructName,
    readonly visibilityMask: Bitmask<UniformVisibility>
    readonly byteLength?: number,
    readonly defaultValue?: BufferData,
    readonly dynamicOffset?: {
        readonly size: number,
    }
    readonly instanced?: {
        readonly offset: number
    }
};

// export default interface ShaderStruct {
export type ShaderStruct = ShaderType & (TextureStruct  | SamplerStruct) | ShaderType

export type ShaderStructName = 'Global' | 'Material' | 'InstanceData'
    | 'TexturesArray' | 'Sampler' | 'GlobalSampler' | 'EnvCubeMap' | 'EnvSampler' | 'ShadowMap' | 'ShadowMapSampler'
    | 'Camera' | 'Time' | 'Light'
    | 'PhongMaterial' | 'PBRMaterial' | string
