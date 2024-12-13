import { UpdateTexture } from "core/Graphics";
import { DefaultSampling } from "core/texture/SamplingConfig";
import {
    ImageChannelRange,
    TextureDescription,
    ImageChannelFormat,
    TextureType,
    ImageWithData
} from 'core/texture/Texture';
import DebugUtil from "../../util/DebugUtil";
import { GlTextureCache } from "../WebGLGraphics";
import GlSampler, { GlFunc } from "./GlSampler";

export default class GlTexture {
    public static createTexture(gl: WebGL2RenderingContext, textureDescription: TextureDescription, activeTexture: number) {
        const { type, samplingConfig, image } = textureDescription;
        const { channel, width, height } = image;
        const imageData: ArrayBufferView = (<ImageWithData>image).imageData;
        const texture: WebGLTexture = gl.createTexture();

        const target = GlTexture.determineTarget(gl, textureDescription.type);
        const textureFormat = GlTexture.parseTextureFormat(gl, channel.format);
        const pixelFormat = GlTexture.parsePixelFormat(gl, channel.dataType);

        gl.activeTexture(activeTexture);
        if (type === TextureType.TEXTURE_2D) {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, textureFormat, pixelFormat, imageData);
        } else if (type === TextureType.TEXTURE_ARRAY) {
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
            gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, width, height, textureDescription.depth, 0, textureFormat, pixelFormat, imageData);
        } else if (textureDescription.type === TextureType.CUBE_MAP) {
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
            gl.texStorage2D(gl.TEXTURE_CUBE_MAP, 6, gl.RGBA8, width, height);
        }

        GlSampler.setSamplerFilterToGL(gl, samplingConfig || DefaultSampling, target, gl.texParameteri as GlFunc);
        DebugUtil.glCheckError(gl, texture)

        return texture!;
    }

    public static writeToTexture(gl: WebGL2RenderingContext, texture: GlTextureCache, updateTexture: UpdateTexture) {
        const {
            x = 0, y = 0, z = 0, glFace,
            data: { channel, width, height, imageData }
        } = updateTexture;

        const textureFormat = GlTexture.parseTextureFormat(gl, channel.format);
        const pixelFormat = GlTexture.parsePixelFormat(gl, channel.dataType);

        gl.activeTexture(texture.activeTexture);
        if (texture.metaData.type === TextureType.TEXTURE_2D) {
            gl.bindTexture(gl.TEXTURE_2D, texture.glTexture);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, width, height, textureFormat, pixelFormat, imageData);
        } else if (texture.metaData.type === TextureType.TEXTURE_ARRAY) {
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture.glTexture);
            gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, x, y, z, width, height, 1, textureFormat, pixelFormat, imageData);
        } else if (texture.metaData.type === TextureType.CUBE_MAP) {
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture.glTexture);
            gl.texSubImage2D(glFace!, 0, x, y, width, height, textureFormat, pixelFormat, imageData);
        }

        DebugUtil.glCheckError(gl, texture.glTexture)
    }


    private static parseTextureFormat(gl: WebGL2RenderingContext, format: ImageChannelFormat): GLenum {
        if (format === 'rgba8unorm') {
            return gl.RGBA;
        } else if (format === 'rgba16float') {
            return gl.RGBA16F
        } else if (format === 'rgba32float') {
            return gl.RGBA32F;
        } else if (format === 'rgba8unorm-srgb') {
            return gl.SRGB8_ALPHA8
        } else {
            throw new Error(`Unknown texture format: ${ format }`)
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
                throw new Error(`Unknown texture type: ${ type }`);
        }
    }

    private static parsePixelFormat(gl: WebGL2RenderingContext, channelType: keyof typeof ImageChannelRange) {
        if (channelType.toUpperCase() === 'UINT8') {
            return gl.UNSIGNED_BYTE;
        } else if (channelType.toUpperCase() === 'UINT16') {
            return gl.UNSIGNED_INT;
        } else if (channelType.toUpperCase() === 'FLOAT') {
            return gl.FLOAT;
        } else {
            throw new Error(`Unknown channelType: ${ channelType }`);
        }
    }
}
