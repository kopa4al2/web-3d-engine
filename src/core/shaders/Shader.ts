import { BufferFormat, BufferId } from "core/buffer/Buffer";
import Texture, { SamplerId, TextureId } from "core/texture/Texture";


export interface IndexBuffer {
    id: BufferId,
    indices: number,
}

export interface VertexBuffer {
    id: BufferId,
    stride: number;
    vertexCount: number;
    layout: VertexBufferLayout[]
}


export interface VertexBufferLayout {
    offset: number,
    format: BufferFormat;
    location?: number;
}

export interface Shader {
    vertexShaderSource: string,
    fragmentShaderSource: string,
    bindGroups: BindGroupLayout[],
    vertexBuffers: VertexBuffer[],
    indexBuffer?: IndexBuffer,
}

export interface BindGroupLayout {
    groupNumber: number, // The group number for wgsl, the order of declaration for webgl
    uniformName?: string, // The uniform name for webgl, and the label for webgpu
    targetShader: ShaderType,  // vertex of fragment shader
    buffers: BindGroupBuffers [], // list of buffers that are in this group. The order in the array should be the order in which they are declared or the @binding index
}

export interface BindGroupBuffers {
    type: 'texture' | 'sampler' | 'uniform',
    id: (BufferId | TextureId | SamplerId),
    bindNumber: number,
    name: string,
}

export interface FragmentShader {
    shaderSource: string,
    uniforms: FragmentUniformInfo[],
}

export interface FragmentUniformInfo {
    type: 'texture' | 'sampler' | 'float32Array',
    binding: number,
    group: number,
    name: string,
    visibility: ShaderType,
    value?: (Float32Array | Texture)
}

/**
 * CPU DATA
 */
export interface VertexShader {
    shaderSource: string,
    stride: number,
    vertexCount: number,
    vertices: Float32Array,
    indices?: Uint16Array | Uint32Array,
    layout: VertexLayout[],
}

/**
 * CPU DATA
 */
export interface VertexLayout {
    dataType: BufferDataType,
    elementsPerVertex: number,
}

export type BufferDataType = 'float32';
export type LayoutRepresent = 'normals' | 'vertices' | 'textureUv';

export enum ShaderType {
    VERTEX = 1,
    FRAGMENT = 2,
    COMPUTE = 4,
}
