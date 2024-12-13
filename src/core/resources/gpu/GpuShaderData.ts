import { BindGroupLayoutId } from 'core/Graphics';
import { Blend } from 'core/resources/gpu/Blend';
import { BufferFormat, BufferId } from "core/resources/gpu/BufferDescription";
import { TextureSize } from 'core/texture/Texture';

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

    shaderLayoutIds: BindGroupLayoutId[],
    fragmentShaderSource: string,

    vertexShaderSource: string,
    vertexShaderLayout: VertexBufferLayout[],
    vertexShaderStride: number,

    textureArraySize?: TextureSize
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

export enum UniformVisibility {
    VERTEX = 1,
    FRAGMENT = 2,
    COMPUTE = 4,
}