import { BindGroupLayoutId } from 'core/Graphics';
import { Blend } from 'core/resources/gpu/Blend';
import { BufferFormat, BufferId } from "core/resources/gpu/BufferDescription";
import { TextureSize } from 'core/texture/Texture';
import Globals from "../../../engine/Globals";

export interface PipelineDepthAttachment {
    disabled?: boolean,
    depthCompare: 'less' | 'greater' | 'equal' | 'always' | 'never' | 'less-equal',
    depthWriteEnabled: boolean,
    format: 'depth24plus' | 'depth32float'
}

export interface PipelineColorAttachment {
    disabled?: boolean,
    writeMask: 'ALL' | 'RGB',
    blendMode?: Blend,
    format: 'bgra8unorm'
}

export interface PipelineOptions {
    wireframe: boolean,
    cullFace: 'front' | 'back' | 'none',
    // blendMode?: Blend,
    // depthCompare: 'less' | 'greater' | 'equal',
    // depthWriteEnabled: boolean,
    // writeMask: 'ALL' | 'RGB';
    colorAttachment: PipelineColorAttachment,
    depthAttachment: PipelineDepthAttachment,
}

export const DEFAULT_PIPELINE_OPTIONS: PipelineOptions = {
    cullFace: 'back',
    wireframe: false,
    // depthCompare: 'less',
    // depthWriteEnabled: true,
    // writeMask: 'ALL',
    colorAttachment: {
        writeMask: 'ALL',
        format: 'bgra8unorm'
    },
    depthAttachment: {
        depthCompare: 'less',
        depthWriteEnabled: true,
        format: Globals.DEFAULT_DEPTH_FN
    }
};

export interface ShaderProgramDescription {
    label?: string,
    options: PipelineOptions,

    shaderLayoutIds: BindGroupLayoutId[],
    fragmentShaderSource?: string,

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

export enum UniformVisibility {
    VERTEX = 1,
    FRAGMENT = 2,
    COMPUTE = 4,
}
