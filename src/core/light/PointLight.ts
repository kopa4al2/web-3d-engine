import Component, { ComponentId } from 'core/components/Component';
import { DefaultCacheable } from 'core/components/Cacheable';
import { ColorLike, SdiColor, SdiPoint3D } from "../../types/engine-types/EngineTypes";

export interface PointLightProps {
    position: SdiPoint3D;
    // position: [number, number, number, number];
    color: SdiColor;
    // color: [number, number, number, number];
    intensity: number;
    constantAttenuation: number;
    linearAttenuation: number;
    quadraticAttenuation: number;
}

class PointLight extends DefaultCacheable<PointLightProps> implements Component {
    public static readonly ID = Symbol('PointLight');
    public static readonly MAX_POINT_LIGHTS = 4;

    public static readonly WHITE_LIGHT: SdiColor = new SdiColor([1.0, 1.0, 1.0, 1.0]);
    public static readonly WARM_LIGHT: SdiColor = new SdiColor([1.0, 0.85, 0.7, 1.0]);
    public static readonly COOL_LIGHT: SdiColor = new SdiColor([0.7, 0.85, 1.0, 1.0]);
    public static readonly MOON_LIGHT: SdiColor = new SdiColor(0.6, 0.6, 0.9, 1.0);
    // public static readonly NO_LIGHT = [0.0, 0.0, 0.0, 1.0];

    id: ComponentId = PointLight.ID;

    public hasChanged: boolean = false;

    constructor(props: PointLightProps) {
        super(props);
        this.hasChanged = true;
    }

    get data() {
        return this._data;
    }

    get position() {
        return this.get('position');
    }
    
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

export default PointLight;
