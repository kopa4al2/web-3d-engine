//@ts-nocheck
// TODO: Handle ImageBitmap types for imageData
import { UpdateTexture } from "core/Graphics";
import { DefaultSampling } from "core/texture/SamplingConfig";
import {
    ImageChannelRange,
    TextureDescription,
    ImageChannelFormat,
    TextureType,
    ImageWithData
} from 'core/texture/Texture';
import DebugUtil from "../../util/debug/DebugUtil";
import { GlTextureCache } from "../WebGLGraphics";
import GlSampler, { GlFunc } from "./GlSampler";

export default class GlTexture {
    public static createTexture(gl: WebGL2RenderingContext, textureDescription: TextureDescription, activeTexture: number) {
        const { type, samplingConfig, image } = textureDescription;
        const { channel, width, height } = image;
        const imageData: ArrayBufferView = ( <ImageWithData> image ).imageData;
        const texture: WebGLTexture = gl.createTexture();

        const target = GlTexture.determineTarget(gl, textureDescription.type);
        const textureFormat = GlTexture.parseTextureFormat(gl, channel.format);
        const pixelFormat = GlTexture.parsePixelFormat(gl, imageData);

        gl.activeTexture(activeTexture);
        if (type === TextureType.TEXTURE_2D) {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, textureFormat, width, height, 0, gl.RGBA, pixelFormat, imageData);
        } else if (type === TextureType.TEXTURE_ARRAY) {
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
            gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, textureFormat, width, height, textureDescription.depth, 0, gl.RGBA, pixelFormat, imageData);
            const ext = gl.getExtension('EXT_texture_filter_anisotropic');
            if (ext) {
                console.log('Setting anisotropic filtering for texture array!')
                const maxAniso = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
                gl.texParameterf(gl.TEXTURE_2D_ARRAY, ext.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
            }
            
            // gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
            // gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            // gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        } else if (textureDescription.type === TextureType.CUBE_MAP) {
            // const ext = gl.getExtension('EXT_color_buffer_float');
            // console.log('ext', ext);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
            gl.texStorage2D(gl.TEXTURE_CUBE_MAP, 6, textureFormat, width, height);
            // gl.texStorage2D(gl.TEXTURE_CUBE_MAP, 6, gl.RGBA8, width, height);
            // gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        }

        if (samplingConfig) {
            GlSampler.setSamplerFilterToGL(gl, samplingConfig || DefaultSampling, target, gl.texParameteri as GlFunc);
        } else {
            console.warn('Texture without samplingConfig', textureDescription);
        }
        DebugUtil.glCheckError(gl, texture)

        return texture!;
    }

    public static writeToTexture(gl: WebGL2RenderingContext, texture: GlTextureCache, updateTexture: UpdateTexture) {
        const {
            x = 0, y = 0, z = 0, glFace,
            data: { channel, width, height, imageData }
        } = updateTexture;

        // const textureFormat = GlTexture.parseTextureFormat(gl, channel.format);
        const pixelFormat = GlTexture.parsePixelFormat(gl, imageData);
        // const pixelFormat = GlTexture.parsePixelFormat(gl, channel.dataType);

        gl.activeTexture(texture.activeTexture);
        if (texture.metaData.type === TextureType.TEXTURE_2D) {
            gl.bindTexture(gl.TEXTURE_2D, texture.glTexture);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, width, height, gl.RGBA, pixelFormat, imageData);
        } else if (texture.metaData.type === TextureType.TEXTURE_ARRAY) {
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture.glTexture);
            gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, x, y, z, width, height, 1, gl.RGBA, pixelFormat, imageData);
        } else if (texture.metaData.type === TextureType.CUBE_MAP) {
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture.glTexture);
            gl.texSubImage2D(glFace!, 0, x, y, width, height, gl.RGBA, pixelFormat, imageData);
        }

        DebugUtil.glCheckError(gl, texture.glTexture, updateTexture)
    }


    private static parseTextureFormat(gl: WebGL2RenderingContext, format: ImageChannelFormat): GLenum {
        if (format === 'rgba8unorm') {
            return gl.RGBA8;
        } else if (format === 'rgba16float') {
            return gl.RGBA16F
        } else if (format === 'rgba32float') {
            return gl.RGBA32F;
        } else if (format === 'rgba8unorm-srgb') {
            return gl.SRGB8_ALPHA8
        } else if (format === 'depth24plus' || format === 'depth32float') {
            return gl.DEPTH_TEST
        } else {
            throw new Error(`Unknown texture format: ${format}`)
        }
    }

    private static determineTarget(gl: WebGL2RenderingContext, type: TextureType): GLenum {
        switch (type) {
            case TextureType.TEXTURE_2D:
                return gl.TEXTURE_2D;
            case TextureType.CUBE_MAP:
                return gl.TEXTURE_CUBE_MAP;
            case TextureType.TEXTURE_ARRAY:
                return gl.TEXTURE_2D_ARRAY;
            default:
                throw new Error(`Unknown texture type: ${type}`);
        }
    }

    private static parsePixelFormat(gl: WebGL2RenderingContext, arr?: ArrayBufferLike) {
        if (!arr) {
            return gl.UNSIGNED_BYTE;
        } else if (arr instanceof Uint8Array || arr instanceof Uint8ClampedArray) {
            return gl.UNSIGNED_BYTE;
        } else if (arr instanceof Uint32Array) {
            return gl.UNSIGNED_INT;
        } else if (arr instanceof Float32Array) {
            return gl.FLOAT;
        } else if (arr instanceof ImageBitmap) {
            return gl.FLOAT;
        } else {
            console.error('arr', arr);
            throw new Error(`Typed array unknown ${arr}`);
        }
    }
}
// private static parsePixelFormat(gl: WebGL2RenderingContext, channelType: keyof typeof ImageChannelRange) {
//     if (channelType === 'uint8') {
//         return gl.UNSIGNED_BYTE;
//     } else if (channelType === 'uint16') {
//         return gl.UNSIGNED_INT;
//     } else if (channelType === 'float') {
//         return gl.FLOAT;
//     } else {
//         throw new Error(`Unknown channelType: ${ channelType }`);
//     }
// }
// }
