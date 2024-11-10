import GeometryComponent from "core/components/geometry/GeometryComponent";
import { VertexShaderName } from 'core/resources/cpu/CpuShaderData';

export default class Cone extends GeometryComponent {


    constructor() {
        const { vertices, indices } = generateArrowGeometry();
        const data = GeometryComponent.interleaveData({
            vertices,
        });
        super({
            vertices: Array.from(data),
            // layout: [
            //     { dataType: 'float32', elementsPerVertex: 3 },
            //     { dataType: 'float32', elementsPerVertex: 3 },
            //     { dataType: 'float32', elementsPerVertex: 2 }],
            // stride: Float32Array.BYTES_PER_ELEMENT * (3 + 3 + 2),
            // vertexCount: 36,
            indices,
            // shaderName: VertexShaderName.BASIC_WITH_LIGHT
        });
    }
}
function generateArrowGeometry(cylinderRadius = 0.1,
                               cylinderHeight = 1.0,
                               coneRadius = 0.2,
                               coneHeight = 0.3,
                               segments = 16) {
    const vertices: number[] = [];
    const indices: number[] = [];

    // Helper function to add vertices in (x, y, z) format
    function addVertex(x: number, y: number, z: number) {
        vertices.push(x, y, z);
    }

    // Generate Cylinder (Arrow Shaft)
    const halfCylinderHeight = cylinderHeight / 2;

    // Cylinder bottom center vertex for the base
    const bottomCenterIndex = vertices.length / 3;
    addVertex(0, -halfCylinderHeight, 0); // Center of the bottom base

    // Cylinder side vertices
    for (let i = 0; i < segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = Math.cos(theta) * cylinderRadius;
        const z = Math.sin(theta) * cylinderRadius;

        // Bottom circle vertices
        addVertex(x, -halfCylinderHeight, z);
        // Top circle vertices
        addVertex(x, halfCylinderHeight, z);
    }

    // Cylinder indices (side faces) - CCW winding
    for (let i = 0; i < segments; i++) {
        const next = (i + 1) % segments;
        const bottom1 = i * 2 + 1;
        const top1 = i * 2 + 2;
        const bottom2 = next * 2 + 1;
        const top2 = next * 2 + 2;

        // Each segment side forms two triangles with CCW winding
        indices.push(bottom1, bottom2, top1); // Bottom1 -> Bottom2 -> Top1
        indices.push(top1, bottom2, top2);    // Top1 -> Bottom2 -> Top2
    }

    // Bottom base indices - CCW winding
    for (let i = 0; i < segments; i++) {
        const next = (i + 1) % segments;
        const bottom1 = bottomCenterIndex + 1 + i * 2;
        const bottom2 = bottomCenterIndex + 1 + next * 2;

        // Triangle from the bottom center to each pair of bottom vertices
        indices.push(bottomCenterIndex, bottom1, bottom2); // Bottom center -> Bottom1 -> Bottom2
    }

    // Generate Cone (Arrow Head)
    const coneTipY = halfCylinderHeight + coneHeight;
    const coneBaseY = halfCylinderHeight;

    // Cone tip vertex
    const tipIndex = vertices.length / 3;
    addVertex(0, coneTipY, 0);

    // Cone base vertices
    for (let i = 0; i < segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = Math.cos(theta) * coneRadius;
        const z = Math.sin(theta) * coneRadius;
        addVertex(x, coneBaseY, z);
    }

    // Cone indices (sides connecting tip to base) - CCW winding
    for (let i = 0; i < segments; i++) {
        const baseIndex = tipIndex + 1 + i;
        const nextBaseIndex = tipIndex + 1 + ((i + 1) % segments);

        // Triangle from tip to each pair of base vertices with CCW winding
        indices.push(tipIndex, baseIndex, nextBaseIndex); // Tip -> BaseIndex -> NextBaseIndex
    }

    // Optional: Cone base indices (if you want a closed base for the cone) - CCW winding
    for (let i = 1; i < segments - 1; i++) {
        indices.push(tipIndex + 1, tipIndex + 1 + i, tipIndex + 1 + i + 1); // Center -> Current -> Next
    }

    return { vertices, indices };
}


const { vertices, indices } = generateArrowGeometry();
// console.log("Vertices:", vertices);
// console.log("Indices:", indices);
