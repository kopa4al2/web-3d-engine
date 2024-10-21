import { mat3, mat4, vec3, vec4 } from "gl-matrix";

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

    calculateNormals(vertices: Float32Array, indices: Uint16Array): Float32Array {
        const normals = new Float32Array(vertices.length);

        // Step 1: Compute face normals and accumulate for each vertex
        for (let i = 0; i < indices.length; i += 3) {
            const v0 = indices[i] * 8;     // 8 elements per vertex (x, y, z, nx, ny, nz, u, v)
            const v1 = indices[i + 1] * 8;
            const v2 = indices[i + 2] * 8;

            // Get vertex positions for the triangle
            const p0 = [vertices[v0], vertices[v0 + 1], vertices[v0 + 2]];
            const p1 = [vertices[v1], vertices[v1 + 1], vertices[v1 + 2]];
            const p2 = [vertices[v2], vertices[v2 + 1], vertices[v2 + 2]];

            // Compute the face normal using the cross product of two edges
            const edge1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
            const edge2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
            const faceNormal = [
                edge1[1] * edge2[2] - edge1[2] * edge2[1],
                edge1[2] * edge2[0] - edge1[0] * edge2[2],
                edge1[0] * edge2[1] - edge1[1] * edge2[0]
            ];

            // Normalize the face normal
            const length = Math.sqrt(
                faceNormal[0] * faceNormal[0] +
                faceNormal[1] * faceNormal[1] +
                faceNormal[2] * faceNormal[2]
            );
            faceNormal[0] /= length;
            faceNormal[1] /= length;
            faceNormal[2] /= length;

            // Step 2: Accumulate the face normal to each vertex's normal
            normals[v0 + 3] += faceNormal[0];
            normals[v0 + 4] += faceNormal[1];
            normals[v0 + 5] += faceNormal[2];
            normals[v1 + 3] += faceNormal[0];
            normals[v1 + 4] += faceNormal[1];
            normals[v1 + 5] += faceNormal[2];
            normals[v2 + 3] += faceNormal[0];
            normals[v2 + 4] += faceNormal[1];
            normals[v2 + 5] += faceNormal[2];
        }

        // Step 3: Normalize the accumulated normals
        for (let i = 0; i < vertices.length; i += 8) {
            const nx = normals[i + 3];
            const ny = normals[i + 4];
            const nz = normals[i + 5];
            const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
            normals[i + 3] = nx / length;
            normals[i + 4] = ny / length;
            normals[i + 5] = nz / length;
        }

        return normals;
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