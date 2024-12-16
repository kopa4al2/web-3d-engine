import { mat4, vec3 } from "gl-matrix";
import Component from "./Component";

export type ModelMatrix = mat4;
export default class Transform implements Component {
    static readonly ID: symbol = Symbol('TransformComponent');

    readonly id = Transform.ID;

    constructor(public position: vec3, public rotation: vec3, public scale: vec3, private mat4?: mat4) {
    }

    public static copyOf(other: Transform) {
        return new Transform(
            vec3.copy(vec3.create(), other.position),
            vec3.copy(vec3.create(), other.rotation),
            vec3.copy(vec3.create(), other.scale)
        );
    }

    public static fromMat4V2(mat: mat4): Transform {
        return new Transform([0, 0, 0], [0, 0, 0], [0, 0, 0], mat);
    }

    public static fromMat4(mat: mat4): Transform {
        const position = vec3.fromValues(mat[12], mat[13], mat[14]);
        // Extract scale
        const scale = vec3.fromValues(
            Math.hypot(mat[0], mat[1], mat[2]),  // Length of the first column
            Math.hypot(mat[4], mat[5], mat[6]),  // Length of the second column
            Math.hypot(mat[8], mat[9], mat[10])  // Length of the third column
        )

        // Remove scale from the rotation matrix
        const rotationMatrix = [
            mat[0] / scale[0], mat[1] / scale[0], mat[2] / scale[0],
            mat[4] / scale[1], mat[5] / scale[1], mat[6] / scale[1],
            mat[8] / scale[2], mat[9] / scale[2], mat[10] / scale[2]
        ];

        // Convert rotation matrix to Euler angles
        const rotation = matrixToEuler(rotationMatrix);

        return new Transform(position, rotation, scale);
    }

    public static withPositionV(position: vec3): Transform {
        return new Transform(
            position,
            [0, 0, 0],
            [1, 1, 1]);
    }

    public static scale(scaleFactor: number): Transform {
        return new Transform(
            [0, 0, 0],
            [0, 0, 0],
            [scaleFactor, scaleFactor, scaleFactor]);
    }

    public static withPosition(x: number, y: number, z: number): Transform {

        return new Transform(
            [x, y, z],
            [0, 0, 0],
            [1, 1, 1]);
    }

    createModelMatrix(): ModelMatrix {
        if (this.mat4) {
            return this.mat4;
        }
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

    scaleBy(value: vec3 | number[] | number): Transform {
        if (typeof value === "number") {
            if (this.mat4) {
                mat4.scale(this.mat4, this.mat4, vec3.fromValues(value, value, value))
                return this;
            }

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


function matrixToEuler(mat: number[]): vec3 {
    const sy = Math.sqrt(mat[0] * mat[0] + mat[1] * mat[1]);
    const singular = sy < 1e-6;

    let x, y, z; // Rotation angles (pitch, yaw, roll)
    if (!singular) {
        x = Math.atan2(mat[7], mat[8]); // Pitch
        y = Math.atan2(-mat[6], sy);   // Yaw
        z = Math.atan2(mat[3], mat[0]); // Roll
    } else {
        x = Math.atan2(-mat[5], mat[4]);
        y = Math.atan2(-mat[6], sy);
        z = 0;
    }

    return vec3.fromValues(x, y, z); // In radians
}
