import { mat4, quat, vec3 } from 'gl-matrix';
import Component from './Component';

export type Transformations = {
  translation: vec3,
  rotation: quat,
  scale: vec3,
}

export type ModelMatrix = mat4;
export default class Transform implements Component {
  static readonly ID: symbol = Symbol('TransformComponent');

  readonly id = Transform.ID;

  public static readonly UP = vec3.fromValues(0, 1, 0);
  public static readonly FORWARD = vec3.fromValues(0, 0, -1);
  public static readonly RIGHT = vec3.fromValues(1, 0, 0);

  public localTransform: Transformations;
  public worldTransform: Transformations;

  private localMat4Cache: mat4 = mat4.create();
  private worldMat4Cache: mat4 = mat4.create();

  constructor(localTranslation: vec3,
              localRotation: quat,
              localScale: vec3,
              public children: Transform[]   = [],
              private _parent?: Transform,
              public label                   = 'Unlabeled Transform',
              public needsCalculate: boolean = true) {

    this.localTransform = {
      translation: localTranslation,
      rotation: localRotation,
      scale: localScale,
    };

    this.worldTransform = {
      translation: vec3.create(),
      rotation: quat.create(),
      scale: vec3.fromValues(1, 1, 1),
    };
  }

  get localMatrix() {
    mat4.identity(this.localMat4Cache);
    return mat4.fromRotationTranslationScale(this.localMat4Cache, this.localTransform.rotation, this.localTransform.translation, this.localTransform.scale);
  }

  get worldMatrix() {
    mat4.identity(this.worldMat4Cache);
    return mat4.fromRotationTranslationScale(this.worldMat4Cache, this.worldTransform.rotation, this.worldTransform.translation, this.worldTransform.scale);
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
  }

  get parent(): Transform | undefined {
    return this._parent;
  }

  get position() {
    return this.worldTransform.translation;
  }

  get rotation() {
    return this.worldTransform.rotation;
  }

  get scale() {
    return this.worldTransform.scale;
  }

  toString(transform?: Transformations) {
    if (!transform) {
      this.toString(this.worldTransform);
      return;
    }
    // mat4.str(transform.mat4)
    console.group(this.label);
    console.log(`Pos: [${vec3.str(transform.translation)}]`);
    console.log(`Rot: [${quat.str(transform.rotation)}]`);
    console.log(`Sca: [${vec3.str(transform.scale)}]`);
    console.groupEnd();
  }

  copy(out: Transformations, toCopy: Transformations) {
    vec3.copy(out.translation, toCopy.translation);
    quat.copy(out.rotation, toCopy.rotation);
    vec3.copy(out.scale, toCopy.scale);

  }

  public static fromMat4(mat: mat4): Transform {
    const position = mat4.getTranslation(vec3.create(), mat);
    const scale = mat4.getScaling(vec3.create(), mat);
    const rotation = mat4.getRotation(quat.create(), mat);

    return new Transform(position, rotation, scale);
  }

  public static fromLocalAndWorldMatrix(localMatrix: mat4, worldMatrix: mat4): Transform {
    const transform = new Transform(
      mat4.getTranslation(vec3.create(), localMatrix),
      mat4.getRotation(quat.create(), localMatrix),
      mat4.getScaling(vec3.create(), localMatrix));

    mat4.getTranslation(transform.worldTransform.translation, worldMatrix);
    mat4.getRotation(transform.worldTransform.rotation, worldMatrix);
    mat4.getScaling(transform.worldTransform.scale, worldMatrix);

    return transform;
  }

  multiply(out: Transformations, matA: Transformations, matB: Transformations) {
    const a = mat4.fromRotationTranslationScale(mat4.create(), matA.rotation, matA.translation, matA.scale);
    const b = mat4.fromRotationTranslationScale(mat4.create(), matB.rotation, matB.translation, matB.scale);
    const c = mat4.multiply(mat4.create(), a, b);
    out.translation = mat4.getTranslation(out.translation, c);
    out.rotation = mat4.getRotation(out.rotation, c);
    out.scale = mat4.getScaling(out.scale, c);
  }
}

export const defaultTransform = (): Transform => new Transform(
  vec3.create(),
  quat.fromValues(0, 0, 0, 1),
  vec3.fromValues(1, 1, 1),
);


export class TransformBuilder {

  public matrix = mat4.create();
  private _label?: string;

  constructor(public translation = vec3.fromValues(0, 0, 0),
              public rotation    = quat.fromValues(0, 0, 0, 1),
              public scale       = vec3.fromValues(1, 1, 1),
              public children    = [],
              public parent?: Transform
  ) {
    this.matrix = mat4.fromRotationTranslationScale(mat4.create(), rotation, translation, scale);
  }

  static scale(scale: vec3) {
    return new TransformBuilder(vec3.create(), quat.create(), scale);
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
      console.debug('changing UP vector to the X axis', this);
    }

    mat4.targetTo(this.matrix, this.translation, target, up);
    mat4.getRotation(this.rotation, this.matrix);
    mat4.fromRotationTranslationScale(this.matrix, this.rotation, this.translation, this.scale);

    return this;
  }

  translate(value: vec3 | number[] | Float32Array): TransformBuilder {
    mat4.translate(this.matrix, this.matrix, value as vec3);

    return this;
  }

  scaleBy(value: vec3 | number[] | number): TransformBuilder {
    if (typeof value === 'number') {
      mat4.scale(this.matrix, this.matrix, vec3.scale(this.scale, this.scale, value));
    } else {
      mat4.scale(this.matrix, this.matrix, value as vec3);
    }

    return this;
  }

  reorient(): TransformBuilder {
    const right = vec3.create();
    vec3.cross(right, Transform.FORWARD, Transform.UP);
    vec3.normalize(right, right);

    // Recompute up to ensure orthogonality
    const up = vec3.cross(vec3.create(), right, Transform.FORWARD);
    vec3.normalize(up, up);

    // Create the orientation matrix
    const rotationMatrix = mat4.create();
    mat4.set(
      rotationMatrix,
      right[0], up[0], Transform.FORWARD[0], 0,
      right[1], up[1], Transform.FORWARD[1], 0,
      right[2], up[2], Transform.FORWARD[2], 0,
      0, 0, 0, 1
    );

    // Combine with the existing model matrix
    const newModelMatrix = mat4.create();
    this.matrix = mat4.multiply(newModelMatrix, rotationMatrix, this.matrix);
    return this;
  }

  label(label: string) {
    this._label = label;

    return this;
  }

  build(): Transform {
    return new Transform(
      mat4.getTranslation(this.translation, this.matrix),
      mat4.getRotation(this.rotation, this.matrix),
      mat4.getScaling(this.scale, this.matrix),
      this.children, this.parent, this._label);
  }
}
