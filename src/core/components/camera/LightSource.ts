import Component from "core/components/Component";
import PropertiesManager from "core/PropertiesManager";
import { vec3, vec4 } from "gl-matrix";
import DebugUtil from 'util/DebugUtil';
import MathUtil from "util/MathUtil";

export default class LightSource implements Component {
    static readonly ID: symbol = Symbol('LightSource');
    readonly id = LightSource.ID;


    public static readonly WHITE_LIGHT = vec3.fromValues(1.0, 1.0, 1.0);
    public static readonly WARM_LIGHT = vec3.fromValues(1.0, 0.85, 0.7);
    public static readonly COOL_LIGHT = vec3.fromValues(0.7, 0.85, 1.0);
    public static readonly MOON_LIGHT = vec3.fromValues(0.6, 0.6, 0.9);
    public static readonly NO_LIGHT = vec3.fromValues(0.0, 0.0, 0.0);

    constructor(private properties: PropertiesManager,
                public lightDirection: vec3 = vec3.create(),
                public lightColor: vec3 = LightSource.MOON_LIGHT,
                public intensity = 1.0) {
        DebugUtil.addToWindowObject('lightSource', this);
        // this.lightDirection = vec3.fromValues(50, 100.0, 50);
        this.lightDirection = vec3.fromValues(-14.0, 30.0, 15.0);

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

export interface DirectionalLightOld {
    direction: [number, number, number, number];  // Direction vector (normalized)
    color: [number, number, number, number];      // RGB color of the light
    intensity: number;                    // Brightness multiplier
}


export interface PointLightOld {
    position: [number, number, number, number];  // World-space position of the light
    color: [number, number, number, number];    // RGB color of the light
    intensity: number;                  // Intensity multiplier
    constant: number;                   // Constant attenuation term
    linear: number;                     // Linear attenuation term
    quadratic: number;                  // Quadratic attenuation term
}
