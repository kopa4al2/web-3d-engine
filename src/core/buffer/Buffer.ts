import { vec3 } from "gl-matrix";

export type BufferData = Float32Array | Uint16Array | Uint32Array;
export type BufferId = symbol;

export type TextureData = ImageBitmap | ImageData

export interface Buffer {
    name?: string,
    usage: number,
    byteLength: number,
}

export enum BufferFormat {
    FLOAT32x3 = 'float32x3',
    FLOAT32x2 = 'float32x2',
}

export class BufferUsage {
    public static readonly VERTEX = 32;
    public static readonly INDEX = 16;
    public static readonly COPY_DST = 8;
    public static readonly UNIFORM = 64;
}

