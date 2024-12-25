import { DefaultCacheable } from 'core/components/Cacheable';
import Component, { ComponentId } from 'core/components/Component';
import { quat, vec4 } from "gl-matrix";

export interface SpotLightProps {
    // position: vec4;
    // direction: quat;
    color: vec4;

    innerCutoff: number,
    outerCutoff: number,

    intensity: number;
    constantAttenuation: number;
    linearAttenuation: number;
    quadraticAttenuation: number;
}

class SpotLight extends DefaultCacheable<SpotLightProps> implements Component {
    public static readonly ID = Symbol('SpotLight');
    public static readonly MAX_SPOT_LIGHTS = 4;

    id: ComponentId = SpotLight.ID;

    public hasChanged: boolean = false;

    constructor(props: SpotLightProps) {
        super(props);
        this.hasChanged = true;
    }

    get data() {
        return this._data;
    }

    // get position() {
    //     return this.get('position');
    // }

    get color() {
        return this.get('color');
    }

    get intensity() {
        return this.get('intensity');
    }

    get constantAttenuation() {
        return this.get('constantAttenuation');
    }

    get linearAttenuation() {
        return this.get('linearAttenuation');
    }

    get quadraticAttenuation() {
        return this.get('quadraticAttenuation');
    }
}

export default SpotLight;
