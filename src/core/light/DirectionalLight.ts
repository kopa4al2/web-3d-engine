import Component, { ComponentId } from 'core/components/Component';
import { DefaultCacheable } from 'core/components/Cacheable';

export interface DirectionalLightProps {
    direction: [number, number, number, number],
    color: [number, number, number, number],
    intensity: number,
}

class DirectionalLight extends DefaultCacheable<DirectionalLightProps> implements Component {
    public static readonly ID = Symbol('DirectionalLight');
    public static readonly MAX_DIRECTION_LIGHTS = 2;

    public static readonly WHITE_LIGHT = [1.0, 1.0, 1.0, 1.0];
    public static readonly WARM_LIGHT = [1.0, 0.85, 0.7, 1.0];
    public static readonly COOL_LIGHT = [0.7, 0.85, 1.0, 1.0];
    public static readonly MOON_LIGHT = [0.6, 0.6, 0.9, 1.0];
    public static readonly NO_LIGHT = [0.0, 0.0, 0.0, 1.0];

    id: ComponentId = DirectionalLight.ID;

    public hasChanged: boolean = false;

    constructor(props: DirectionalLightProps) {
        super(props);
        this.hasChanged = true;
    }

    get direction() {
        return this.get('direction');
    }

    get color() {
        return this.get('color');
    }

    get intensity() {
        return this.get('intensity');
    }
}

export default DirectionalLight;
