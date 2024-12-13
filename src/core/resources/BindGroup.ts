import { BindGroupId, BindGroupLayoutId } from 'core/Graphics';
import { BufferId } from 'core/resources/gpu/BufferDescription';
import { UniformVisibility } from 'core/resources/gpu/GpuShaderData';
import { ShaderStructName } from 'core/resources/ShaderStruct';
import { SamplerId, TextureId } from 'core/texture/Texture';
import Bitmask from 'util/BitMask';

export type BindGroupEntryType = 'cube-texture' | 'texture-array' | 'texture' | 'sampler' | 'uniform' | 'storage';
export type BindGroupBuffer = (BufferId | TextureId | SamplerId)
export default interface BindGroup {
    label: string,
    entries: BindGroupEntry[],
}

export interface BindGroupInstance extends BindGroup {
    bindGroupLayoutId: BindGroupLayoutId,
    bindGroupId: BindGroupId
}

export type BindGroupEntry =
    BaseBindGroupEntry
    | { type: 'texture-array' } & TextureBindGroupEntry

export interface BaseBindGroupEntry {
    type: BindGroupEntryType,
    bufferId: BindGroupBuffer,
    binding: number,
    name: ShaderStructName,
}

export interface TextureBindGroupEntry extends BaseBindGroupEntry {
    depth?: number,
}

export interface BindGroupDynamicOffset extends BaseBindGroupEntry {
    size: number,
}
