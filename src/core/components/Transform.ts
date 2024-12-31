import { glMatrix, mat4, quat, vec3 } from "gl-matrix";
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

    public static readonly UP = vec3.fromValues(0, 1, 0);
    public static readonly FORWARD = vec3.fromValues(0, 0, -1);
    public static readonly RIGHT = vec3.fromValues(1, 0, 0);

    public label = 'Unlabeled Transform';

    public targetTransform: Transformations;
    public localTransform: Transformations;
    public worldTransform: Transformations;

    constructor(_position: vec3,
                _rotation: quat,
                _scale: vec3,
                public children: Transform[] = [],
                private _parent?: Transform,
                public needsCalculate: boolean = true) {
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

    get up() {
        return vec3.transformQuat(vec3.create(), Transform.UP, this.worldTransform.rotation);
    }

    get forward() {
        return vec3.transformQuat(vec3.create(), Transform.FORWARD, this.worldTransform.rotation);
    }

    get right() {
        return vec3.transformQuat(vec3.create(), Transform.RIGHT, this.worldTransform.rotation);
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

    transformBy(other: Transform) {
        this.multiply(this.targetTransform, other.localTransform, this.localTransform);
    }

    shouldMove() {
        return !vec3.equals(this.targetTransform.position, this.localTransform.position)
            || !quat.equals(this.targetTransform.rotation, this.localTransform.rotation)
            || !vec3.equals(this.targetTransform.scale, this.localTransform.scale);
    }

    lookAt(target: vec3 | [number, number, number]) {
        mat4.getScaling(this.targetTransform.scale, this.localTransform.mat4);
        mat4.getTranslation(this.targetTransform.position, this.localTransform.mat4);

        const forward = vec3.sub(vec3.create(), target, this.localTransform.position);
        vec3.normalize(forward, forward);

        let up = Transform.UP;
        // Check if forward is parallel to up
        if (Math.abs(vec3.dot(forward, up)) > 0.99999 && Math.abs(forward[0]) < 0.99999) {
            up = vec3.fromValues(1, 0, 0);
            console.warn('changing UP vector to the X axis', this);
        }

        mat4.targetTo(this.targetTransform.mat4, this.localTransform.position, target, up);
        mat4.getRotation(this.targetTransform.rotation, this.targetTransform.mat4);
        // mat4.fromRotationTranslationScale(this.matrix, this.rotation, this.translation, this.scale);

        return this;
        // const forward = vec3.sub(vec3.create(), target, this.localTransform.position);
        // vec3.normalize(forward, forward);
        //
        // const right = vec3.create();
        // vec3.cross(right, Transform.UP, forward);
        // vec3.normalize(right, right);
        //
        // const correctedUp = vec3.create();
        // vec3.cross(correctedUp, forward, right);
        // vec3.normalize(correctedUp, correctedUp);
        //
        // // Build rotation matrix
        // const rotation = mat4.create();
        // mat4.set(rotation,
        //     right[0], correctedUp[0], -forward[0], 0,
        //     right[1], correctedUp[1], -forward[1], 0,
        //     right[2], correctedUp[2], -forward[2], 0,
        //     0, 0, 0, 1
        // );
        //
        // // Build translation matrix
        // const translation = mat4.create();
        // mat4.translate(translation, translation, this.localTransform.position);
        //
        // // Combine translation and rotation
        // const modelMatrix = mat4.create();
        // this.targetTransform.mat4 = mat4.multiply(modelMatrix, translation, rotation);
        // mat4.multiply(this.targetTransform.mat4, translation, rotation);
        // let up = Transform.UP;
        // // Check if forward is parallel to up
        // if (Math.abs(vec3.dot(forward, up)) > 0.99999 && Math.abs(forward[0]) < 0.99999) {
        //     up = vec3.fromValues(1, 0, 0);
        //     console.warn('changing UP vector to the X axis', this.label);
        // }
        // mat4.targetTo(this.targetTransform.mat4, this.localTransform.position, target, up);
        mat4.getTranslation(this.targetTransform.position, this.targetTransform.mat4);
        mat4.getRotation(this.targetTransform.rotation, this.targetTransform.mat4);
        mat4.getScaling(this.targetTransform.scale, this.targetTransform.mat4);

        return this;
    }

    toString(transform: Transformations) {
        // mat4.str(transform.mat4)
        console.group(this.label)
        console.log(`Pos: [${vec3.str(transform.position)}]`)
        console.log(`Rot: [${quat.str(transform.rotation)}]`)
        console.log(`Sca: [${vec3.str(transform.scale)}]`)
        console.groupEnd()
    }

    copy(out: Transformations, toCopy: Transformations) {
        vec3.copy(out.position, toCopy.position);
        quat.copy(out.rotation, toCopy.rotation);
        vec3.copy(out.scale, toCopy.scale);
        mat4.copy(out.mat4, toCopy.mat4);
    }

    multiply(out: Transformations, matA: Transformations, matB: Transformations) {
        mat4.multiply(out.mat4, matA.mat4, matB.mat4);
        mat4.getTranslation(out.position, out.mat4);
        mat4.getRotation(out.rotation, out.mat4);
        mat4.getScaling(out.scale, out.mat4);
    }

    getMatrix(): ModelMatrix {
        return mat4.fromRotationTranslationScale(mat4.create(), this.worldTransform.rotation, this.worldTransform.position, this.worldTransform.scale);
        // return this.worldTransform.mat4;
    }

    rotateByEuler(x: number, y: number, z: number): Transform {
        quat.fromEuler(this.targetTransform.rotation, x, y, z);
        quat.fromEuler(this.localTransform.rotation, x, y, z);

        return this;
    }

    translate(value: vec3 | number[] | Float32Array): Transform {
        this.targetTransform.position[0] += value[0];
        this.targetTransform.position[1] += value[1];
        this.targetTransform.position[2] += value[2];

        this.localTransform.position[0] += value[0];
        this.localTransform.position[1] += value[1];
        this.localTransform.position[2] += value[2];

        this.recalculateMat4(this.targetTransform);
        this.recalculateMat4(this.localTransform);
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

        this.recalculateMat4(this.targetTransform);
        this.recalculateMat4(this.localTransform);

        return this;
    }

    private recalculateMat4(transform: Transformations) {
        mat4.fromRotationTranslationScale(transform.mat4, transform.rotation, transform.position, transform.scale);
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
    quat.fromValues(0, 0, 0, 1),
    vec3.fromValues(1, 1, 1),
);


export class TransformBuilder {

    public matrix = mat4.create();

    constructor(public translation = vec3.fromValues(0, 0, 0),
                public rotation = quat.fromValues(0, 0, 0, 1),
                public scale = vec3.fromValues(1, 1, 1),
                public children = [],
                public parent?: Transform
    ) {
        this.matrix = mat4.fromRotationTranslationScale(mat4.create(), rotation, translation, scale);
    }

    static position(pos: vec3) {
        return new TransformBuilder(pos);
    }

    static rotation(quat: quat) {
        return new TransformBuilder(vec3.create(), quat);
    }

    lookAt(target: vec3 | [number, number, number]) {
        mat4.getScaling(this.scale, this.matrix);
        mat4.getTranslation(this.translation, this.matrix);

        const forward = vec3.sub(vec3.create(), target, this.translation);
        vec3.normalize(forward, forward);

        let up = Transform.UP;
        // Check if forward is parallel to up
        if (Math.abs(vec3.dot(forward, up)) > 0.99999 && Math.abs(forward[0]) < 0.99999) {
            up = vec3.fromValues(1, 0, 0);
            console.warn('changing UP vector to the X axis', this);
        }

        mat4.targetTo(this.matrix, this.translation, target, up);
        mat4.getRotation(this.rotation, this.matrix);
        mat4.fromRotationTranslationScale(this.matrix, this.rotation, this.translation, this.scale);

        return this;
    }

    translate(value: vec3 | number[] | Float32Array): TransformBuilder {
        // this.translation[0] += value[0];
        // this.translation[1] += value[1];
        // this.translation[2] += value[2];

        mat4.translate(this.matrix, this.matrix, value as vec3);

        return this;
    }

    scaleBy(value: vec3 | number[] | number): TransformBuilder {
        if (typeof value === "number") {
            mat4.scale(this.matrix, this.matrix, vec3.scale(this.scale, this.scale, value));
        } else {
            mat4.scale(this.matrix, this.matrix, value as vec3);
        }
        //     vec3.scale(this.scale, this.scale, value);
        // } else {
        //     this.scale[0] *= value[0];
        //     this.scale[1] *= value[1];
        //     this.scale[2] *= value[2];
        // }

        return this;
    }

    reorient(): TransformBuilder {
        const right = vec3.create();
        vec3.cross(right, Transform.FORWARD, Transform.UP);
        vec3.normalize(right, right);

        // Recompute up to ensure orthogonality
        vec3.cross(Transform.UP, right, Transform.FORWARD);
        vec3.normalize(Transform.UP, Transform.UP);

        // Create the orientation matrix
        const rotationMatrix = mat4.create();
        mat4.set(
            rotationMatrix,
            right[0], Transform.UP[0], Transform.FORWARD[0], 0,
            right[1], Transform.UP[1], Transform.FORWARD[1], 0,
            right[2], Transform.UP[2], Transform.FORWARD[2], 0,
            0, 0, 0, 1
        );

        // Combine with the existing model matrix
        const newModelMatrix = mat4.create();
        this.matrix = mat4.multiply(newModelMatrix, rotationMatrix, this.matrix);
        return this;
    }

    build(): Transform {
        return new Transform(
            mat4.getTranslation(this.translation, this.matrix),
            mat4.getRotation(this.rotation, this.matrix),
            mat4.getScaling(this.scale, this.matrix),
            this.children, this.parent);
    }
}
