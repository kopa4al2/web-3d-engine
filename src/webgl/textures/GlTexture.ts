// TODO: Handle ImageBitmap types for imageData
import { UpdateTexture } from 'core/Graphics';
import { DefaultSampling } from 'core/texture/SamplingConfig';
import { ImageChannelFormat, ImageWithData, TextureDescription, TextureType } from 'core/texture/Texture';
import DebugUtil from '../../utils/debug/DebugUtil';
import { GlTextureCache } from '../WebGLGraphics';
import GlSampler, { GlFunc } from './GlSampler';

// For every texture image there are 2 different methods with the same number and type of arguments,
// differ only in the last one - image bitmap or type array
export default class GlTexture {
  public static createTexture(gl: WebGL2RenderingContext, textureDescription: TextureDescription, activeTexture: number) {
    const { type, samplingConfig, image } = textureDescription;
    const { width, height } = image;
    const imageData: ArrayBufferView | ImageBitmap = (<ImageWithData>image).imageData;
    const texture: WebGLTexture = gl.createTexture();
    const target = GlTexture.determineTarget(gl, textureDescription.type);

    const { internalFormat, texelFormat, texelType } = this.parseTextureTypeFormat(gl, textureDescription, imageData);
    gl.activeTexture(activeTexture);
    if (type === TextureType.TEXTURE_2D) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (imageData instanceof ImageBitmap) {
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, texelFormat, texelType, imageData);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, texelType, texelFormat, imageData);
      }
    } else if (type === TextureType.TEXTURE_ARRAY) {
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
      if (imageData instanceof ImageBitmap) {
        gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, internalFormat, width, height, textureDescription.depth, 0, texelFormat, texelType, imageData);
      } else {
        gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, internalFormat, width, height, textureDescription.depth, 0, texelFormat, texelType, imageData);
      }
      const ext = gl.getExtension('EXT_texture_filter_anisotropic');
      if (ext) {
        const maxAniso = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        console.info(`Activating ${maxAniso}x anisotropic filtering for texture array!`);
        gl.texParameterf(gl.TEXTURE_2D_ARRAY, ext.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
      }

      // gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
      // gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      // gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else if (textureDescription.type === TextureType.CUBE_MAP) {
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
      gl.texStorage2D(gl.TEXTURE_CUBE_MAP, 6, internalFormat, width, height);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    }

    if (samplingConfig) {
      GlSampler.setSamplerFilterToGL(gl, samplingConfig || DefaultSampling, target, gl.texParameteri as GlFunc);
    }
    DebugUtil.glCheckError(gl, texture, 'CREATE', [internalFormat, texelFormat, texelType].map(DebugUtil.glEnumToString));

    return texture!;
  }

  public static writeToTexture(gl: WebGL2RenderingContext, texture: GlTextureCache, updateTexture: UpdateTexture) {
    const {
      x = 0, y = 0, z = 0, glFace,
      data: { channel, width, height, imageData }
    } = updateTexture;

    // const textureFormat = GlTexture.parseTextureFormat(gl, channel.format);
    // const pixelFormat = GlTexture.parsePixelFormat(gl, imageData);
    // const pixelFormat = GlTexture.parsePixelFormat(gl, channel.dataType);
    const { internalFormat, texelType, texelFormat } = this.parseTextureTypeFormat(gl, texture.metaData);

    gl.activeTexture(texture.activeTexture);
    if (texture.metaData.type === TextureType.TEXTURE_2D) {
      gl.bindTexture(gl.TEXTURE_2D, texture.glTexture);
      if (imageData instanceof ImageBitmap) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, width, height, texelFormat, texelType, imageData);
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, width, height, texelFormat, texelType, imageData);
      }
    } else if (texture.metaData.type === TextureType.TEXTURE_ARRAY) {
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture.glTexture);
      if (imageData instanceof ImageBitmap) {
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, x, y, z, width, height, 1, texelFormat, texelType, imageData);
      } else {
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, x, y, z, width, height, 1, texelFormat, texelType, imageData);
      }
    } else if (texture.metaData.type === TextureType.CUBE_MAP) {
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture.glTexture);
      if (imageData instanceof ImageBitmap) {
        gl.texSubImage2D(glFace!, 0, x, y, width, height, texelFormat, texelType, imageData);
      } else {
        gl.texSubImage2D(glFace!, 0, x, y, width, height, texelFormat, texelType, imageData);
      }
    }

    DebugUtil.glCheckError(gl, texture.glTexture, updateTexture, 'UPD ', [internalFormat, texelFormat, texelType].map(DebugUtil.glEnumToString));
  }


  private static parseTextureFormat(gl: WebGL2RenderingContext, format: ImageChannelFormat): GLenum {
    if (format === 'rgba8unorm') {
      return gl.RGBA8;
    } else if (format === 'rgba16float') {
      return gl.RGBA16F;
    } else if (format === 'rgba32float') {
      return gl.RGBA32F;
    } else if (format === 'rgba8unorm-srgb') {
      return gl.SRGB8_ALPHA8;
    } else if (format === 'depth24plus') {
      return gl.DEPTH_COMPONENT24;
    } else if (format === 'depth32float') {
      return gl.DEPTH_COMPONENT32F;
    } else {
      throw new Error(`Unknown texture format: ${format}`);
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

  private static parsePixelFormat(gl: WebGL2RenderingContext, arr?: ArrayBufferView | ImageBitmap) {
    if (arr instanceof ImageBitmap) {
      return gl.FLOAT;
    }
    if (!arr) {
      return gl.UNSIGNED_BYTE;
    } else if (arr.buffer instanceof Uint8Array || arr.buffer instanceof Uint8ClampedArray) {
      return gl.UNSIGNED_BYTE;
    } else if (arr.buffer instanceof Uint32Array) {
      return gl.UNSIGNED_INT;
    } else if (arr.buffer instanceof Float32Array) {
      return gl.FLOAT;
    } else if (arr.buffer instanceof ImageBitmap) {
      return gl.FLOAT;
    } else {
      console.error('arr', arr, arr.buffer);
      throw new Error(`Typed array unknown ${arr}`);
    }
  }

  private static parseTextureTypeFormat(gl: WebGL2RenderingContext, textureDescription: TextureDescription, arr?: ArrayBufferView | ImageBitmap) {
    const { usage, type, image: { channel: { format, dataType }, width, height }, samplingConfig } = textureDescription;
    let internalFormat: GLenum = gl.RGBA8,
      texelType: GLenum = gl.UNSIGNED_BYTE,
      texelFormat: GLenum = gl.RGBA;

    if (arr instanceof ImageBitmap) {
      texelType = gl.FLOAT;
    } else if (arr?.buffer instanceof Uint32Array) {
      texelType = gl.UNSIGNED_INT;
    } else if (arr?.buffer instanceof Float32Array) {
      texelType = gl.FLOAT;
    }
    if (format === 'rgba16float') {
      internalFormat = gl.RGBA16F;
    } else if (format === 'rgba32float') {
      internalFormat = gl.RGBA32F;
    } else if (format === 'rgba8unorm-srgb') {
      internalFormat = gl.SRGB8_ALPHA8;
    } else if (format === 'depth24plus') {
      texelType = gl.UNSIGNED_INT;
      texelFormat = gl.DEPTH_COMPONENT;
      internalFormat = gl.DEPTH_COMPONENT24;
    } else if (format === 'depth32float') {
      texelType = gl.FLOAT;
      texelFormat = gl.DEPTH_COMPONENT;
      internalFormat = gl.DEPTH_COMPONENT32F;
    }

    return { internalFormat, texelType, texelFormat };
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
