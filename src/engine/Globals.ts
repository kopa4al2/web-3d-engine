import { ImageChannelFormat } from 'core/texture/Texture';

class Globals {
    FRACT_UV_ON_CPU = true;
    
    SHADOW_PASS_DEPTH_FN: 'depth32float' = 'depth32float'
    
    SHADOW_PASS_TEXTURE_SIZE = 1024;

    MAX_SHADOW_CASTING_LIGHTS = 2;
}

export default new Globals();
