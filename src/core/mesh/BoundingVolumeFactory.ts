import BoundingVolume from 'core/mesh/BoundingVolume';
import { GeometryData, GeometryDescriptor } from 'core/mesh/Geometry';
import BoundingSphere from 'core/physics/BoundingSphere';

export default class BoundingVolumeFactory {

    private constructor() {
    }

    public static createBoundingVolume(geometry: GeometryData): BoundingVolume {
        return new BoundingSphere(geometry.vertices, geometry.indices)
    }

}