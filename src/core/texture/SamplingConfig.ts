import { TextureId } from "core/texture/Texture";

export type SamplerFilter = 'nearest' | 'linear'
export type SamplerAddressMode = 'clamp-to-edge' | 'repeat' | 'mirror-repeat';

export type SamplerType = 'filtering' | 'non-filtering' | 'comparison';
export default interface SamplingConfig {
    label?: string,
    mipmapFilter?: SamplerFilter,
    magFilter: SamplerFilter
    minFilter: SamplerFilter,
    addressModeU: SamplerAddressMode,
    addressModeV: SamplerAddressMode,
    addressModeW?: SamplerAddressMode,
    // TODO: Hack for webgl
    targetTexture?: TextureId,
}

export const DefaultSampling: SamplingConfig = {
    label: 'default',
    minFilter: 'linear',
    magFilter: 'linear',
    addressModeU: 'repeat',
    addressModeV: 'repeat',
} as const;