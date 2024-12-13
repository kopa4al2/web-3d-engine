import CameraComponent from 'core/components/camera/CameraComponent';
import Component from 'core/components/Component';
import BoundingSphere from 'core/physics/BoundingSphere';
import { mat3, mat4, vec3, vec4 } from 'gl-matrix';
import DebugUtil from 'util/DebugUtil';

export class FrustumPlane {
    constructor(public normal: vec3,
                public distance: number) {
    }

    public distanceToPoint(point: vec3): number {
        return vec3.dot(this.normal, point) + this.distance;
    }
}

export default class Frustum implements Component {
    static readonly ID: symbol = Symbol('Frustum');
    readonly id = Frustum.ID;

    constructor(private planes: FrustumPlane[] = []) {
    }

    isSphereWithinFrustum(sphere: BoundingSphere, viewMatrix: mat4): boolean {
        if (!sphere) {
            // console.warn('No sphere provided to the frustum, will ignore culling');
            return true;
        }

        for (const plane of this.planes) {
            const viewSpaceCenter = vec3.transformMat4(
                vec3.create(),
                sphere.centerPoint, // World space center
                viewMatrix      // Camera view matrix
            );
            if (plane.distanceToPoint(viewSpaceCenter) < -sphere.radius) {
                return false;
            }
        }
        return true;
    }

    public update(viewProjectionMatrix: mat4): void {
        this.planes[0] = this.extractPlane(viewProjectionMatrix, 1, 0, 0, 0); // Left
        this.planes[1] = this.extractPlane(viewProjectionMatrix, -1, 0, 0, 0); // Right
        this.planes[2] = this.extractPlane(viewProjectionMatrix, 0, 1, 0, 0); // Top
        this.planes[3] = this.extractPlane(viewProjectionMatrix, 0, -1, 0, 0); // Bottom
        this.planes[4] = this.extractPlane(viewProjectionMatrix, 0, 0, 1, 0); // Near
        this.planes[5] = this.extractPlane(viewProjectionMatrix, 0, 0, -1, 0); // Far

        this.planes.forEach((plane, i) => {
            const normal = vec3.fromValues(plane.normal[0], plane.normal[1], plane.normal[2]);
            const length = vec3.len(normal);
            // console.log(`Plane ${PlaneToString[i]}: Normal = ${normal},\nLength = ${length},\nDistance = ${plane.distance}`);
        });
    }

    getFrustumCorners(): vec3[] {
        if (this.planes.length === 0) {
            return [];
        }
        const corners = [];

        corners.push(this.intersectPlanes(this.planes[0], this.planes[2], this.planes[4])); // Near Top Left
        corners.push(this.intersectPlanes(this.planes[1], this.planes[2], this.planes[4])); // Near Top Right
        corners.push(this.intersectPlanes(this.planes[0], this.planes[3], this.planes[4])); // Near Bottom Left
        corners.push(this.intersectPlanes(this.planes[1], this.planes[3], this.planes[4])); // Near Bottom Right
        corners.push(this.intersectPlanes(this.planes[0], this.planes[2], this.planes[5])); // Far Top Left
        corners.push(this.intersectPlanes(this.planes[1], this.planes[2], this.planes[5])); // Far Top Right
        corners.push(this.intersectPlanes(this.planes[0], this.planes[3], this.planes[5])); // Far Bottom Left
        corners.push(this.intersectPlanes(this.planes[1], this.planes[3], this.planes[5])); // Far Bottom Right

        return corners;
        // return corners.flatMap(vecs => [...vecs]);
    }

    private intersectPlanesV2(plane1: vec4, plane2: vec4, plane3: vec4): vec3 {
        const normal1 = vec3.fromValues(plane1[0], plane1[1], plane1[2]);
        const normal2 = vec3.fromValues(plane2[0], plane2[1], plane2[2]);
        const normal3 = vec3.fromValues(plane3[0], plane3[1], plane3[2]);

        // Create a matrix from the plane normals
        const mat = mat3.fromValues(
            normal1[0], normal1[1], normal1[2], // Row 1
            normal2[0], normal2[1], normal2[2], // Row 2
            normal3[0], normal3[1], normal3[2]  // Row 3
        );

        // Compute the determinant of the matrix
        const det = mat3.determinant(mat);
        if (Math.abs(det) < 1e-6) {
            console.error("Planes are nearly parallel; no valid intersection.");
            return vec3.create();
            // throw new Error('Planes are parallel not valid');
        }

        // Invert the matrix
        const invMat = mat3.invert(mat3.create(), mat);

        // Create a vector from the negative plane distances
        const distances = vec3.fromValues(-plane1[3], -plane2[3], -plane3[3]);

        // Multiply the inverse matrix by the distances vector
        const intersectionPoint = vec3.create();
        vec3.transformMat3(intersectionPoint, distances, invMat);

        return intersectionPoint;
    }

    private intersectPlanes(plane1: FrustumPlane, plane2: FrustumPlane, plane3: FrustumPlane): vec3 {
        const mat = mat3.fromValues(
            plane1.normal[0], plane1.normal[1], plane1.normal[2], // First row
            plane2.normal[0], plane2.normal[1], plane2.normal[2], // Second row
            plane3.normal[0], plane3.normal[1], plane3.normal[2]  // Third row
        );

        const determinant = mat3.determinant(mat);

        // Check if the determinant is near zero (planes do not intersect cleanly)
        if (Math.abs(determinant) < 1e-6) {
            console.error("Planes do not intersect cleanly");
            return vec3.create(); //todo: should i throw?
        }

        // Invert the matrix
        const invertedMat = mat3.invert(mat3.create(), mat);

        // Create a vector from the plane distances
        const distances = vec3.fromValues(-plane1.distance, -plane2.distance, -plane3.distance);

        // Multiply the inverted matrix by the distances vector
        const intersectionPoint = vec3.create();
        vec3.transformMat3(intersectionPoint, distances, invertedMat);
        return intersectionPoint;
    }

    private extractPlane(matrix: mat4, x: number, y: number, z: number, w: number): FrustumPlane {
        const normal = vec3.fromValues(
            matrix[3] + x * matrix[0],
            // matrix[7] + y * matrix[5],
            // matrix[11] + z * matrix[10]
            matrix[7] + y * matrix[4],
            matrix[11] + z * matrix[8]
        );
        const d = matrix[15] + w * matrix[12];


        const length = vec3.len(normal);
        vec3.scale(normal, normal, 1 / length);

        if (length < 1e-6) {
            console.error('GRESHKA!!!! ', length)
        }

        return new FrustumPlane(normal, d / length);
    }
}

const PlaneToString = ['LEFT', 'RIGHT', 'TOP', 'BOTTOM', 'ZNEAR', 'ZFAR'];
