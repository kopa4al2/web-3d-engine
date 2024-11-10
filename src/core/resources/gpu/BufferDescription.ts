import { VertexLayout, VertexLayoutEntry } from 'core/resources/cpu/CpuShaderData';

export type BufferData = Float32Array | Uint16Array | Uint32Array;
export type BufferId = symbol;

export type TextureData = ImageBitmap | ImageData

export interface BufferDescription {
    label?: string,
    usage: number,
    byteLength: number,
    vertexLayout?: VertexLayout // Dirty hack for webgl2
}

export enum BufferFormat {
    FLOAT32x3 = 'float32x3',
    FLOAT32x2 = 'float32x2',
}

// console.log('WebGPu Buffer usage: ', GPUBufferUsage);
export enum BufferUsage {
    VERTEX = 32,
    INDEX = 16,
    COPY_DST = 8,
    UNIFORM = 64,
    STORAGE = 128,
}

