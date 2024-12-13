import GeometryComponent, { GeometryProperties } from "core/components/geometry/GeometryComponent";
import { GeometryData } from 'core/mesh/Geometry';
import { vec3 } from 'gl-matrix';

export interface SphereProperties {
    radius?: number,
    latDivisions?: number,
    lonDivision?: number,
    center?: vec3,
    wireframe?: boolean,
}

export default class SphereGeometry extends GeometryComponent {

    public geometryData: GeometryData;

    constructor(props?: Partial<SphereProperties>) {
        const sphereGeometry = generateSphere(
            props?.radius || 1.0,
            props?.latDivisions || 16,
            props?.lonDivision || 32);

        const { vertices, indices, uvs, normals, latitudes, longitudes } = sphereGeometry;

        super({
            vertices,
            texCoords: uvs,
            normals,
            indices,
        });

        this.geometryData = {
            vertices,
            indices,
            normals,
            texCoords: uvs,
            tangents: [],
            bitangents: []
        };
    }
}

function generateSphere(radius: number, latDivisions: number, lonDivisions: number) {
    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];
    const normals: number[] = [];
    const latitudes: number[] = [];
    const longitudes: number[] = [];

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

            const latitude = theta / Math.PI; //lat / latDivisions;
            const longitude = phi / (2 * Math.PI);  //lon / lonDivisions;

            latitudes.push(latitude);
            longitudes.push(longitude);

            // Normal vector (normalized vertex position for a sphere)
            const nx = sinTheta * cosPhi;
            const ny = cosTheta;
            const nz = sinTheta * sinPhi;

            normals.push(nx, ny, nz);

            // UV coordinates
            const u = lon / lonDivisions;
            const v = lat / latDivisions;

            uvs.push(u, v)
            vertices.push(x, y, z);
            // vertices.push(x, y, z, u, v, nx, ny, nz);
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

    return { vertices, indices, uvs, normals, latitudes, longitudes };
    // return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices), uvs, normals };
}
