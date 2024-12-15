import SamplingConfig, { SamplerAddressMode, SamplerFilter } from "core/texture/SamplingConfig";
import { SamplerId } from "core/texture/Texture";

export type GlTarget = number | WebGLSampler;
export type GlFunc = (target: GlTarget, name: GLenum, value: number) => void;
export default class GlSampler {

    public static createSampler(gl: WebGL2RenderingContext, samplerProperties: SamplingConfig): WebGLSampler {
        const glSampler = gl.createSampler() as WebGLSampler;
        GlSampler.setSamplerFilterToGL(gl, samplerProperties, glSampler, gl.samplerParameteri);
        return glSampler;
    }

    public static samplerAddressModeToGL(gl: WebGL2RenderingContext, addressMode: SamplerAddressMode) {
        if (addressMode === 'clamp-to-edge') {
            return gl.CLAMP_TO_EDGE;
        } else if (addressMode === 'repeat') {
            return gl.REPEAT;
        } else if (addressMode === 'mirror-repeat') {
            return gl.MIRRORED_REPEAT;
        } else {
            throw new Error(`Unknown sampler address mode: ${ addressMode }`)
        }
    }

    public static samplerFilterToGL(gl: WebGL2RenderingContext, filter: SamplerFilter, mipmapFilter?: SamplerFilter) {
        // // TODO: Temporary disable mipmap filtering
        // if (filter === 'linear') {
        //     return gl.LINEAR;
        // } else if (filter === 'nearest') {
        //     return gl.NEAREST;
        // } else {
        //     throw new Error(`Unknown sampler filter: ${ filter }`);
        // }
        if (mipmapFilter === 'linear' && filter === 'linear') {
            return gl.LINEAR_MIPMAP_LINEAR;
        } else if (mipmapFilter === 'nearest' && filter === 'linear') {
            return gl.NEAREST_MIPMAP_LINEAR;
        } else if (mipmapFilter === 'linear' && filter === 'nearest') {
            return gl.LINEAR_MIPMAP_NEAREST;
        } else if (mipmapFilter === 'nearest' && filter === 'nearest') {
            return gl.NEAREST_MIPMAP_NEAREST;
        } else if (filter === 'linear') {
            return gl.LINEAR;
        } else if (filter === 'nearest') {
            return gl.NEAREST;
        } else {
            throw new Error(`Unknown sampler filter: ${ filter }`);
        }
    };

    public static setSamplerFilterToGL(gl: WebGL2RenderingContext, samplerProps: SamplingConfig, target: GlTarget, fn: GlFunc) {
        fn = fn.bind(gl);
        const { minFilter, magFilter, mipmapFilter, addressModeU, addressModeV } = samplerProps;
        if (minFilter) {
            fn(target, gl.TEXTURE_MIN_FILTER, GlSampler.samplerFilterToGL(gl, minFilter, mipmapFilter));
        }
        if (magFilter) {
            // console.warn('Texture mag filter: ', GlSampler.samplerFilterToGL(gl, magFilter, mipmapFilter));
            // TODO: This does not work with mipmap
            fn(target, gl.TEXTURE_MAG_FILTER, GlSampler.samplerFilterToGL(gl, minFilter, mipmapFilter));
        }
        if (addressModeU) {
            fn(target, gl.TEXTURE_WRAP_S, GlSampler.samplerAddressModeToGL(gl, addressModeU));
        }
        if (addressModeV) {
            fn(target, gl.TEXTURE_WRAP_T, GlSampler.samplerAddressModeToGL(gl, addressModeV));
        }
    };
}
