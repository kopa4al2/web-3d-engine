import BoundingVolume from 'core/mesh/BoundingVolume';
import { vec3 } from 'gl-matrix';

export default class BoundingSphere implements BoundingVolume {

    public readonly centerPoint: vec3;
    public readonly radius: number;

    constructor(vertices: ArrayLike<number>, indices: ArrayLike<number>) {
        const sphere = calculateBoundingSphere(vertices);
        this.centerPoint = vec3.fromValues(sphere.center[0], sphere.center[1], sphere.center[2]);
        this.radius = sphere.radius;
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
}


function calculateBoundingSphere(vertices: ArrayLike<number>) {
    let center = [0, 0, 0];
    const count = vertices.length / 3;

    // Compute center
    for (let i = 0; i < vertices.length; i += 3) {
        center[0] += vertices[i];
        center[1] += vertices[i + 1];
        center[2] += vertices[i + 2];
    }
    center = center.map(coord => coord / count);

    // Compute radius
    let maxRadiusSquared = 0;
    for (let i = 0; i < vertices.length; i += 3) {
        const dx = vertices[i] - center[0];
        const dy = vertices[i + 1] - center[1];
        const dz = vertices[i + 2] - center[2];
        const distSquared = dx * dx + dy * dy + dz * dz;
        maxRadiusSquared = Math.max(maxRadiusSquared, distSquared);
    }
    const radius = Math.sqrt(maxRadiusSquared);

    return { center, radius };
}
