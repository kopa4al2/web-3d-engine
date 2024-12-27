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
        // this.needsCalculate = true;

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

    shouldMove() {
        return !vec3.equals(this.targetTransform.position, this.localTransform.position)
            || !quat.equals(this.targetTransform.rotation, this.localTransform.rotation)
            || !vec3.equals(this.targetTransform.scale, this.localTransform.scale);
    }

    get scale() {
        return this.worldTransform.scale;
    }

    lookAt(target: vec3 | [number, number, number], animate = true) {
        const forward = vec3.sub(vec3.create(), target, this.localTransform.position);
        vec3.normalize(forward, forward);

        let up = Transform.UP;
        // Check if forward is parallel to up
        if (Math.abs(vec3.dot(forward, up)) > 0.99999 && Math.abs(forward[0]) < 0.99999) {
            up = vec3.fromValues(1, 0, 0);
            console.warn('changing UP vector to the X axis', this.label);
        }
        mat4.targetTo(this.targetTransform.mat4, this.localTransform.position, target, up);
        mat4.getTranslation(this.targetTransform.position, this.targetTransform.mat4);
        mat4.getRotation(this.targetTransform.rotation, this.targetTransform.mat4);
        mat4.getScaling(this.targetTransform.scale, this.targetTransform.mat4);

        if (!animate) {
            this.copy(this.localTransform, this.targetTransform);
        }
        return this;

        // // const transform = Transform.fromMat4(matrix);
        // const dot = vec3.dot(Transform.FORWARD, target);
        // if (dot > 0.99999 || dot < -0.99999) {
        //     quat.set(this.targetTransform.rotation, 0, 0, 0, 1);
        //     if (!animate) {
        //         this.needsCalculate = true;
        //         this.copy(this.localTransform, this.targetTransform);
        //     }
        //     return this;
        // }
        //
        // const cross = vec3.cross(vec3.create(), Transform.FORWARD, target);
        // const v1len = vec3.length(Transform.FORWARD);
        // const v2len = vec3.length(target);
        //
        // quat.set(this.targetTransform.rotation,
        //     cross[0],
        //     cross[1],
        //     cross[2],
        //     Math.sqrt(v1len * v1len) * (v2len * v2len) + dot);
        //
        // if (!animate) {
        //     this.needsCalculate = true;
        //     this.copy(this.localTransform, this.targetTransform);
        // }
        //
        // return this;
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
