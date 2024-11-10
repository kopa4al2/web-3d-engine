import { vec3 } from 'gl-matrix';

export type BoundingVolumeConstructor<T extends BoundingVolume> = new (...args: any[]) => T;
export type BoundingVolumeType = BoundingVolumeConstructor<BoundingVolume>;

export default interface BoundingVolume {
    containsPoint(point: vec3): boolean;

    intersects(bounds: BoundingVolume): boolean;

    getCenter(): vec3;
}