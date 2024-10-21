export function generateSphere(radius: number, latDivisions: number, lonDivisions: number) {
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

            // UV coordinates
            const u = lon / lonDivisions;
            const v = lat / latDivisions;

            // Add vertex position and UV to the vertices array
            vertices.push(x, y, z, u, v);
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