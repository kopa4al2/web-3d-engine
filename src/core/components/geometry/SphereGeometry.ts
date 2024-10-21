import GeometryComponent from "core/components/geometry/GeometryComponent";
import GPUResourceFactory from "core/resources/gpu/GPUResourceFactory";

export interface SphereProperties {
    radius?: number,
    latDivisions: number,
    lonDivision: number,
}

export default class SphereGeometry extends GeometryComponent {

    constructor(props?: SphereProperties) {
        const shaderSource = 'GPUResourceFactory.instance.getGeometryShader()';
        const { vertices, indices } = generateSphere(
            props?.radius || 1.0,
            props?.latDivisions || 16,
            props?.lonDivision || 32);


        super({
            vertices,
            layout: [
                { dataType: 'float32', elementsPerVertex: 3 },
                { dataType: 'float32', elementsPerVertex: 3 },
                { dataType: 'float32', elementsPerVertex: 2 }],
            stride: Float32Array.BYTES_PER_ELEMENT * (3 + 3 + 2),
            vertexCount: vertices.length / 5,
            indices,
            shaderSource
        });
    }
}

function generateSphere(radius: number, latDivisions: number, lonDivisions: number) {
    const vertices: number[] = [];
    const indices: number[] = [];

    // Generate vertices and UVs
    for (let lat = 0; lat <= latDivisions; lat++) {
        const theta = Math.PI * lat / latDivisions; // Latitude angle
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let lon = 0; lon <= lonDivisions; lon++) {
            const phi = 2 * Math.PI * lon / lonDivisions; // Longitude angle
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            // Cartesian coordinates for the vertex
            const x = radius * sinTheta * cosPhi;
            const y = radius * cosTheta;
            const z = radius * sinTheta * sinPhi;

            // Normal vector (normalized vertex position for a sphere)
            const nx = sinTheta * cosPhi;
            const ny = cosTheta;
            const nz = sinTheta * sinPhi;

            // UV coordinates
            const u = lon / lonDivisions;
            const v = lat / latDivisions;

            // Add vertex position, normal, and UV to the vertices array
            vertices.push(x, y, z, nx, ny, nz, u, v);
        }
    }

    // Generate indices
    for (let lat = 0; lat < latDivisions; lat++) {
        for (let lon = 0; lon < lonDivisions; lon++) {
            const first = lat * (lonDivisions + 1) + lon;
            const second = first + lonDivisions + 1;

            // Two triangles per quad (lat, lon grid)
            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}