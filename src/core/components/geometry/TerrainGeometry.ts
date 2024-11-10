// @ts-nocheck
import GeometryComponent from "core/components/geometry/GeometryComponent";
import TextureLoader from "core/loader/TextureLoader";
import { VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import { vec3 } from "gl-matrix";

export default class TerrainGeometry extends GeometryComponent {

    static readonly HEIGHT_FACTOR = 20.0;
    static readonly MIN_HEIGHT = -10.0;
    static readonly SEA_LEVEL = 0.0;
    static readonly WIDTH = 256;
    static readonly HEIGHT = 256;

    constructor(shaderName = VertexShaderName.TERRAIN) {
        const { vertices, texCoords } = generateTerrainVertices(TerrainGeometry.WIDTH, TerrainGeometry.HEIGHT, TextureLoader.rawImages['heightMap']);
        const normals = calculateNormals(vertices, TerrainGeometry.WIDTH, TerrainGeometry.HEIGHT);
        const indices = createIndices(TerrainGeometry.WIDTH, TerrainGeometry.HEIGHT);
        const data = GeometryComponent.interleaveData({ indices, texCoords, vertices, normals });
        super({
            texCoords: [],
            vertices: data,
            normals: [],
            indices: indices
            // layout: [
            //     { dataType: 'float32', elementsPerVertex: 3 },
            //     { dataType: 'float32', elementsPerVertex: 2 },
            //     { dataType: 'float32', elementsPerVertex: 3 },
            // ],
            // stride: Float32Array.BYTES_PER_ELEMENT * (3 + 3 + 2),
            // vertexCount: vertices.length,
            // shaderName,
        });
    }

}

function calculateNormals(vertices: number[], width: number, height: number) {
    let normals = new Array(vertices.length).fill(0); // Initialize normal array

    for (let z = 0; z < height - 1; z++) {
        for (let x = 0; x < width - 1; x++) {
            // Get the positions of the current vertex and its neighbors
            let index = (z * width + x) * 3;  // 3 values per vertex (x, y, z)
            let p1 = vec3.fromValues(vertices[index], vertices[index + 1], vertices[index + 2]);
            let p2 = vec3.fromValues(vertices[index + 3], vertices[index + 4], vertices[index + 5]);  // Neighbor in +x direction
            let p3 = vec3.fromValues(vertices[index + width * 3], vertices[index + width * 3 + 1], vertices[index + width * 3 + 2]);  // Neighbor in +z direction

            // Calculate the vectors between neighbors
            let v1 = vec3.sub(vec3.create(), p2, p1);  // p2 - p1
            let v2 = vec3.sub(vec3.create(), p3, p1);  // p3 - p1

            // Calculate the cross product of v1 and v2 to get the normal
            let normal = vec3.cross(vec3.create(), v1, v2);
            vec3.normalize(normal, normal);  // Normalize the resulting normal

            // Assign the normal to the current vertex
            normals[index] = normal[0];
            normals[index + 1] = normal[1];
            normals[index + 2] = normal[2];
        }
    }

    return normals;
}

function generateTerrainVertices(width: number, height: number, imageData: ImageData) {
    let vertices = [];
    let normals = [];
    let texCoords = [];

    for (let z = 0; z < height; z++) {
        for (let x = 0; x < width; x++) {
            // Calculate the height from the heightmap
            let heightValue = getHeightFromImage(x, z, imageData, imageData.width, imageData.height, width, height);

            // Add the vertex position (x, heightValue, z)
            vertices.push(x, heightValue, z);

            // Placeholder normal (you will calculate the real ones later)
            normals.push(0, 0, 1);  // Default up-normal

            // Texture coordinates (for now just map x/z to UV)
            texCoords.push(x / (width - 1), z / (height - 1));
        }
    }

    return { vertices, normals, texCoords };
}

function createIndices(width: number, height: number): number[] {
    const indices = [];

    for (let z = 0; z < height - 1; z++) {
        for (let x = 0; x < width - 1; x++) {
            let topLeft = z * width + x;
            let topRight = topLeft + 1;
            let bottomLeft = (z + 1) * width + x;
            let bottomRight = bottomLeft + 1;

            // First triangle
            indices.push(topLeft, bottomLeft, topRight);

            // Second triangle
            indices.push(topRight, bottomLeft, bottomRight);
        }
    }

    return indices;
}

function getHeightFromImage(x: number, z: number,
                            imageData: ImageData,
                            width: number, height: number,
                            terrainWidth: number, terrainHeight: number) {
    // Map the terrain coordinates (x, z) to the heightmap coordinates
    let imgX = Math.floor((x / (terrainWidth - 1)) * (width - 1));
    let imgZ = Math.floor((z / (terrainHeight - 1)) * (height - 1));

    // Calculate the pixel index in the heightmap
    let index = (imgZ * width + imgX) * 4;  // Assuming the imageData is in RGBA format

    // Use the red channel (assuming grayscale image)
    let r = imageData.data[index];

    return (r / 255.0) * TerrainGeometry.HEIGHT_FACTOR;
}