import Component from "./Component";
import { mat4, vec3, quat } from "gl-matrix";

export type ModelMatrix = mat4;
export default class Transform implements Component {
    static readonly ID: symbol = Symbol('TransformComponent');

    readonly id = Transform.ID;

    constructor(public position: vec3, public rotation: vec3, public scale: vec3) {
    }

    public static copyOf(other: Transform) {
        return new Transform(
            vec3.copy(vec3.create(), other.position),
            vec3.copy(vec3.create(), other.rotation),
            vec3.copy(vec3.create(), other.scale)
        );
    }

    public static withPositionV(position: vec3): Transform {
        return new Transform(
            position,
            [0, 0, 0],
            [1, 1, 1]);
    }

    public static withPosition(x: number, y: number, z: number): Transform {

        return new Transform(
            [x, y, z],
            [0, 0, 0],
            [1, 1, 1]);
    }

    createModelMatrix(): ModelMatrix {
        const modelMatrix = mat4.create();
        this.transformMatrix(modelMatrix);
        return modelMatrix;
    }

    transformMatrix(modelMatrix: mat4) {
        const { position, rotation, scale } = this;
        mat4.translate(modelMatrix, modelMatrix, position);
        mat4.rotateX(modelMatrix, modelMatrix, rotation[0]);
        mat4.rotateY(modelMatrix, modelMatrix, rotation[1]);
        mat4.rotateZ(modelMatrix, modelMatrix, rotation[2]);
        mat4.scale(modelMatrix, modelMatrix, scale);
    }

    translateBy(x: number, y: number, z: number) {
        this.position[0] += x;
        this.position[1] += y;
        this.position[2] += z;

        return this;
    }

    translate(value: vec3 | number[] | Float32Array): Transform {
        this.position[0] += value[0];
        this.position[1] += value[1];
        this.position[2] += value[2];

        return this;
    }

    rotate(value: vec3): Transform {
        this.rotation[0] += value[0];
        this.rotation[1] += value[1];
        this.rotation[2] += value[2];

        return this;
    }

    scaleBy(value: vec3 | number): Transform {
        if (typeof value === "number") {
            vec3.scale(this.scale, this.scale, value);
        } else {
            this.scale[0] *= value[0];
            this.scale[1] *= value[1];
            this.scale[2] *= value[2];
        }
        return this;
    }
}

export const defaultTransform = (): Transform => new Transform(
    [0, 0, 0],
    [0, 0, 0],
    [1, 1, 1]
);

export const randomTransform = (): Transform => new Transform(
    [Math.random() * 2, Math.random() * 5, Math.random() * -2],
    [0, 0, 0],
    [1, 1, 1]
);
