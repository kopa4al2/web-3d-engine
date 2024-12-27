import { GeometryData } from 'core/mesh/Geometry';
import { mat3, mat4, vec2, vec3, vec4 } from "gl-matrix";
import DebugUtil from './debug/DebugUtil';

class MathUtil {

    isPowerOfTwo(n: number): boolean {
        return n > 0 && Math.log2(n) % 1 === 0;
    }

    normalize(value: number, min: number, max: number) {
        return Math.max(Math.min(value, min), Math.min(value, max));
    }

    float32ToFloat16(source: Float32Array) {
        const float32Array = new Float32Array(1);
        const uint32Array = new Uint32Array(float32Array.buffer);

        function toFloat16(value: number) {
            const floatView = float32Array;
            const intView = uint32Array;

            floatView[0] = value;
            const x = intView[0];

            // let sign = (x >> 31) << 15;
            let exponent = ((x >> 23) & 0xff) - (127 - 15);
            let mantissa = x & 0x7fffff;

            if (exponent <= 0) {
                if (exponent < -10) return (x >> 31) << 15;
                mantissa = (mantissa | 0x800000) >> (1 - exponent);
                return (x >> 31) << 15 | (mantissa >> 13);
            } else if (exponent === 0xff - (127 - 15)) {
                return (x >> 31) << 15 | 0x7c00 | (mantissa ? 1 : 0); // NaN or Inf
            } else if (exponent > 30) {
                return (x >> 31) << 15 | 0x7c00; // Overflow, becomes Inf
            }

            return (x >> 31) << 15 | (exponent << 10) | (mantissa >> 13);
        }

        return Uint16Array.from(source, toFloat16)
    }

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

    // mat4FromArray(array: number[]) {
    //     const [x, y, z, w] = point;
    //     out[0] = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w;
    //     out[1] = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w;
    //     out[2] = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w;
    //     out[3] = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] * w;
    //
    //     return out;
    // }

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
        const length = Math.sqrt(
            plane.normal[0] * plane.normal[0] +
            plane.normal[1] * plane.normal[1] +
            plane.normal[2] * plane.normal[2]
        );

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

    prettyPrintMat4(mat4: mat4) {
        let str = "";
        for (let i = 0; i < mat4.length; i++) {
            str += (i % 4 === 0 && i !== 0 ? '\n' : '') + mat4[i].toFixed(2) + ' ';
        }
        return str;
    }

    calculateBiTangents(normals: ArrayLike<number>,
                        tangents: ArrayLike<number>,
                        vertexCount: number): Float32Array<ArrayBufferLike> {
        const bitangents = new Float32Array(vertexCount * 3); // VEC3 per vertex

        for (let i = 0; i < vertexCount; i++) {
            const nx = normals[i * 3];
            const ny = normals[i * 3 + 1];
            const nz = normals[i * 3 + 2];

            const tx = tangents[i * 4]; // Tangent x
            const ty = tangents[i * 4 + 1]; // Tangent y
            const tz = tangents[i * 4 + 2]; // Tangent z
            const tw = tangents[i * 4 + 3]; // Tangent.w (handedness)

            // Cross product: B = cross(N, T)
            const bx = ny * tz - nz * ty;
            const by = nz * tx - nx * tz;
            const bz = nx * ty - ny * tx;

            // Scale by handedness: B *= T.w
            bitangents[i * 3] = bx * tw;
            bitangents[i * 3 + 1] = by * tw;
            bitangents[i * 3 + 2] = bz * tw;
        }

        return bitangents;
    }

    calculateTangents({ vertices, normals, texCoords, indices }: GeometryData): GeometryData {
        const tangents = new Float32Array(vertices.length);

        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i];
            const i1 = indices[i + 1];
            const i2 = indices[i + 2];

            // Positions
            const p0 = vec3.fromValues(vertices[i0 * 3], vertices[i0 * 3 + 1], vertices[i0 * 3 + 2]);
            const p1 = vec3.fromValues(vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]);
            const p2 = vec3.fromValues(vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]);

            // UVs
            const uv0 = vec2.fromValues(texCoords[i0 * 2], texCoords[i0 * 2 + 1]);
            const uv1 = vec2.fromValues(texCoords[i1 * 2], texCoords[i1 * 2 + 1]);
            const uv2 = vec2.fromValues(texCoords[i2 * 2], texCoords[i2 * 2 + 1]);

            // Edges of the triangle
            const deltaPos1 = vec3.subtract(vec3.create(), p1, p0);
            const deltaPos2 = vec3.subtract(vec3.create(), p2, p0);

            const deltaUV1 = vec2.subtract(vec2.create(), uv1, uv0);
            const deltaUV2 = vec2.subtract(vec2.create(), uv2, uv0);

            const r = 1.0 / (deltaUV1[0] * deltaUV2[1] - deltaUV1[1] * deltaUV2[0]);

            const tangent = vec3.create();
            vec3.scale(
                tangent,
                vec3.subtract(
                    vec3.create(),
                    vec3.scale(vec3.create(), deltaPos1, deltaUV2[1]),
                    vec3.scale(vec3.create(), deltaPos2, deltaUV1[1])
                ),
                r
            );

            // Accumulate tangents
            for (const idx of [i0, i1, i2]) {
                tangents[idx * 3] += tangent[0];
                tangents[idx * 3 + 1] += tangent[1];
                tangents[idx * 3 + 2] += tangent[2];
            }
        }

        // Normalize tangents
        for (let i = 0; i < tangents.length; i += 3) {
            const t = vec3.fromValues(tangents[i], tangents[i + 1], tangents[i + 2]);
            vec3.normalize(t, t);
            tangents[i] = t[0];
            tangents[i + 1] = t[1];
            tangents[i + 2] = t[2];
        }

        return { vertices, normals, texCoords, indices, tangents };
    }

    calculateTangentsVec4({ vertices, normals, texCoords, indices }: GeometryData): GeometryData {
        const tangents = new Float32Array(vertices.length * 4 / 3); // 4 components per vertex
        const bitangents = new Float32Array(vertices.length); // Temporary storage for bitangents

        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i];
            const i1 = indices[i + 1];
            const i2 = indices[i + 2];

            // Positions
            const p0 = vec3.fromValues(vertices[i0 * 3], vertices[i0 * 3 + 1], vertices[i0 * 3 + 2]);
            const p1 = vec3.fromValues(vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]);
            const p2 = vec3.fromValues(vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]);

            // UVs
            const uv0 = vec2.fromValues(texCoords[i0 * 2], texCoords[i0 * 2 + 1]);
            const uv1 = vec2.fromValues(texCoords[i1 * 2], texCoords[i1 * 2 + 1]);
            const uv2 = vec2.fromValues(texCoords[i2 * 2], texCoords[i2 * 2 + 1]);

            // Edges of the triangle
            const deltaPos1 = vec3.subtract(vec3.create(), p1, p0);
            const deltaPos2 = vec3.subtract(vec3.create(), p2, p0);

            const deltaUV1 = vec2.subtract(vec2.create(), uv1, uv0);
            const deltaUV2 = vec2.subtract(vec2.create(), uv2, uv0);

            const r = 1.0 / (deltaUV1[0] * deltaUV2[1] - deltaUV1[1] * deltaUV2[0]);

            const tangent = vec3.create();
            const bitangent = vec3.create();

            vec3.scale(
                tangent,
                vec3.subtract(
                    vec3.create(),
                    vec3.scale(vec3.create(), deltaPos1, deltaUV2[1]),
                    vec3.scale(vec3.create(), deltaPos2, deltaUV1[1])
                ),
                r
            );

            vec3.scale(
                bitangent,
                vec3.subtract(
                    vec3.create(),
                    vec3.scale(vec3.create(), deltaPos2, deltaUV1[0]),
                    vec3.scale(vec3.create(), deltaPos1, deltaUV2[0])
                ),
                r
            );

            // Accumulate tangents and bitangents
            for (const idx of [i0, i1, i2]) {
                tangents[idx * 4] += tangent[0];
                tangents[idx * 4 + 1] += tangent[1];
                tangents[idx * 4 + 2] += tangent[2];

                bitangents[idx * 3] += bitangent[0];
                bitangents[idx * 3 + 1] += bitangent[1];
                bitangents[idx * 3 + 2] += bitangent[2];
            }
        }

        // Normalize tangents and compute handedness
        for (let i = 0; i < vertices.length / 3; i++) {
            const t = vec3.fromValues(tangents[i * 4], tangents[i * 4 + 1], tangents[i * 4 + 2]);
            const b = vec3.fromValues(bitangents[i * 3], bitangents[i * 3 + 1], bitangents[i * 3 + 2]);
            const n = vec3.fromValues(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);

            vec3.normalize(t, t);

            // Handedness (w): 1.0 or -1.0
            const crossTB = vec3.cross(vec3.create(), t, b);
            const handedness = vec3.dot(crossTB, n) < 0.0 ? -1.0 : 1.0;

            tangents[i * 4] = t[0];
            tangents[i * 4 + 1] = t[1];
            tangents[i * 4 + 2] = t[2];
            tangents[i * 4 + 3] = handedness; // Append w
        }

        return { vertices, normals, texCoords, indices, tangents };
    }
    
    
    calculateTBNV({ vertices, normals, texCoords, indices }: GeometryData): GeometryData {
        const tangents = new Float32Array(vertices.length); // Tangents
        const bitangents = new Float32Array(vertices.length); // Bitangents

        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i];
            const i1 = indices[i + 1];
            const i2 = indices[i + 2];

            // Get vertices
            const v0 = vec3.fromValues(
                vertices[i0 * 3],
                vertices[i0 * 3 + 1],
                vertices[i0 * 3 + 2]
            );
            const v1 = vec3.fromValues(
                vertices[i1 * 3],
                vertices[i1 * 3 + 1],
                vertices[i1 * 3 + 2]
            );
            const v2 = vec3.fromValues(
                vertices[i2 * 3],
                vertices[i2 * 3 + 1],
                vertices[i2 * 3 + 2]
            );

            // Get UVs
            const uv0 = vec3.fromValues(texCoords[i0 * 2], texCoords[i0 * 2 + 1], 0);
            const uv1 = vec3.fromValues(texCoords[i1 * 2], texCoords[i1 * 2 + 1], 0);
            const uv2 = vec3.fromValues(texCoords[i2 * 2], texCoords[i2 * 2 + 1], 0);

            // Get normals
            const n0 = vec3.fromValues(
                normals[i0 * 3],
                normals[i0 * 3 + 1],
                normals[i0 * 3 + 2]
            );
            const n1 = vec3.fromValues(
                normals[i1 * 3],
                normals[i1 * 3 + 1],
                normals[i1 * 3 + 2]
            );
            const n2 = vec3.fromValues(
                normals[i2 * 3],
                normals[i2 * 3 + 1],
                normals[i2 * 3 + 2]
            );

            // Calculate edges in world space
            const edge1 = vec3.create();
            const edge2 = vec3.create();
            vec3.subtract(edge1, v1, v0);
            vec3.subtract(edge2, v2, v0);

            // Calculate UV deltas
            const deltaUV1 = vec3.create();
            const deltaUV2 = vec3.create();
            vec3.subtract(deltaUV1, uv1, uv0);
            vec3.subtract(deltaUV2, uv2, uv0);

            // Compute tangent
            const f = 1.0 / (deltaUV1[0] * deltaUV2[1] - deltaUV2[0] * deltaUV1[1]);
            const tangent = vec3.create();
            vec3.scale(tangent, edge1, deltaUV2[1]);
            vec3.scaleAndAdd(tangent, tangent, edge2, -deltaUV1[1]);
            vec3.scale(tangent, tangent, f);

            // Orthogonalize tangent with normal
            const n0Tangent = vec3.create();
            vec3.scale(n0Tangent, n0, vec3.dot(n0, tangent));
            vec3.subtract(tangent, tangent, n0Tangent);
            vec3.normalize(tangent, tangent);

            // Compute bitangent using cross product
            const bitangent = vec3.create();
            vec3.cross(bitangent, n0, tangent);
            vec3.normalize(bitangent, bitangent);

            // Store tangent and bitangent for each vertex
            for (const index of [i0, i1, i2]) {
                tangents[index * 3] += tangent[0];
                tangents[index * 3 + 1] += tangent[1];
                tangents[index * 3 + 2] += tangent[2];

                bitangents[index * 3] += bitangent[0];
                bitangents[index * 3 + 1] += bitangent[1];
                bitangents[index * 3 + 2] += bitangent[2];
            }
        }

        // Normalize tangents and bitangents
        for (let i = 0; i < tangents.length; i += 3) {
            const tangent = vec3.fromValues(
                tangents[i],
                tangents[i + 1],
                tangents[i + 2]
            );
            const bitangent = vec3.fromValues(
                bitangents[i],
                bitangents[i + 1],
                bitangents[i + 2]
            );

            vec3.normalize(tangent, tangent);
            vec3.normalize(bitangent, bitangent);

            tangents[i] = tangent[0];
            tangents[i + 1] = tangent[1];
            tangents[i + 2] = tangent[2];

            bitangents[i] = bitangent[0];
            bitangents[i + 1] = bitangent[1];
            bitangents[i + 2] = bitangent[2];
        }

        return { vertices, normals, texCoords, indices, tangents: [...tangents], bitangents: [...bitangents] };
    }
}

DebugUtil.addToWindowObject('mathUtil', new MathUtil());
export default new MathUtil();
