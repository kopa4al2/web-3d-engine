import BoundingSphere from 'core/physics/BoundingSphere';
import { mat4, vec3 } from 'gl-matrix';
import MathUtil from 'util/MathUtil';

export class FrustumPlane {
    constructor(public normal: vec3,
                public distance: number) {
    }

    public distanceToPoint(point: vec3): number {
        return vec3.dot(this.normal, point) + this.distance;
    }
}

export default class Frustum {

    constructor(private planes: FrustumPlane[] = []) {
    }

    isSphereWithinFrustum(sphere: BoundingSphere): boolean {
        if (!sphere) {
            // console.warn('No sphere provided to the frustum, will ignore culling');
            return true;
        }

        for (const plane of this.planes) {
            if (plane.distanceToPoint(sphere.centerPoint) < -sphere.radius) {
                console.log('Culling')
                return false;
            }
        }
        return true;
    }

    public update(viewProjectionMatrix: mat4):void {
        this.planes[0] = this.extractPlane(viewProjectionMatrix, 1, 0, 0, 0); // Left
        this.planes[1] = this.extractPlane(viewProjectionMatrix, -1, 0, 0, 0); // Right
        this.planes[2] = this.extractPlane(viewProjectionMatrix, 0, 1, 0, 0); // Top
        this.planes[3] = this.extractPlane(viewProjectionMatrix, 0, -1, 0, 0); // Bottom
        this.planes[4] = this.extractPlane(viewProjectionMatrix, 0, 0, 1, 0); // Near
        this.planes[5] = this.extractPlane(viewProjectionMatrix, 0, 0, -1, 0); // Far
    }

    private extractPlane(matrix: mat4, x: number, y: number, z: number, w: number): FrustumPlane {
        const normal = vec3.fromValues(
            matrix[3] + x * matrix[0],
            matrix[7] + y * matrix[4],
            matrix[11] + z * matrix[8]
        );
        const d = matrix[15] + w * matrix[12];
        const plane = new FrustumPlane(normal, d);
        MathUtil.normalizePlane(plane);
        return plane;
    }
}