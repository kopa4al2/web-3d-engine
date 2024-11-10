import BoundingVolume from 'core/mesh/BoundingVolume';
import { vec3 } from 'gl-matrix';

export default class BoundingSphere implements BoundingVolume {

    public readonly centerPoint: vec3;
    public readonly radius: number;

    constructor(vertices: number[], indices: number[]) {
        this.centerPoint = this.calculateCenterPoint(indices, vertices);
        this.radius = this.calculateRadius(indices, vertices);
    }

    containsPoint(point: vec3): boolean {
        throw new Error('Method not implemented.');
    }

    intersects(bounds: BoundingVolume): boolean {
        throw new Error('Method not implemented.');
    }

    getCenter(): vec3 {
        return this.centerPoint;
    }

    /**
     * Calculate the centroid (average of all indexed vertices)
     */
    private calculateCenterPoint(indices: number[], vertices: number[]): vec3 {
        let sum = vec3.fromValues(0, 0, 0);

        for (const index of indices) {
            const x = vertices[index * 3];
            const y = vertices[index * 3 + 1];
            const z = vertices[index * 3 + 2];
            sum = vec3.add(sum, sum, vec3.fromValues(x, y, z));
        }

        // Divide by the number of vertices (counted by indices)
        return vec3.scale(vec3.create(), sum, (1 / indices.length));
    }

    /**
     * Calculates the radius as the maximum distance from the center.
     */
    private calculateRadius(indices: number[], vertices: number[]): number {
        let maxDistanceSquared = 0;
        for (const index of indices) {
            const x = vertices[index * 3];
            const y = vertices[index * 3 + 1];
            const z = vertices[index * 3 + 2];
            const distanceSquared = vec3.squaredDistance(this.centerPoint, vec3.fromValues(x, y, z));
            maxDistanceSquared = Math.max(maxDistanceSquared, distanceSquared);
        }
        return Math.sqrt(maxDistanceSquared)
    }
}