import { BufferId } from 'core/resources/gpu/BufferDescription';
import { ShaderStructName } from 'core/resources/shader/ShaderStruct';
import { SamplerId, TextureId } from 'core/texture/Texture';

export type BindGroupEntryType = 'cube-texture' | 'texture-array' | 'texture' | 'sampler' | 'uniform' | 'storage';
export type BindGroupBuffer = (BufferId | TextureId | SamplerId)
export default interface BindGroup {
    label: string,
    entries: BindGroupEntry[],
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
