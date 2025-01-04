
class Globals {

    SHADOW_PASS_DEPTH_FN: 'depth32float' = 'depth32float'

    DEFAULT_DEPTH_FORMAT: 'depth32float' | 'depth24plus' = 'depth32float'

    SHADOW_PASS_TEXTURE_SIZE = 2048;

    MAX_SHADOW_CASTING_LIGHTS = 2;

    ENABLE_DEBUG_SHADOW = false;

    DEBUG_SHADOW_REALTIME = false;
    
    ENABLE_SHADOW_CASTINGS = false;
}

export default new Globals();
