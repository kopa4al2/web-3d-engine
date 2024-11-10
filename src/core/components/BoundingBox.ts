import Component from 'core/components/Component';
import { vec3 } from 'gl-matrix';

export default class BoundingBox implements Component {
    public static readonly ID = Symbol('BoundingBoxComponent');
    public readonly id = BoundingBox.ID;

    constructor(public min: vec3, public max: vec3) {
    }
}