import {GeometryData} from 'core/mesh/Geometry';

export default class Cube {

    public static readonly indicesOld: number[] = [
        0, 1, 2, 3, 4, 5,   // Front face
        6, 7, 8, 9, 10, 11,  // East face
        12, 13, 14, 15, 16, 17, // North face
        18, 19, 20, 21, 22, 23, // West face
        24, 25, 26, 27, 28, 29, // Top face
        30, 31, 32, 33, 34, 35  // Bottom face
    ];
    public static readonly indices: number[] = [
        // Front face
        0, 1, 2,  2, 3, 0,

        // Back face
        4, 5, 6,  6, 7, 4,

        // Right face
        8, 9, 10,  10, 11, 8,

        // Left face
        12, 13, 14,  14, 15, 12,

        // Top face
        16, 17, 18,  18, 19, 16,

        // Bottom face
        20, 21, 22,  22, 23, 20
    ];

    public static readonly verticesOld = [
        0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0,
        1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0,
        1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0,
        1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 1.0,
        1.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0,
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0,
        0.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.0,
        1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0,
        1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0,
    ];

    public static readonly vertices = [
        // Positions for the cube (each face is defined by 4 vertices)
        -1.0,  1.0,  1.0,  // Front top-left
        1.0,  1.0,  1.0,  // Front top-right
        1.0, -1.0,  1.0,  // Front bottom-right
        -1.0, -1.0,  1.0,  // Front bottom-left

        -1.0,  1.0, -1.0,  // Back top-left
        1.0,  1.0, -1.0,  // Back top-right
        1.0, -1.0, -1.0,  // Back bottom-right
        -1.0, -1.0, -1.0,  // Back bottom-left

        // Right face
        1.0,  1.0, -1.0,  // Top-right (Right face)
        1.0,  1.0,  1.0,  // Top-left
        1.0, -1.0,  1.0,  // Bottom-left
        1.0, -1.0, -1.0,  // Bottom-right

        // Left face
        -1.0,  1.0,  1.0,  // Top-left (Left face)
        -1.0,  1.0, -1.0,  // Top-right
        -1.0, -1.0, -1.0,  // Bottom-right
        -1.0, -1.0,  1.0,  // Bottom-left

        // Top face
        -1.0,  1.0, -1.0,  // Top-left (Top face)
        1.0,  1.0, -1.0,  // Top-right
        1.0,  1.0,  1.0,  // Bottom-right
        -1.0,  1.0,  1.0,  // Bottom-left

        // Bottom face
        -1.0, -1.0, -1.0,  // Bottom-left (Bottom face)
        1.0, -1.0, -1.0,  // Bottom-right
        1.0, -1.0,  1.0,  // Top-right
        -1.0, -1.0,  1.0   // Top-left
    ];


    // @ts-ignore
    public static geometry: GeometryData = {indices: Cube.indices, vertices: Cube.vertices}

}
