
class Globals {

    SHADOW_PASS_DEPTH_FN: 'depth32float' = 'depth32float'

    DEFAULT_DEPTH_FORMAT: 'depth32float' | 'depth24plus' = 'depth32float'

    SHADOW_PASS_TEXTURE_SIZE = 512;

    MAX_SHADOW_CASTING_LIGHTS = 1;

    ENABLE_DEBUG_SHADOW = false;
    
    ENABLE_SHADOW_CASTINGS = true;
}

export default new Globals();
