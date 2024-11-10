import { mat3, mat4, vec2, vec3, vec4 } from "gl-matrix";

// export interface Frustum extends Iterable<vec4>{
//     left: vec4,
//     right: vec4,
//     near: vec4,
//     far: vec4,
//     top: vec4,
//     bottom: vec4
// }

class MathUtil {
    clamp(value: number, min: number, max: number) {
        return Math.max(min, Math.min(value, max));
        // return Math.min(Math.max(value, min), max);
    }

    interpolate(out: Float32Array, start: Float32Array, end: Float32Array, progress: number) {
        for (let i = 0; i < start.length; i++) {
            out[i] = start[i] + (end[i] - start[i]) * progress;
        }
    }

    lerp(start: number, end: number, factor: number) {
        return start + factor * (end - start); // Linear interpolation
    }

    vec4(vec3: vec3, w: number) {
        return vec4.fromValues(vec3[0], vec3[1], vec3[2], w);
    }

    mat4(mat3: mat3): Float32Array {
        const paddedMat4 = mat4.create() as Float32Array;

        // Copy the mat3 values into the top-left 3x3 portion of the mat4
        paddedMat4[0] = mat3[0];
        paddedMat4[1] = mat3[1];
        paddedMat4[2] = mat3[2];
        paddedMat4[4] = mat3[3];
        paddedMat4[5] = mat3[4];
        paddedMat4[6] = mat3[5];
        paddedMat4[8] = mat3[6];
        paddedMat4[9] = mat3[7];
        paddedMat4[10] = mat3[8];

        // mat4[12] = 0, mat4[13] = 0, mat4[14] = 0, mat4[15] = 1;
        // mat4[12], mat4[13], mat4[14], and mat4[15] remain as the identity row (0, 0, 0, 1)

        return paddedMat4;
    }

    mousePosToNdc(mousePos: vec2, width: number, height: number, out: vec2 = vec2.create()) {
        out[0] = (mousePos[0] / width) * 2 - 1; // Normalize to [-1, 1]
        out[1] = (1 - mousePos[1] / height) * 2 - 1; // Flip y-axis and normalize
        return out;
    }

    ndcToView(ndc: vec2, inverseProjectionMatrix: mat4, out = vec4.create()) {
        // const ndcPoint = [ndc[0], ndc[1], -1, 1]; // Near-plane point in NDC with homogeneous coordinate
        const ndcPoint = vec4.fromValues(ndc[0], ndc[1], -1, 1); // Near-plane point in NDC with homogeneous coordinate
        // const viewPoint = vec4.transformMat4(out, ndcPoint, inverseProjectionMatrix); // TODO: THis may be wrong i need to multiple them
        const viewPoint = this.multiplyMatrixAndPoint(inverseProjectionMatrix, ndcPoint, out);
        // Divide by w to get normalized view space coordinates
        out[0] = viewPoint[0] / viewPoint[3]
        out[1] = viewPoint[1] / viewPoint[3]
        out[2] = viewPoint[2] / viewPoint[3]
        // multiplyMatrixAndPoint(inverseProjectionMatrix, ndcPoint);

        return out;
        // return {
        //     x: viewPoint[0] / viewPoint[3],
        //     y: viewPoint[1] / viewPoint[3],
        //     z: viewPoint[2] / viewPoint[3]
        // };
    }

    viewToWorld(viewCoords: vec4, inverseViewMatrix: mat4, out = vec4.create()) {
        // const viewPoint = [viewCoords[0], viewCoords[1], viewCoords[2], 1];
        // const worldPoint = multiplyMatrixAndPoint(inverseViewMatrix, viewPoint);
        const worldPoint = this.multiplyMatrixAndPoint(inverseViewMatrix, viewCoords, out); // TODO: THis may be wrong i need to multiple them
        // const worldPoint = vec4.transformMat4(out, viewCoords, inverseViewMatrix); // TODO: THis may be wrong i need to multiple them

        out[0] = worldPoint[0] / worldPoint[3]
        out[1] = worldPoint[1] / worldPoint[3]
        out[2] = worldPoint[2] / worldPoint[3]
        return out;
        // Divide by w to normalize the coordinates
        // return {
        //     x: worldPoint[0] / worldPoint[3],
        //     y: worldPoint[1] / worldPoint[3],
        //     z: worldPoint[2] / worldPoint[3]
        // };
    }

    multiplyMatrixAndPoint(matrix: mat4, point: vec4, out = vec4.create()) {
        const [x, y, z, w] = point;
        out[0] = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w;
        out[1] = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w;
        out[2] = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w;
        out[3] = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] * w;

        return out;
    }

    /*rayIntersectsAABB(rayOrigin, rayDirection, aabbMin, aabbMax) {
        let tmin = (aabbMin[0] - rayOrigin[0]) / rayDirection[0];
        let tmax = (aabbMax[0] - rayOrigin[0]) / rayDirection[0];
        if (tmin > tmax) [tmin, tmax] = [tmax, tmin];

        let tymin = (aabbMin[1] - rayOrigin[1]) / rayDirection[1];
        let tymax = (aabbMax[1] - rayOrigin[1]) / rayDirection[1];
        if (tymin > tymax) [tymin, tymax] = [tymax, tymin];

        if ((tmin > tymax) || (tymin > tmax)) return false;

        tmin = Math.max(tmin, tymin);
        tmax = Math.min(tmax, tymax);

        let tzmin = (aabbMin[2] - rayOrigin[2]) / rayDirection[2];
        let tzmax = (aabbMax[2] - rayOrigin[2]) / rayDirection[2];
        if (tzmin > tzmax) [tzmin, tzmax] = [tzmax, tzmin];

        if ((tmin > tzmax) || (tzmin > tmax)) return false;

        return true; // True if the ray intersects the AABB
    }*/

    /*    rayIntersectsSphere(rayOrigin, rayDirection, sphereCenter, sphereRadius) {
            const oc = subtractVectors(rayOrigin, sphereCenter);
            const a = dot(rayDirection, rayDirection);
            const b = 2.0 * dot(oc, rayDirection);
            const c = dot(oc, oc) - sphereRadius * sphereRadius;
            const discriminant = b * b - 4 * a * c;
            return discriminant > 0; // True if the ray intersects the sphere
        }*/

    calculateAABB(vertices: Float32Array | number[]): { min: vec3, max: vec3 } {
        const min = vec3.fromValues(Infinity, Infinity, Infinity);
        const max = vec3.fromValues(-Infinity, -Infinity, -Infinity);


        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const y = vertices[i + 1];
            const z = vertices[i + 2];

            if (x < min[0]) min[0] = x;
            if (y < min[1]) min[1] = y;
            if (z < min[2]) min[2] = z;

            if (x > max[0]) max[0] = x;
            if (y > max[1]) max[1] = y;
            if (z > max[2]) max[2] = z;
        }

        return { min, max };
    }

    calculateBoundingSphere(vertices: number[] | Float32Array): { center: vec3, radius: number } {
        const { min, max } = this.calculateAABB(vertices);

        // Center of the sphere is the midpoint of the AABB
        const center = vec3.fromValues(
            (min[0] + max[0]) / 2,
            (min[1] + max[1]) / 2,
            (min[2] + max[2]) / 2,
        );

        // Calculate the radius as the distance from the center to the farthest vertex
        let radius = 0;
        for (let i = 0; i < vertices.length; i += 3) {
            const dx = vertices[i] - center[0];
            const dy = vertices[i + 1] - center[1];
            const dz = vertices[i + 2] - center[2];
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (distance > radius) radius = distance;
        }

        return { center, radius };
    }

  /*  extractFrustumPlanes(viewProjectionMatrix: mat4): Frustum {
        const planes: Partial<Frustum> = {};

        // Temporary vectors for each plane
        const leftPlane = vec4.create();
        const rightPlane = vec4.create();
        const bottomPlane = vec4.create();
        const topPlane = vec4.create();
        const nearPlane = vec4.create();
        const farPlane = vec4.create();

        // Extract each plane
        planes.left = vec4.set(leftPlane,
            viewProjectionMatrix[3] + viewProjectionMatrix[0],
            viewProjectionMatrix[7] + viewProjectionMatrix[4],
            viewProjectionMatrix[11] + viewProjectionMatrix[8],
            viewProjectionMatrix[15] + viewProjectionMatrix[12]
        );
        planes.right = vec4.set(rightPlane,
            viewProjectionMatrix[3] - viewProjectionMatrix[0],
            viewProjectionMatrix[7] - viewProjectionMatrix[4],
            viewProjectionMatrix[11] - viewProjectionMatrix[8],
            viewProjectionMatrix[15] - viewProjectionMatrix[12]
        );
        planes.bottom = vec4.set(bottomPlane,
            viewProjectionMatrix[3] + viewProjectionMatrix[1],
            viewProjectionMatrix[7] + viewProjectionMatrix[5],
            viewProjectionMatrix[11] + viewProjectionMatrix[9],
            viewProjectionMatrix[15] + viewProjectionMatrix[13]
        );
        planes.top = vec4.set(topPlane,
            viewProjectionMatrix[3] - viewProjectionMatrix[1],
            viewProjectionMatrix[7] - viewProjectionMatrix[5],
            viewProjectionMatrix[11] - viewProjectionMatrix[9],
            viewProjectionMatrix[15] - viewProjectionMatrix[13]
        );
        planes.near = vec4.set(nearPlane,
            viewProjectionMatrix[3] + viewProjectionMatrix[2],
            viewProjectionMatrix[7] + viewProjectionMatrix[6],
            viewProjectionMatrix[11] + viewProjectionMatrix[10],
            viewProjectionMatrix[15] + viewProjectionMatrix[14]
        );
        planes.far = vec4.set(farPlane,
            viewProjectionMatrix[3] - viewProjectionMatrix[2],
            viewProjectionMatrix[7] - viewProjectionMatrix[6],
            viewProjectionMatrix[11] - viewProjectionMatrix[10],
            viewProjectionMatrix[15] - viewProjectionMatrix[14]
        );

        // Normalize each plane
        [leftPlane, rightPlane, bottomPlane, topPlane, nearPlane, farPlane].forEach(plane => {
            const length = Math.sqrt(plane[0] ** 2 + plane[1] ** 2 + plane[2] ** 2);
            vec4.scale(plane, plane, 1 / length);
        });

        return planes as Frustum;
    }*/

    normalizePlane(plane: { normal: vec3, distance: number }) {
        const length = plane.normal.length;
        vec3.scale(plane.normal, plane.normal, (1 / length));
        plane.distance /= length;
    }

    /*

        transformBoundingBox(boundingBox, modelMatrix) {
            const corners = [
                [boundingBox.min[0], boundingBox.min[1], boundingBox.min[2], 1],
                [boundingBox.max[0], boundingBox.min[1], boundingBox.min[2], 1],
                [boundingBox.min[0], boundingBox.max[1], boundingBox.min[2], 1],
                [boundingBox.min[0], boundingBox.min[1], boundingBox.max[2], 1],
                [boundingBox.max[0], boundingBox.max[1], boundingBox.min[2], 1],
                [boundingBox.min[0], boundingBox.max[1], boundingBox.max[2], 1],
                [boundingBox.max[0], boundingBox.min[1], boundingBox.max[2], 1],
                [boundingBox.max[0], boundingBox.max[1], boundingBox.max[2], 1]
            ];

            let transformedMin = { x: Infinity, y: Infinity, z: Infinity };
            let transformedMax = { x: -Infinity, y: -Infinity, z: -Infinity };

            corners.forEach(corner => {
                const transformedCorner = this.multiplyMatrixAndPoint(modelMatrix, corner);

                transformedMin[0] = Math.min(transformedMin[0], transformedCorner[0]);
                transformedMin[1] = Math.min(transformedMin[1], transformedCorner[1]);
                transformedMin[2] = Math.min(transformedMin[2], transformedCorner[2]);

                transformedMax[0] = Math.max(transformedMax[0], transformedCorner[0]);
                transformedMax[1] = Math.max(transformedMax[1], transformedCorner[1]);
                transformedMax[2] = Math.max(transformedMax[2], transformedCorner[2]);
            });

            return { min: transformedMin, max: transformedMax };
        }
    */

    interleaveGeometry(vertices: number[], textures: number[], normals: number[]) {
        return vertices.reduce((acc, _, i) => {
            if (i % 3 !== 0) {
                return acc;
            }
            acc.push(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
            acc.push(textures[i * 2] || 0, textures[i * 2 + 1] || 0);
            acc.push(normals[i * 3] || 0, normals[i * 3 + 1] || 0, normals[i * 3 + 2] || 1);
            return acc;
        }, [] as number []);
    }

    interleaveArrays(arrays: number[][], strides: number[]): Float32Array {
        // Validate input lengths
        if (arrays.length !== strides.length) {
            throw new Error("Each array must have a corresponding stride.");
        }

        // Check that each array length is a multiple of its stride
        arrays.forEach((arr, i) => {
            if (arr.length % strides[i] !== 0) {
                throw new Error(`Array at index ${i} has a length that is not a multiple of its stride.`);
            }
        });

        // Determine the number of "items" (groups of elements) based on the first array
        const numItems = arrays[0].length / strides[0];

        // Validate that all arrays have the same number of items
        arrays.forEach((arr, i) => {
            if (arr.length / strides[i] !== numItems) {
                throw new Error("All arrays must represent the same number of items based on their strides.");
            }
        });

        // Calculate the total stride (combined length of each item's data)
        const totalStride = strides.reduce((sum, stride) => sum + stride, 0);
        // console.log(`Total stride ${totalStride}, stride: ${strides}`)
        // console.log('Num items: ', numItems)

        // Initialize the interleaved array
        const interleaved = new Float32Array(numItems * totalStride);

        // Interleave data
        for (let itemIndex = 0; itemIndex < numItems; itemIndex++) {
            let offset = 0;
            for (let arrayIndex = 0; arrayIndex < arrays.length; arrayIndex++) {
                const stride = strides[arrayIndex];
                const start = itemIndex * stride;
                const end = start + stride;
                interleaved.set(arrays[arrayIndex].slice(start, end), itemIndex * totalStride + offset);
                offset += stride;
            }
        }

        return interleaved;
    }

    prettyPrintMat4(mat4: mat4) {
        let str = "";
        for (let i = 0; i < mat4.length; i++) {
            str += (i % 4 === 0 && i !== 0 ? '\n' : '') + mat4[i].toFixed(2) + ' ';
        }
        return str;
    }
}

export default new MathUtil();