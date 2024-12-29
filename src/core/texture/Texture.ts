import { TextureArrayIndex } from 'core/mesh/material/MaterialProperties';
import SamplingConfig from "core/texture/SamplingConfig";

export type RGBA = [number, number, number, number];
export type RGB = [number, number, number];
export type TextureId = symbol;
export type SamplerId = symbol;

export interface TextureSize {
    // type: '1080p' | '1440p' | '1024x1024' | '1x1',
    width: number,
    height: number,
}

export type TextureData = ImageBitmap | ImageData | { width: number, height: number, bytes: ArrayBufferLike }

export enum TextureType {
    TEXTURE_2D = 'TEXTURE_2D',
    TEXTURE_ARRAY = 'TEXTURE_ARRAY',
    CUBE_MAP = 'CUBE_MAP',
}

export type TextureDescription = { type: TextureType.TEXTURE_2D } & BaseTextureDescriptor
    | { type: TextureType.CUBE_MAP } & BaseTextureDescriptor & CubeTextureDescriptor
    | { type: TextureType.TEXTURE_ARRAY } & BaseTextureDescriptor & TextureArrayDescriptor

export type ImageChannelFormat = 'rgba8unorm' | 'rgba8unorm-srgb' | 'rgba16float' | 'rgba32float' | 'depth32float' | 'depth24plus'

export const ImageChannelRange = {
    uint8: 4,
    uint16: 8,
    float: 16,
} as const;

export interface ImageChannel {
    format: ImageChannelFormat,
    dataType: keyof typeof ImageChannelRange
}

export interface Image {
    channel: ImageChannel,
    width: number,
    height: number,
}

export type ImageWithData = Image & { imageData: ArrayBufferView | ImageBitmap }

export interface BaseTextureDescriptor {
    label?: string,
    image: Image | ImageWithData,
    usage: TextureUsage,
    samplingConfig?: SamplingConfig,
}


export interface CubeTextureDescriptor extends BaseTextureDescriptor {
    depth: number,
    glFace?: GlFace
}

export enum GlFace {
    X = 0x8515,
    '-X',
    Y,
    '-Y',
    Z,
    '-Z'

}

export interface TextureArrayDescriptor extends BaseTextureDescriptor {
    depth: number,
}

export enum TextureUsage {
    COPY_SRC = 1,
    COPY_DST = 2,
    TEXTURE_BINDING = 4,
    STORAGE_BINDING = 8,
    RENDER_ATTACHMENT = 16,
}

export default class Texture {

    public static readonly SHADOW_MAP: string = 'shadow_map';

    public static readonly DEFAULT_ALBEDO_MAP: string = 'default_albedo'
    public static readonly DEFAULT_METALLIC_ROUGHNESS_MAP: string = 'default_metallic_roughness'
    public static readonly DEFAULT_NORMAL_MAP: string = 'default_normal'


    constructor(public id: TextureId,
                public path: string,
                public imageData: TextureData,
                public index: TextureArrayIndex,
                public size: TextureSize) {
    }
}
