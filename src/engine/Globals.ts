import { ImageChannelFormat } from 'core/texture/Texture';

class Globals {
    FRACT_UV_ON_CPU = true;
    
    SHADOW_PASS_DEPTH_FN: 'depth32float' = 'depth32float'
    
    SHADOW_PASS_TEXTURE_SIZE = 1024;
}

export default new Globals();
