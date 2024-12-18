import { mat3, mat4, quat, vec3 } from "gl-matrix";
import Component from "./Component";

export type ModelMatrix = mat4;
export default class Transform implements Component {
    static readonly ID: symbol = Symbol('TransformComponent');

    readonly id = Transform.ID;

    public targetTransform?: Transform;
    private localTransform?: mat4;

    constructor(public position: vec3,
                // private eulerRotation: vec3,
                public rotation: quat,
                public scale: vec3,
                public children?: Transform[],
                public parent?: Transform | null,
                public needsCalculate?: boolean) {
        this.needsCalculate = true;
        if (this.parent) {
            this.localTransform = this.createModelMatrix();
        }
    }

    public static copyOf(other: Transform) {
        return new Transform(
            vec3.copy(vec3.create(), other.position),
            quat.copy(quat.create(), other.rotation),
            vec3.copy(vec3.create(), other.scale),
            other.children,
            other.parent,
            other.needsCalculate
        );
    }

    public static fromMat4Old(mat: mat4): Transform {
        // Extract position
        const position = vec3.fromValues(mat[12], mat[13], mat[14]);

        // Extract scale
        const scale = vec3.fromValues(
            Math.hypot(mat[0], mat[1], mat[2]), // Scale X (length of column 0)
            Math.hypot(mat[4], mat[5], mat[6]), // Scale Y (length of column 1)
            Math.hypot(mat[8], mat[9], mat[10]) // Scale Z (length of column 2)
        );

        // Normalize the rotation part of the matrix by removing the scale
        const rotationMatrix = mat4.create();
        mat4.copy(rotationMatrix, mat);
        rotationMatrix[0] /= scale[0];
        rotationMatrix[1] /= scale[0];
        rotationMatrix[2] /= scale[0];
        rotationMatrix[4] /= scale[1];
        rotationMatrix[5] /= scale[1];
        rotationMatrix[6] /= scale[1];
        rotationMatrix[8] /= scale[2];
        rotationMatrix[9] /= scale[2];
        rotationMatrix[10] /= scale[2];

        // Extract quaternion from the normalized rotation matrix
        const rotation = quat.create();
        quat.fromMat3(rotation, mat3.fromMat4(mat3.create(), rotationMatrix));

        return new Transform(position, rotation, scale);
    }

    public static fromMat4(mat: mat4): Transform {
        const position = mat4.getTranslation(vec3.create(), mat);
        const scale = mat4.getScaling(vec3.create(), mat);
        const rotation = mat4.getRotation(quat.create(), mat);

        return new Transform(position, rotation, scale);
    }

    public static scale(scaleFactor: number): Transform {
        return new Transform(
            vec3.create(),
            quat.create(),
            [scaleFactor, scaleFactor, scaleFactor]);
    }

    createModelMatrix(): ModelMatrix {
        const modelMatrix = mat4.create();
        return mat4.fromRotationTranslationScale(modelMatrix, this.rotation, this.position, this.scale);
        // this.transformMatrix(modelMatrix);
        // return modelMatrix;
    }

    restoreInitialTransform() {
        if (!this.parent) {
            console.error(this);
            throw new Error('Restore initial was called on a transform without parent!');
        }
        if (!this.localTransform) {
            console.warn('No local transform. Will not restore initial transform');
            this.localTransform = this.createModelMatrix();
            return;
        }
        mat4.getTranslation(this.position, this.localTransform);
        mat4.getScaling(this.scale, this.localTransform);
        mat4.getRotation(this.rotation, this.localTransform);
    }

    transformBy(other: Transform) {
        // Combined position
        const combinedPosition = vec3.create();
        vec3.transformQuat(combinedPosition, this.position, other.rotation); // Rotate by parent
        vec3.multiply(combinedPosition, combinedPosition, other.scale);      // Scale by parent
        vec3.add(combinedPosition, combinedPosition, other.position);        // Translate by parent

        // Combined rotation (with normalization)
        const combinedRotation = quat.create();
        quat.multiply(combinedRotation, other.rotation, this.rotation);
        quat.normalize(combinedRotation, combinedRotation); // Ensure quaternion remains normalized

        // Combined scale
        const combinedScale = vec3.create();
        vec3.multiply(combinedScale, other.scale, this.scale);

        // Update current transform
        vec3.copy(this.position, combinedPosition);
        quat.copy(this.rotation, combinedRotation);
        vec3.copy(this.scale, combinedScale);
    }

    // transformByOld(other: Transform) {
    //     const combinedPosition = vec3.create();
    //     vec3.transformQuat(combinedPosition, this.position, other.rotation); // Apply parent rotation
    //     vec3.multiply(combinedPosition, combinedPosition, other.scale);           // Apply parent scale
    //     vec3.add(combinedPosition, combinedPosition, other.position);             // Add parent position
    //
    //     const combinedRotation = quat.create();
    //     quat.multiply(combinedRotation, other.rotation, this.rotation);
    //
    //     const combinedScale = vec3.create();
    //     vec3.multiply(combinedScale, other.scale, this.scale);
    //
    //     this.position = combinedPosition;
    //     this.rotation = combinedRotation;
    //     this.scale = combinedScale;
    //
    // }

    // transformMatrix(modelMatrix: mat4) {
    //     const { position, eulerRotation, scale } = this;
    //     mat4.translate(modelMatrix, modelMatrix, position);
    //     mat4.rotateX(modelMatrix, modelMatrix, eulerRotation[0]);
    //     mat4.rotateY(modelMatrix, modelMatrix, eulerRotation[1]);
    //     mat4.rotateZ(modelMatrix, modelMatrix, eulerRotation[2]);
    //     mat4.scale(modelMatrix, modelMatrix, scale);
    // }
    //
    // translateBy(x: number, y: number, z: number) {
    //     this.position[0] += x;
    //     this.position[1] += y;
    //     this.position[2] += z;
    //
    //     return this;
    // }

    translate(value: vec3 | number[] | Float32Array): Transform {
        this.position[0] += value[0];
        this.position[1] += value[1];
        this.position[2] += value[2];

        return this;
    }

    scaleBy(value: vec3 | number[] | number): Transform {
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
    vec3.create(),
    quat.create(),
    vec3.fromValues(1, 1, 1),
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
