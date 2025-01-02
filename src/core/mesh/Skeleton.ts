import Component, { ComponentId } from "core/components/Component";
import { EntityId } from "core/EntityManager";
import { mat4 } from "gl-matrix";

export default class Skeleton implements Component {
    public static readonly ID = Symbol('SkeletonComponent');
    readonly id: ComponentId = Skeleton.ID;

    constructor(public name: string, public joints: EntityId[], public inverseBindMatrices: mat4[]) {
    }


}