import { BindGroupLayoutGroupId } from 'core/Graphics';
import { Blend } from 'core/resources/gpu/Blend';
import { BufferFormat, BufferId } from "core/resources/gpu/BufferDescription";
import { SamplerId, TextureId } from "core/texture/Texture";
import Bitmask from 'util/BitMask';

export interface PipelineOptions {
    wireframe: boolean,
    cullFace: 'front' | 'back' | 'none',
    blendMode?: Blend,
    depthCompare: 'less' | 'greater' | 'equal',
    depthWriteEnabled: boolean,
    writeMask: 'ALL' | 'RGB';
}

export const DEFAULT_PIPELINE_OPTIONS: PipelineOptions = {
    cullFace: 'back',
    wireframe: false,
    depthCompare: 'less',
    depthWriteEnabled: true,
    writeMask: 'ALL'
};

export interface ShaderProgramDescription {
    label?: string,
    options: PipelineOptions,

    shaderLayoutIds: BindGroupLayoutGroupId[],
    fragmentShaderSource: string,

    vertexShaderSource: string,
    vertexShaderLayout: VertexBufferLayout[],
    vertexShaderStride: number,
}

export interface IndexBuffer {
    id: BufferId,
    indices: number,
}

export interface VertexBufferLayout {
    offset: number,
    format: BufferFormat;
    location: number;
}

export interface BindGroupLayout {
    label: string,
    variables: BindGroupEntry[],
}

export interface BindGroupEntry {
    type: 'texture' | 'sampler' | 'uniform' | 'storage',
    id: (BufferId | TextureId | SamplerId),
    binding: number,
    visibilityMask: Bitmask<UniformVisibility>,
    name: string,
}

export enum UniformVisibility {
    VERTEX = 1,
    FRAGMENT = 2,
    COMPUTE = 4,
}
