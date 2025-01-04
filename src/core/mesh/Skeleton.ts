import Component, { ComponentId } from 'core/components/Component';
import { EntityId } from 'core/EntityManager';
import { mat4 } from 'gl-matrix';
import { BindGroupHelper } from 'core/rendering/Helpers';

export default class Skeleton implements Component {
  public static readonly ID = Symbol('SkeletonComponent');
  readonly id: ComponentId = Skeleton.ID;

  // constructor(public name: string, public joints: EntityId[], public inverseBindMatrices: mat4[]) {
  // }

  constructor(public name: string,
              public joints: EntityId[],
              private _inverseBindMatrices: ArrayBuffer,
              public bindGroup?: BindGroupHelper) {
  }

  set inverseBindMatrices(inverseBindMatrices: ArrayBuffer) {
    this._inverseBindMatrices = inverseBindMatrices;
  }

  get inverseBindMatrices(): ArrayBuffer {
    return this._inverseBindMatrices!;
  }
}