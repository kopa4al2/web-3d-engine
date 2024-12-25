import { mat4, quat, vec3 } from "gl-matrix";
import Component from "./Component";

type Transformations = {
    position: vec3,
    rotation: quat,
    scale: vec3,
    mat4: mat4,
}

export type ModelMatrix = mat4;
export default class Transform implements Component {
    static readonly ID: symbol = Symbol('TransformComponent');

    readonly id = Transform.ID;

    public targetTransform: Transformations;
    public localTransform: Transformations;
    public worldTransform: Transformations;

    constructor(_position: vec3,
                _rotation: quat,
                _scale: vec3,
                public children: Transform[] = [],
                private _parent?: Transform,
                public needsCalculate?: boolean) {
        this.needsCalculate = true;

        this.targetTransform = {
            position: vec3.copy(vec3.create(), _position),
            rotation: quat.copy(quat.create(), _rotation),
            scale: vec3.copy(vec3.create(), _scale),
            mat4: mat4.fromRotationTranslationScale(mat4.create(), _rotation, _position, _scale)
        };
        this.localTransform = {
            position: _position,
            rotation: _rotation,
            scale: _scale,
            mat4: mat4.fromRotationTranslationScale(mat4.create(), _rotation, _position, _scale)
        };
        this.worldTransform = {
            position: vec3.copy(vec3.create(), _position),
            rotation: quat.copy(quat.create(), _rotation),
            scale: vec3.copy(vec3.create(), _scale),
            mat4: mat4.fromRotationTranslationScale(mat4.create(), _rotation, _position, _scale)
        };
    }

    set parent(parent: Transform) {
        this._parent = parent;
        this.multiply(this.worldTransform, parent.localTransform, this.localTransform);
    }

    get parent(): Transform | undefined {
        return this._parent;
    }

    get position() {
        return this.worldTransform.position;
    }

    get rotation() {
        return this.worldTransform.rotation;
    }

    get scale() {
        return this.worldTransform.scale;
    }

    multiply(out: Transformations, matA: Transformations, matB: Transformations) {
        mat4.multiply(out.mat4, matA.mat4, matB.mat4);
        mat4.getTranslation(out.position, out.mat4);
        mat4.getRotation(out.rotation, out.mat4);
        mat4.getScaling(out.scale, out.mat4);
    }

    getWorldMatrix(): ModelMatrix {
        return this.worldTransform.mat4;
    }

    /*createModelMatrix(): ModelMatrix {
        const modelMatrix = mat4.create();
        return mat4.fromRotationTranslationScale(modelMatrix, this.rotation, this.position, this.scale);
    }*/

    restoreInitialTransform() {
        /*if (!this.parent) {
            console.error(this);
            throw new Error('Restore initial was called on a transform without parent!');
        }
        if (!this.localTransform) {
            console.warn('No local transform. Will not restore initial transform');
            this.localTransform = this.createModelMatrix();
            return;
        }*/

        // mat4.getTranslation(this.position, this.localTransform);
        // mat4.getScaling(this.scale, this.localTransform);
        // mat4.getRotation(this.rotation, this.localTransform);
    }

    translate(value: vec3 | number[] | Float32Array): Transform {
        this.targetTransform.position[0] += value[0];
        this.targetTransform.position[1] += value[1];
        this.targetTransform.position[2] += value[2];

        this.localTransform.position[0] += value[0];
        this.localTransform.position[1] += value[1];
        this.localTransform.position[2] += value[2];

        return this;
    }

    scaleBy(value: vec3 | number[] | number): Transform {
        if (typeof value === "number") {
            vec3.scale(this.localTransform.scale, this.localTransform.scale, value);
            vec3.scale(this.targetTransform.scale, this.targetTransform.scale, value);
        } else {
            this.targetTransform.scale[0] *= value[0];
            this.targetTransform.scale[1] *= value[1];
            this.targetTransform.scale[2] *= value[2];

            this.localTransform.scale[0] *= value[0];
            this.localTransform.scale[1] *= value[1];
            this.localTransform.scale[2] *= value[2];
        }
        return this;
    }

    shouldMove() {
        /*if (!vec3.equals(this.targetTransform.position, this.localTransform.position)) {
            console.log('Positions differ', [...this.targetTransform.position, ...this.localTransform.position]);
        }
        if (!quat.equals(this.targetTransform.rotation, this.localTransform.rotation)) {
            console.log('Rotation differ', [...this.targetTransform.rotation, ...this.localTransform.rotation]);
        }
        if (!vec3.equals(this.targetTransform.scale, this.localTransform.scale)) {
            console.log('Scale differ', [...this.targetTransform.scale, ...this.localTransform.scale]);
        }*/

        return !vec3.equals(this.targetTransform.position, this.localTransform.position)
            || !quat.equals(this.targetTransform.rotation, this.localTransform.rotation)
            || !vec3.equals(this.targetTransform.scale, this.localTransform.scale);
    }


    public static copyOf(other: Transform, newTransform?: Partial<Transformations>) {
        const newPos = newTransform?.position || other.localTransform.position;
        const newRot = newTransform?.rotation || other.localTransform.rotation;
        const newScale = newTransform?.scale || other.localTransform.scale;
        return new Transform(
            vec3.copy(vec3.create(), newPos),
            quat.copy(quat.create(), newRot),
            vec3.copy(vec3.create(), newScale),
            other.children,
            other._parent,
            other.needsCalculate
        );
    }

    public static fromMat4(mat: mat4): Transform {
        const position = mat4.getTranslation(vec3.create(), mat);
        const scale = mat4.getScaling(vec3.create(), mat);
        const rotation = mat4.getRotation(quat.create(), mat);

        return new Transform(position, rotation, scale);
    }
}

export const defaultTransform = (): Transform => new Transform(
    vec3.create(),
    quat.create(),
    vec3.fromValues(1, 1, 1),
);