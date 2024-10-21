import Component from "./Component";
import { mat4, vec3, quat } from "gl-matrix";

export default class Transform implements Component {
    static readonly ID: symbol = Symbol('TransformComponent');

    readonly id = Transform.ID;


    constructor(public position: vec3, public rotation: vec3, public scale: vec3, public rotationQuat: quat = quat.create()) {
    }

    public static withPosition(position: vec3): Transform {
        return new Transform(
            position,
            [0, 0, 0],
            [1, 1, 1]);
    }

    createModelMatrix() {
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

    translate(value: vec3): Transform {
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
            throw 'Implement scaling by vector';
        }
        return this;
    }
}

export const defaultTransform = (): Transform => new Transform(
    [0, 0, 0],
    [0, 0, 0],
    [1, 1, 1]
);