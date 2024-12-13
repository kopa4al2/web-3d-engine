import Component from "core/components/Component";
import CubeGeometry from 'core/components/geometry/CubeGeometry';
import Mesh from 'core/components/Mesh';
import { RenderPass } from 'core/Graphics';
import { BufferId } from 'core/resources/gpu/BufferDescription';
import { IndexBuffer } from 'core/resources/gpu/GpuShaderData';
import { vec3 } from 'gl-matrix';
import MathUtil from 'util/MathUtil';

export interface AABBoundingBox {
    min: vec3,
    max: vec3,
}

export interface SphereBoundingBox {
    center: vec3,
    radius: number,
}

// export interface GeometryData {
//     AABB: AABBoundingBox,
//     sphereBoundingBox: SphereBoundingBox,
//     vertices: Float32Array,
//     indices: Uint16Array | Uint32Array,
// }

export interface GeometryProperties {
    vertices: number[];        // Flat array of vertex positions
    normals: number[];         // Flat array of normals
    texCoords: number[];       // Flat array of texture coordinates
    indices: number[];         // Flat array of indices
    skipInterleave?: boolean,
}

export default class GeometryComponent implements Component {
    public static readonly ID = Symbol('GeometryComponent');
    id: symbol = GeometryComponent.ID;

    // public data: GeometryData;

    // public vertices: Float32Array;
    // public indices: Uint32Array;

    public constructor(geometryProps?: Partial<GeometryProperties>) {
        const props = geometryProps as GeometryProperties;
        // this.vertices = geometryProps.skipInterleave
        //     ? new Float32Array(props.vertices!)
        //     : GeometryComponent.interleaveData(props);
        // this.indices = new Uint32Array(geometryProps.indices!);

        // this.data = {
        //     vertices: this.vertices,
        //     indices: this.indices,
        //     sphereBoundingBox: MathUtil.calculateBoundingSphere(this.vertices),
        //     AABB: MathUtil.calculateAABB(this.vertices)
        // }
        // this.indices = props.indices;
        // this.vertexData = {
        //     vertices,
        //     layout: [
        //         { dataType: 'float32', elementsPerVertex: 3 },
        //         { dataType: 'float32', elementsPerVertex: 2 },
        //         { dataType: 'float32', elementsPerVertex: 3 }
        //     ],
        //     stride: Float32Array.BYTES_PER_ELEMENT * (3 + 3 + 2),
        //     vertexCount: props.vertices.length / 3,
        //     indices: new Uint32Array(props.indices),
        //     shaderName
        // }
        //

    }

    public static interleaveData(geometryProps: Partial<GeometryProperties>): Float32Array {
        const interleavedData = [];

        for (let i = 0; i < geometryProps.vertices!.length / 3; i++) {
            // Push position (x, y, z)
            interleavedData.push(geometryProps.vertices![i * 3], geometryProps.vertices![i * 3 + 1], geometryProps.vertices![i * 3 + 2]);

            // Push texture coordinates (u, v) or default to 0,0 if missing
            if (geometryProps.texCoords && geometryProps.texCoords.length > 0) {
                interleavedData.push(geometryProps.texCoords[i * 2], geometryProps.texCoords[i * 2 + 1]);
            } else {
                interleavedData.push(0.0, 0.0);
            }

            // Push normal (nx, ny, nz) or default to 0,0,0 if missing
            if (geometryProps.normals && geometryProps.normals.length > 0) {
                interleavedData.push(geometryProps.normals[i * 3], geometryProps.normals[i * 3 + 1], geometryProps.normals[i * 3 + 2]);
            } else {
                interleavedData.push(0.0, 0.0, 1.0);
            }

        }

        return new Float32Array(interleavedData);
    }

    // protected static createSingleBufferData(geometryProps: Partial<GeometryProperties>): Float32Array {
    //     const interleavedData = [];
    //     const vertices = geometryProps as Float32Array;
    //     for (let i = 0; i < vertices.length / 3; i++) {
    //         // Push position (x, y, z)
    //         interleavedData.push(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
    //
    //         // Push texture coordinates (u, v) or default to 0,0 if missing
    //         if (geometryProps.texCoords && geometryProps.texCoords.length > 0) {
    //             interleavedData.push(geometryProps.texCoords[i * 2], geometryProps.texCoords[i * 2 + 1]);
    //         } else {
    //             interleavedData.push(0.0, 0.0);
    //         }
    //
    //         // Push normal (nx, ny, nz) or default to 0,0,0 if missing
    //         if (geometryProps.normals && geometryProps.normals.length > 0) {
    //             interleavedData.push(geometryProps.normals[i * 3], geometryProps.normals[i * 3 + 1], geometryProps.normals[i * 3 + 2]);
    //         } else {
    //             interleavedData.push(0.0, 0.0, 1.0);
    //         }
    //
    //     }
    //
    //     return new Float32Array(interleavedData);
    // }


    private padIndices(indices: number[]): Uint16Array {
        const indexBufferSize = indices.length * Uint16Array.BYTES_PER_ELEMENT;  // Size in bytes (each Uint16 index is 2 bytes)
        console.log(indexBufferSize)
        const paddedIndexBufferSize = (indexBufferSize + 3) & ~3;  // Round up to nearest multiple of 4
        console.log(paddedIndexBufferSize)
        const paddedArray = new Uint16Array(paddedIndexBufferSize);
        paddedArray.set(indices);

        console.log(paddedArray.length)

        return paddedArray
    }
}
