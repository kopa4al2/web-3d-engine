import { BindGroupEntryType } from 'core/resources/BindGroup';
import {
    GLOBAL_STRUCT,
    PHONG_MATERIAL_STRUCT,
    SAMPLER_STRUCT,
    VERTEX_STORAGE_BUFFER_STRUCT,
    TEXTURE_ARRAY_STRUCT
} from 'core/resources/DefaultBindGroupLayouts';
import { BufferData } from 'core/resources/gpu/BufferDescription';
import { UniformVisibility } from 'core/resources/gpu/GpuShaderData';
import Bitmask from 'util/BitMask';

export default interface ShaderStruct {
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
}

export type ShaderStructName = 'Global' | 'Material' | 'InstanceData'
    | 'TexturesArray' | 'Sampler' | 'GlobalSampler' | 'EnvCubeMap' | 'EnvSampler'
    | 'Camera' | 'Time' | 'Light'
    | 'PhongMaterial' | 'PBRMaterial'