import { VertexLayout } from 'core/resources/cpu/CpuShaderData';

export type BufferData = Float32Array<any> | Uint16Array<any> | Uint32Array<any> | Uint8Array<any> | Int8Array<any>;

export type BufferId = symbol;


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

export enum BufferUsage {
    MAP_READ = 1,
    VERTEX = 32,
    INDEX = 16,
    COPY_DST = 8,
    UNIFORM = 64,
    STORAGE = 128,
}

