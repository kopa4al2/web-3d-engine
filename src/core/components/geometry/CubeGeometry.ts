import GeometryComponent from "core/components/geometry/GeometryComponent";
import GPUResourceFactory from "core/resources/gpu/GPUResourceFactory";
import MathUtil from "util/MathUtil";

export default class CubeGeometry extends GeometryComponent {

    constructor() {
        const shaderSource = '';
        super({
            vertices,
            layout: [
                { dataType: 'float32', elementsPerVertex: 3 },
                { dataType: 'float32', elementsPerVertex: 3 },
                { dataType: 'float32', elementsPerVertex: 2 }],
            stride: Float32Array.BYTES_PER_ELEMENT * (3 + 3 + 2),
            vertexCount: 36,
            indices,
            shaderSource
        });
    }
}

const indices = new Uint16Array([
    0, 1, 2, 3, 4, 5,   // Front face
    6, 7, 8, 9, 10, 11,  // East face
    12, 13, 14, 15, 16, 17, // North face
    18, 19, 20, 21, 22, 23, // West face
    24, 25, 26, 27, 28, 29, // Top face
    30, 31, 32, 33, 34, 35  // Bottom face
]);

const vertices = new Float32Array([
    // FRONT FACE  NORMAL    UV
    0.0, 0.0, 0.0, 0.0, 0.0, -1.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0, 0.0, -1.0, 1.0, 0.0,
    1.0, 1.0, 0.0, 0.0, 0.0, -1.0, 1.0, 1.0,
    0.0, 0.0, 0.0, 0.0, 0.0, -1.0, 0.0, 0.0,
    1.0, 1.0, 0.0, 0.0, 0.0, -1.0, 1.0, 0.0,
    1.0, 0.0, 0.0, 0.0, 0.0, -1.0, 1.0, 1.0,

    // EAST
    1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0,
    1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
    1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0,
    1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0,
    1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0,
    1.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0,

    // NORTH
    1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
    1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0,
    0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0,
    1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
    0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0,
    0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0,

    // WEST
    0.0, 0.0, 1.0, -1.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 1.0, -1.0, 0.0, 0.0, 1.0, 0.0,
    0.0, 1.0, 0.0, -1.0, 0.0, 0.0, 1.0, 1.0,
    0.0, 0.0, 1.0, -1.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, -1.0, 0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, -1.0, 0.0, 0.0, 1.0, 1.0,

    // TOP
    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0,
    1.0, 1.0, 1.0, 0.0, 1.0, 0.0, 1.0, 1.0,
    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0,
    1.0, 1.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0,
    1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0,

    // BOTTOM
    1.0, 0.0, 1.0, 0.0, -1.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0, -1.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 0.0, -1.0, 0.0, 1.0, 1.0,
    1.0, 0.0, 1.0, 0.0, -1.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, -1.0, 0.0, 1.0, 0.0,
    1.0, 0.0, 0.0, 0.0, -1.0, 0.0, 1.0, 1.0,
]);

const justVertices = new Float32Array([
    0.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    1.0, 1.0, 0.0,
    0.0, 0.0, 0.0,
    1.0, 1.0, 0.0,
    1.0, 0.0, 0.0,
// EAST
    1.0, 0.0, 0.0,
    1.0, 1.0, 0.0,
    1.0, 1.0, 1.0,
    1.0, 0.0, 0.0,
    1.0, 1.0, 1.0,
    1.0, 0.0, 1.0,
// NORTH
    1.0, 0.0, 1.0,
    1.0, 1.0, 1.0,
    0.0, 1.0, 1.0,
    1.0, 0.0, 1.0,
    0.0, 1.0, 1.0,
    0.0, 0.0, 1.0,
// WEST
    0.0, 0.0, 1.0,
    0.0, 1.0, 1.0,
    0.0, 1.0, 0.0,
    0.0, 0.0, 1.0,
    0.0, 1.0, 0.0,
    0.0, 0.0, 0.0,
// TOP
    0.0, 1.0, 0.0,
    0.0, 1.0, 1.0,
    1.0, 1.0, 1.0,
    0.0, 1.0, 0.0,
    1.0, 1.0, 1.0,
    1.0, 1.0, 0.0,
// BOTTOM
    1.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 0.0,
    1.0, 0.0, 1.0,
    0.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
]);

const normals = [
    0.0, 0.0, -1.0,
    0.0, 0.0, -1.0,
    0.0, 0.0, -1.0,
    0.0, 0.0, -1.0,
    0.0, 0.0, -1.0,
    0.0, 0.0, -1.0,
    1.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    -1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, -1.0, 0.0,
    0.0, -1.0, 0.0,
    0.0, -1.0, 0.0,
    0.0, -1.0, 0.0,
    0.0, -1.0, 0.0,
    0.0, -1.0, 0.0,
]