import GeometryComponent, { GeometryProperties } from "core/components/geometry/GeometryComponent";
import { VertexShader } from "core/shaders/GPUShader";

export default class Cone extends GeometryComponent {


    constructor(geometryProps: GeometryProperties | VertexShader) {
        super(geometryProps);
    }
}
//
// function createArrow(length, thickness, headSize) {
//     let vertices = [];
//     let indices = [];
//
//     // Cylinder (shaft)
//     // Generate vertices for a thin cylinder along the Y-axis (arrow shaft)
//     let shaftLength = length - headSize;
//     let shaftVertices = createCylinderVertices(thickness, shaftLength);
//     vertices.push(...shaftVertices);
//
//     // Cone (head)
//     let coneVertices = createConeVertices(headSize, thickness);
//     vertices.push(...coneVertices);
//
//     // Generate indices for both the shaft and head
//     let shaftIndices = createCylinderIndices();
//     let coneIndices = createConeIndices(shaftVertices.length / 3); // Offset the cone indices by the number of shaft vertices
//     indices.push(...shaftIndices, ...coneIndices);
//
//     return { vertices, indices };
// }

function createCylinderVertices(radius: number, height: number) {
    // Generate vertices for a cylinder along the Y-axis
    let vertices = [];
    let segments = 12; // Number of segments around the cylinder
    for (let i = 0; i <= segments; i++) {
        let angle = (i / segments) * 2 * Math.PI;
        let x = Math.cos(angle) * radius;
        let z = Math.sin(angle) * radius;

        // Bottom cap (at 0,0)
        vertices.push(x, 0, z);
        // Top cap (at height)
        vertices.push(x, height, z);
    }
    return vertices;
}

function createConeVertices(height: number, radius: number) {
    // Generate vertices for a cone
    let vertices = [];
    let segments = 12;
    // Bottom circle
    for (let i = 0; i <= segments; i++) {
        let angle = (i / segments) * 2 * Math.PI;
        let x = Math.cos(angle) * radius;
        let z = Math.sin(angle) * radius;
        vertices.push(x, 0, z);  // Circle at the base
    }
    // Apex of the cone (at height)
    vertices.push(0, height, 0);
    return vertices;
}

// function createCylinderIndices():number {
//     // Generate indices for a cylinder (you'll need to connect the sides and caps)
//     let indices = [];
//     // Use a loop to generate indices connecting the top and bottom vertices
//     // (Details omitted for brevity, but similar to sphere or circle indexing)
//     return indices;
// }
//
// function createConeIndices(offset: number) {
//     // Generate indices for a cone (connect the base circle to the apex)
//     let indices = [];
//     // Generate indices by connecting the base vertices to the apex
//     // (Offset is needed to handle indexing after the cylinder)
//     return indices;
// }