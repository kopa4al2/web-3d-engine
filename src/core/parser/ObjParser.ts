import { vec3 } from "gl-matrix";

export interface ObjFile {
    name: string,
    meshes: ObjectGroup[],
}

export interface ObjectGroup {
    groupName: string,
    vertices: number[];        // Flat array of vertex positions
    normals: number[];         // Flat array of normals
    texCoords: number[];       // Flat array of texture coordinates
    indices: number[];         // Flat array of indices
    tangents: number[];
    bitangents: number[];
    material?: ObjectMaterialData;        // The material associated with this geometry
}


export interface ObjectMaterialData {
    materialGroupName: string
    ambient?: vec3;                      // Ka
    diffuse?: vec3;                      // Kd
    specular?: vec3;                     // Ks
    shininess?: number;                  // Ns
    indexOfRefraction?: number;         // Ni
    transparency?: number;              // d
    illuminationModel: number;          // illum,
    textureFile?: string                // map_Kd
}

class ObjParser {
    public parseObjFile(filePath: string, mtlFilePath?: string, name: string = 'obj'): Promise<ObjFile> {
        if (mtlFilePath) {
            return Promise.all([
                fetch(filePath).then(file => file.text()),
                fetch(mtlFilePath).then(file => file.text())
            ])
                .then(([obj, mtl]) => {
                    const materialData = this.parseMtl(mtl);
                    const objFile = this.parseObjWithMtl(obj, materialData);
                    // if (interleaved) {
                    //     const interleaved: InterleavedMesh[] = [];
                    //     objFile.meshes.forEach(m => interleaved.push(this.createSingleBufferData(m as ObjMesh)));
                    //     objFile.meshes = interleaved;
                    // }
                    return objFile;
                })
                .catch(err => {
                    throw `Error loading obj file ${filePath}. Err: ${err}`
                });
        }

        return fetch(filePath)
            .then(response => response.text())
            .then(rawContent => {
                try {
                    const objFile = this.parseObjectGroups(rawContent);
                    return { name, meshes: objFile };
                } catch (err) {
                    console.error(err);
                    throw 'wtf';
                }
            })
            .catch(err => {
                throw `Error loading obj file ${filePath}. Err: ${err}`
            });
    }

    private parseObjectGroups(objContent: string): ObjectGroup[] {
        const visitedIndices: Record<string, Record<string, number>> = {};
        const objects: ObjectGroup[] = [];  // Array to store data for each object
        let currentObject: ObjectGroup = {
            groupName: 'UNKNOWN',
            vertices: [],
            normals: [],
            texCoords: [],
            indices: [],
            tangents: [],
            bitangents: []
        };
        visitedIndices['UNKNOWN'] = {};

        const lines: string[] = objContent.split('\n');
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);

            if (parts[0] === 'o' || parts[0] === 'g') {
                // Start of a new object or group
                if (!currentObject) {
                    currentObject = {
                        groupName: parts[1],
                        vertices: [],
                        normals: [],
                        texCoords: [],
                        indices: [],
                        tangents: [],
                        bitangents: [],
                    };
                }
                visitedIndices[parts[1]] = {};
                objects.push(currentObject);
            } else if (parts[0] === 'v') {
                // Vertex position
                currentObject.vertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
            } else if (parts[0] === 'vt') {
                // Texture coordinate
                currentObject.texCoords.push(parseFloat(parts[1]), parseFloat(parts[2]));
            } else if (parts[0] === 'vn') {
                // Normal
                currentObject.normals.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
            } else if (parts[0] === 'f') {
                if (parts[1].indexOf('/') >= 0) {
                    for (let i = 1; i <= 3; i++) {
                        const vertexData = parts[i].split('/');
                        const positionIndex = parseInt(vertexData[0]) - 1;  // OBJ uses 1-based indexing
                        const texCoordIndex = vertexData[1] ? parseInt(vertexData[1]) - 1 : -1;
                        const normalIndex = vertexData[2] ? parseInt(vertexData[2]) - 1 : -1;
                        currentObject.indices.push(positionIndex, texCoordIndex, normalIndex);
                    }
                } else {
                    currentObject.indices.push(
                        parseInt(parts[1]) - 1, -1, -1,
                        parseInt(parts[2]) - 1, -1, -1,
                        parseInt(parts[3]) - 1, -1, -1);
                }
            }
        }

        if (objects.length === 0) {
            // obj file without a name in it
            objects.push(currentObject);
        }

        for (let object of objects) {
            const updatedVertices = [];
            const updatedTextureCoordinates = [];
            const updatedNormals = [];
            const updatedIndices = [];
            let indexOffset = 0;
            for (let i = 0; i < object.indices.length; i += 3) {
                const vertexIndex = object.indices[i];
                const textureIndex = object.indices[i + 1];
                const normalIndex = object.indices[i + 2];

                const indexIdentifier = `${vertexIndex}/${textureIndex}/${normalIndex}`;
                if (visitedIndices[object.groupName][indexIdentifier]) {
                    updatedIndices.push(visitedIndices[object.groupName][indexIdentifier]);
                    continue;
                }

                updatedVertices.push(
                    object.vertices[vertexIndex * 3],
                    object.vertices[vertexIndex * 3 + 1],
                    object.vertices[vertexIndex * 3 + 2]);

                updatedTextureCoordinates.push(
                    textureIndex >= 0 ? object.texCoords[textureIndex * 2] : 0,
                    textureIndex >= 0 ? object.texCoords[textureIndex * 2 + 1] : 0,
                );

                updatedNormals.push(
                    normalIndex >= 0 ? object.normals[normalIndex * 3] : 0.0,
                    normalIndex >= 0 ? object.normals[normalIndex * 3 + 1] : 0.0,
                    normalIndex >= 0 ? object.normals[normalIndex * 3 + 2] : 1.0
                );

                visitedIndices[object.groupName][indexIdentifier] = indexOffset;
                updatedIndices.push(indexOffset);
                indexOffset += 1;
            }


            // currentObject.material = {
            //     materialGroupName: '',
            //     ambient: [0, 0, 0],
            //     diffuse: [0, 0, 0],
            //     specular: [0, 0, 0],
            //     shininess: 0,
            //     illuminationModel: 0,
            // };

            object.indices = updatedIndices;
            object.vertices = updatedVertices;
            object.normals = updatedNormals;
            object.texCoords = updatedTextureCoordinates;
        }

        return objects;
    }

    private parseObjWithMtl(objContent: string, mtls: Record<string, ObjectMaterialData>): ObjFile {
        let name: string = '';
        const positions: number[] = [];
        const normals: number[] = [];
        const texCoords: number[] = [];

        const materialGroups: Record<string, ObjectGroup> = {}

        let currentMaterial: string = '';
        const lines: string[] = objContent.split('\n');
        lines.forEach((line) => {
            const parts = line.trim().split(' ');
            if (parts[0] === 'v') {
                positions.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
            } else if (parts[0] === 'o') {
                name = parts[1];
            } else if (parts[0] === 'vn') {
                normals.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
            } else if (parts[0] === 'vt') {
                texCoords.push(parseFloat(parts[1]), parseFloat(parts[2]));
            } else if (parts[0] === 'usemtl') {
                currentMaterial = parts[1];
                if (!materialGroups[currentMaterial]) {
                    materialGroups[currentMaterial] = {
                        groupName: name,
                        material: mtls && mtls[currentMaterial],
                        vertices: [],
                        texCoords: [],
                        normals: [],
                        indices: [],
                        tangents: [],
                        bitangents: [],
                    };
                }
            } else if (parts[0] === 'f') {
                for (let i = 1; i <= 3; i++) {
                    const vertexData = parts[i].split('/');
                    const positionIndex = parseInt(vertexData[0]) - 1;
                    const texCoordIndex = vertexData[1] ? parseInt(vertexData[1]) - 1 : -1;
                    const normalIndex = vertexData[2] ? parseInt(vertexData[2]) - 1 : -1;

                    const group = materialGroups[currentMaterial];
                    group.vertices.push(positions[positionIndex * 3], positions[positionIndex * 3 + 1], positions[positionIndex * 3 + 2]);

                    if (texCoordIndex >= 0) {
                        group.texCoords.push(texCoords[texCoordIndex * 2], texCoords[texCoordIndex * 2 + 1]);
                    }

                    if (normalIndex >= 0) {
                        group.normals.push(normals[normalIndex * 3], normals[normalIndex * 3 + 1], normals[normalIndex * 3 + 2]);
                    }

                    group.indices.push(group.vertices.length / 3 - 1);
                }
            }
        });

        return {
            name,
            meshes: Object.values(materialGroups)
        };
    }

    private parseMtl(content: string): Record<string, ObjectMaterialData> {
        const materials: Record<string, ObjectMaterialData> = {};
        let currentMaterial: string = '';

        const lines = content.split('\n');

        lines.forEach((line) => {
            const parts = line.trim().split(' ');
            if (parts[0] === 'newmtl') {
                currentMaterial = parts[1];
                materials[currentMaterial] = {
                    illuminationModel: 1,
                    materialGroupName: currentMaterial,
                    shininess: 0
                };
            } else if (parts[0] === 'Ka') {
                const [x, y, z] = parts.slice(1).map(parseFloat);
                materials[currentMaterial].ambient = vec3.fromValues(x, y, z);
            } else if (parts[0] === 'Kd') {
                const [x, y, z] = parts.slice(1).map(parseFloat);
                materials[currentMaterial].diffuse = vec3.fromValues(x, y, z);
            } else if (parts[0] === 'Ks') {
                const [x, y, z] = parts.slice(1).map(parseFloat);
                materials[currentMaterial].specular = vec3.fromValues(x, y, z);
            } else if (parts[0] === 'Ns') {
                materials[currentMaterial].shininess = parseFloat(parts[1]);
            } else if (parts[0] === 'illum') {
                materials[currentMaterial].illuminationModel = parseFloat(parts[1]);
            }
        });

        return materials;
    }
}

export default new ObjParser();
