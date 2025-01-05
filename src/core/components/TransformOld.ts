import { mat4, quat, vec3 } from 'gl-matrix';
import Component from './Component';

type Transformations = {
  position: vec3,
  rotation: quat,
  scale: vec3,
  mat4: mat4,
}

export type ModelMatrix = mat4;
export default class TransformOld implements Component {
  static readonly ID: symbol = Symbol('TransformComponent');

  readonly id = TransformOld.ID;

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
              public children: TransformOld[] = [],
              private _parent?: TransformOld,
              _label?: string,
              public needsCalculate: boolean  = true) {
    if (_label) {
      this.label = _label;
    }
    this.targetTransform = {
      position: vec3.create(),
      rotation: quat.create(),
      scale: vec3.create(),
      mat4: mat4.create(),
      // position: vec3.copy(vec3.create(), _position),
      // rotation: quat.copy(quat.create(), _rotation),
      // scale: vec3.copy(vec3.create(), _scale),
      // mat4: mat4.fromRotationTranslationScale(mat4.create(), _rotation, _position, _scale)
    };

    this.localTransform = {
      position: _position,
      rotation: _rotation,
      scale: _scale,
      mat4: mat4.fromRotationTranslationScale(mat4.create(), _rotation, _position, _scale)
    };

    this.worldTransform = {
      // position: vec3.create(),
      // rotation: quat.create(),
      // scale: vec3.create(),
      // mat4: mat4.create(),
      position: vec3.copy(vec3.create(), _position),
      rotation: quat.copy(quat.create(), _rotation),
      scale: vec3.copy(vec3.create(), _scale),
      mat4: mat4.fromRotationTranslationScale(mat4.create(), _rotation, _position, _scale)
    };
  }

  // reorient(): Transform {
  //   const right = vec3.create();
  //   vec3.cross(right, Transform.FORWARD, Transform.UP);
  //   vec3.normalize(right, right);
  //
  //   // Recompute up to ensure orthogonality
  //   const up = vec3.cross(vec3.create(), right, Transform.FORWARD);
  //   vec3.normalize(up, up);
  //
  //   // Create the orientation matrix
  //   const rotationMatrix = mat4.create();
  //   mat4.set(
  //     rotationMatrix,
  //     right[0], up[0], Transform.FORWARD[0], 0,
  //     right[1], up[1], Transform.FORWARD[1], 0,
  //     right[2], up[2], Transform.FORWARD[2], 0,
  //     0, 0, 0, 1
  //   );
  //
  //   // Combine with the existing model matrix
  //   const newModelMatrix = mat4.create();
  //   // this.localTransform.mat4 = mat4.multiply(newModelMatrix, rotationMatrix, this.localTransform.mat4);
  //   // this.targetTransform.mat4 = mat4.multiply(newModelMatrix, rotationMatrix, this.targetTransform.mat4);
  //   // this.worldTransform.mat4 = mat4.multiply(newModelMatrix, rotationMatrix, this.worldTransform.mat4);
  //   return this;
  // }

  get up() {
    return vec3.transformQuat(vec3.create(), TransformOld.UP, this.worldTransform.rotation);
  }

  get forward() {
    return vec3.transformQuat(vec3.create(), TransformOld.FORWARD, this.worldTransform.rotation);
  }

  get right() {
    return vec3.transformQuat(vec3.create(), TransformOld.RIGHT, this.worldTransform.rotation);
  }

  set parent(parent: TransformOld) {
    // this.needsCalculate = true;
    this._parent = parent;
    // this.multiply(this.worldTransform, parent.localTransform.mat4, this.localTransform.mat4);
  }

  get parent(): TransformOld | undefined {
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

  transformBy(other: TransformOld) {
    // this.needsCalculate = true;
    this.multiply(this.localTransform, other.worldTransform.mat4, this.localTransform.mat4);
    // this.multiply(this.targetTransform, other.worldTransform.mat4, this.localTransform.mat4);
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

    let up = vec3.copy(vec3.create(), TransformOld.UP);
    // Check if forward is parallel to up
    if (Math.abs(vec3.dot(forward, up)) > 0.99999 && Math.abs(forward[0]) < 0.99999) {
      up = vec3.fromValues(1, 0, 0);
      console.debug('changing UP vector to the X axis', this);
    }

    mat4.targetTo(this.targetTransform.mat4, this.localTransform.position, target, up);
    mat4.getRotation(this.targetTransform.rotation, this.targetTransform.mat4);
    // mat4.getScaling(this.targetTransform.scale, this.targetTransform.mat4);
    // mat4.getTranslation(this.targetTransform.position, this.targetTransform.mat4);

    return this;
  }

  toString(transform?: Transformations) {
    if (!transform) {
      this.toString(this.worldTransform);
      return;
    }
    // mat4.str(transform.mat4)
    console.group(this.label);
    console.log(`Pos: [${vec3.str(transform.position)}]`);
    console.log(`Rot: [${quat.str(transform.rotation)}]`);
    console.log(`Sca: [${vec3.str(transform.scale)}]`);
    console.groupEnd();
  }

  copy(out: Transformations, toCopy: Transformations) {
    vec3.copy(out.position, toCopy.position);
    quat.copy(out.rotation, toCopy.rotation);
    vec3.copy(out.scale, toCopy.scale);
    mat4.copy(out.mat4, toCopy.mat4);
    // out.position = mat4.getTranslation(out.position, out.mat4);
    // out.rotation = mat4.getRotation(out.rotation, out.mat4);
    // out.scale = mat4.getScaling(out.scale, out.mat4);
  }

  multiply(out: Transformations, matA: mat4, matB: mat4) {
    mat4.multiply(out.mat4, matA, matB);
    mat4.getTranslation(out.position, out.mat4);
    mat4.getRotation(out.rotation, out.mat4);
    mat4.getScaling(out.scale, out.mat4);
  }
  /*multiply(out: Transformations, matA: Transformations, matB: Transformations) {
    mat4.multiply(out.mat4, matA.mat4, matB.mat4);
    mat4.getTranslation(out.position, out.mat4);
    mat4.getRotation(out.rotation, out.mat4);
    mat4.getScaling(out.scale, out.mat4);
  }*/

  getMatrix(): ModelMatrix {
    return mat4.fromRotationTranslationScale(mat4.create(), this.worldTransform.rotation, this.worldTransform.position, this.worldTransform.scale);
    // return this.worldTransform.mat4;
  }

  rotateByEuler(x: number, y: number, z: number): TransformOld {
    quat.fromEuler(this.targetTransform.rotation, x, y, z);
    quat.fromEuler(this.localTransform.rotation, x, y, z);

    return this;
  }

  translate(value: vec3 | number[] | Float32Array): TransformOld {
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

  scaleBy(value: vec3 | number[] | number): TransformOld {
    if (typeof value === 'number') {
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

  public static copyOf(other: TransformOld, newTransform?: Partial<Transformations>) {
    const newPos = newTransform?.position || other.localTransform.position;
    const newRot = newTransform?.rotation || other.localTransform.rotation;
    const newScale = newTransform?.scale || other.localTransform.scale;
    return new TransformOld(
      vec3.copy(vec3.create(), newPos),
      quat.copy(quat.create(), newRot),
      vec3.copy(vec3.create(), newScale),
      other.children,
      other._parent,
      other.label,
      other.needsCalculate
    );
  }

  fromMat4(out: Transformations, mat: mat4) {
    mat4.getTranslation(out.position, mat);
    mat4.getScaling(out.scale, mat);
    mat4.getRotation(out.rotation, mat);

    mat4.copy(out.mat4, mat);

    return this;
  }

  public static fromMat4(mat: mat4): TransformOld {
    const position = mat4.getTranslation(vec3.create(), mat);
    const scale = mat4.getScaling(vec3.create(), mat);
    const rotation = mat4.getRotation(quat.create(), mat);

    // const transform = new Transform(position, rotation, scale);
    // mat4.copy(transform.localTransform.mat4, mat);
    // mat4.copy(transform.worldTransform.mat4, mat);
    // mat4.copy(transform.targetTransform.mat4, mat);

    return new TransformOld(position, rotation, scale);
  }
}

export const defaultTransform = (): TransformOld => new TransformOld(
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
              public parent?: TransformOld
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

    let up = TransformOld.UP;
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
    vec3.cross(right, TransformOld.FORWARD, TransformOld.UP);
    vec3.normalize(right, right);

    // Recompute up to ensure orthogonality
    const up = vec3.cross(vec3.create(), right, TransformOld.FORWARD);
    vec3.normalize(up, up);

    // Create the orientation matrix
    const rotationMatrix = mat4.create();
    mat4.set(
      rotationMatrix,
      right[0], up[0], TransformOld.FORWARD[0], 0,
      right[1], up[1], TransformOld.FORWARD[1], 0,
      right[2], up[2], TransformOld.FORWARD[2], 0,
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

  build(): TransformOld {
    return new TransformOld(
      mat4.getTranslation(this.translation, this.matrix),
      mat4.getRotation(this.rotation, this.matrix),
      mat4.getScaling(this.scale, this.matrix),
      this.children, this.parent, this._label);
  }
}
