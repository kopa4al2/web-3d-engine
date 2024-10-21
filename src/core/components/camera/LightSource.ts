import Component from "core/components/Component";
import PropertiesManager from "core/PropertiesManager";
import { vec3, vec4 } from "gl-matrix";
import MathUtil from "util/MathUtil";

export default class LightSource implements Component {
    static readonly ID: symbol = Symbol('LightSource');
    readonly id = LightSource.ID;


    public static readonly WHITE_LIGHT = vec3.fromValues(1.0, 1.0, 1.0);
    public static readonly WARM_LIGHT = vec3.fromValues(1.0, 0.85, 0.7);
    public static readonly COOL_LIGHT = vec3.fromValues(0.7, 0.85, 1.0);
    public static readonly NO_LIGHT = vec3.fromValues(0.0, 0.0, 0.0);

    constructor(private properties: PropertiesManager,
                public lightDirection: vec3 = vec3.create(),
                public lightColor: vec3 = LightSource.WHITE_LIGHT) {
        // this.lightDirection = vec3.fromValues(0.0, 0.0, 3.0);
        // this.lightDirection = vec3.fromValues(10.0, 10.0, 2.0);
        this.lightDirection = vec3.fromValues(0.0, 20.0, -10.0);

        if (properties.getString('gpuApi') === 'webgl2') {
            // this.lightDirection[1] = this.lightDirection[2];
        }

        properties.subscribeToAnyPropertyChange(
            ['gpuApi', 'light'],
            (p) => {
                this.lightDirection[0] = p.get('light.sourceX');
                this.lightDirection[1] = p.get('light.sourceY');
                this.lightDirection[2] = p.get('light.sourceZ');
                // if (p.get('gpuApi') === 'webgl2') {
                //     this.source[2] = -this.source[2];
                // }
            });
    }

    getLightData(scaleColor: number = 1.0): Float32Array {
        return new Float32Array([
            this.lightDirection[0], this.lightDirection[1], this.lightDirection[2], 0.0,
            this.lightColor[0] * scaleColor, this.lightColor[1] * scaleColor, this.lightColor[2] * scaleColor, 1.0,
        ]);
    }
}