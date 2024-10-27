// @ts-nocheck
import Component from "core/components/Component";
import { InterleavedMesh } from "core/parser/ObjParser";
import GPUResourceFactory from "core/resources/gpu/GPUResourceFactory";
import { VertexShader } from "core/shaders/GPUShader";

export interface GeometryProperties {
    vertices: number[];        // Flat array of vertex positions
    normals: number[];         // Flat array of normals
    texCoords: number[];       // Flat array of texture coordinates
    indices: Uint32Array | Uint16Array;         // Flat array of indices
}

export interface InterleavedProps {
    data: Float32Array,
    vertexCount: number,
    indices: Uint32Array | Uint16Array
}

export default class GeometryComponent implements Component {
    public static readonly ID = Symbol('GeometryComponent');
    id: symbol = GeometryComponent.ID;

    public vertexData: VertexShader;

    public constructor(geometryProps: GeometryProperties | VertexShader) {
        if ((geometryProps as VertexShader).layout) {
            this.vertexData = geometryProps as VertexShader;
            return;
        }

        const shaderSource = geometryProps.shaderSource;
        const props = geometryProps as GeometryProperties;
        const vertices = GeometryComponent.createSingleBufferData(props);
        this.vertexData = {
            vertices,
            layout: [
                { dataType: 'float32', elementsPerVertex: 3 },
                { dataType: 'float32', elementsPerVertex: 2 },
                { dataType: 'float32', elementsPerVertex: 3 }
            ],
            stride: Float32Array.BYTES_PER_ELEMENT * (3 + 3 + 2),
            vertexCount: props.vertices.length / 3,
            indices: new Uint32Array(props.indices),
            shaderSource
        }
    }

    protected static createSingleBufferData(geometryProps: Partial<GeometryProperties>): Float32Array {
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


    private padIndices(indices: number[]) : Uint16Array {
        console.log('==============')
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