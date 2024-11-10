import { VertexBufferId } from 'core/Graphics';
import BoundingVolume, { BoundingVolumeType } from 'core/mesh/BoundingVolume';
import BoundingSphere from 'core/physics/BoundingSphere';
import { VertexLayout, VertexLayoutEntry, VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import { BufferId } from 'core/resources/gpu/BufferDescription';
import { vec3 } from 'gl-matrix';

export interface GeometryData {
    vertices: number[];        // Flat array of vertex positions
    normals: number[];         // Flat array of normals
    texCoords: number[];       // Flat array of texture coordinates
    indices: number[];         // Flat array of indices
}
export interface GeometryDescriptor {
    vertexLayout: VertexLayout,
    vertexShader: VertexShaderName
}

export default class Geometry {

    private readonly boundingVolumes: Map<BoundingVolumeType, BoundingVolume>;

    constructor(public readonly vertexBuffer: VertexBufferId,
                public readonly indexBuffer: BufferId,
                public readonly indices: number,
                public readonly descriptor: GeometryDescriptor) {
        this.boundingVolumes = new Map();
    }

    addBoundingVolume<T extends BoundingVolume>(key: BoundingVolumeType, value: T) {
        this.boundingVolumes.set(key, value);
    }

    getBoundingVolume<T extends BoundingVolume>(key: BoundingVolumeType): T {
        return this.boundingVolumes.get(key) as T;
    }

    /**
     * Check if the point is within the bounding volume.
     * Depending on context decide which bounding volume to use.
     */
    isWithinBounds(point: vec3, context: 'broad' | 'narrow'): boolean {
        // TODO: Rework
        return !!this.boundingVolumes.get(BoundingSphere)?.containsPoint(point);
    }

    equals(other: Geometry) {
        // TODO: check if properties can be passed in different order causing this to not work as expected
        // TODO: We only check if indices are the same, research if we can have the same indices for different attribute count
        return JSON.stringify(this.descriptor) === JSON.stringify(other.descriptor)
            && this.indices == other.indices;
    }
}
