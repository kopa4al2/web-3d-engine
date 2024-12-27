import Component, { ComponentId } from 'core/components/Component';
import { DefaultCacheable } from 'core/components/Cacheable';
import { SdiColor, SdiDirection } from "../../types/engine-types/EngineTypes";
import { quat, vec3, vec4 } from 'gl-matrix';

export interface DirectionalLightProps {
    direction: vec4,
    color: SdiColor,
    intensity: number,
}

class DirectionalLight implements Component {
    public static readonly ID = Symbol('DirectionalLight');
    public static readonly MAX_DIRECTION_LIGHTS = 2;

    public static readonly WHITE_LIGHT = [1.0, 1.0, 1.0, 1.0];
    public static readonly WARM_LIGHT = [1.0, 0.85, 0.7, 1.0];
    public static readonly COOL_LIGHT = [0.7, 0.85, 1.0, 1.0];
    public static readonly MOON_LIGHT = [0.6, 0.6, 0.9, 1.0];
    public static readonly NO_LIGHT = [0.0, 0.0, 0.0, 1.0];

    id: ComponentId = DirectionalLight.ID;

    public hasChanged: boolean = false;

    private readonly _data: Float32Array;

    constructor(props: DirectionalLightProps) {
        this.hasChanged = true;
        this._data = new Float32Array(9);
        this._data.set(props.direction, 0);
        this._data.set(props.color.toArray(), 4);
        this._data[8] = props.intensity;
    }

    get data() {
        return this._data;
    }

    get direction() {
        return this._data.subarray(0, 4);
    }

    get color() {
        return this._data.subarray(4, 8);
    }

    get intensity() {
        return this._data[8];
    }

    set intensity(newIntensity: number) {
        this._data[8] = newIntensity;
    }
}

export default DirectionalLight;
