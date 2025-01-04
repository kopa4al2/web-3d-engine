// TODO: Unfinished
import { GeometryStride } from "core/factories/GeometryFactory";
import { GeometryData } from "core/mesh/Geometry";
import { GLTFJson } from "core/parser/gltf/GLTFParser";
import { GLBWorkerRequest, GLBWorkerResponse } from "core/parser/gltf/workers/GLBWorker";
import WorkerPool from "core/worker/WorkerPool";
import { vec2, vec3 } from "gl-matrix";

export interface GlbWorkerImage {
    imageBitmaps: ImageBitmap,
    name: string
}

export interface GlbWorkerMesh {
    name: string,
    data: ArrayBuffer,
    indices: ArrayBuffer,
    material: number,
}


export interface GlbJsonParserRequest {
    binary: ArrayBuffer,
    // rootDir: string,
    // relativePath: string,
}

export interface GlbJsonParserResponse {
    meshes: GlbWorkerMesh[],
    imageBitmaps: GlbWorkerImage[],
    json: GLTFJson,
    // meshes: Record<number, Record<Attribute, ArrayBuffer>>;
}

export enum Attribute {
    INDICES = 0,
    POSITIONS = 1,
    NORMALS = 2,
    TANGENT = 3,
    JOINTS = 4,
    WEIGHTS = 5,
    UV_0 = 6,
    UV_1 = 7,
}

interface Accessor {
    data: number[],
    attribute: Attribute,
    mesh: number,
    accessor: any,
}

const typeToSize: Record<string, number> = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT4: 16,
};

self.onmessage = async (event: MessageEvent<GlbJsonParserRequest>) => {
    // const { rootDir, relativePath } = event.data;
    const fileArrayBuffer = event.data.binary;
    // if (!rootDir || !relativePath) {
    //     console.error('Worker did not receive any data: ', event);
    //     return;
    // }
    // console.log(`LOADING ${rootDir + relativePath} GLB`, 'Received data in the worker');
    console.log(`[WORKER]`, 'Received data in the worker');

    // const fileArrayBuffer = await fetch(rootDir + relativePath).then(res => res.arrayBuffer());
    const dataView = new DataView(fileArrayBuffer);

    // read headers
    const magic = dataView.getUint32(0, true);
    if (magic !== 0x46546C67) { // "glTF"
        console.error(`Invalid GLB file: ${magic}`);
        // throw new Error('Invalid GLB file: ' + magic);
    }

    const version = dataView.getUint32(4, true);
    if (version !== 2) {
        throw new Error('Unsupported GLB version: ' + version);
    }

    const length = dataView.getUint32(8, true);

    // Read JSON chunk
    const jsonChunkLength = dataView.getUint32(12, true);
    const jsonChunkType = dataView.getUint32(16, true);
    if (jsonChunkType !== 0x4E4F534A) { // "JSON"
        throw new Error('Expected JSON chunk in GLB');
    }
    const jsonChunk = new Uint8Array(fileArrayBuffer, 20, jsonChunkLength);
    const json: GLTFJson = JSON.parse(new TextDecoder().decode(jsonChunk));

    // Read binary chunk
    let binaryChunkOffset = 20 + jsonChunkLength;
    const binaryChunkType = dataView.getUint32(binaryChunkOffset + 4, true);
    if (binaryChunkType !== 0x004E4942) { // "BIN"
        throw new Error('Expected BIN chunk in GLB ' + binaryChunkType);
    }
    binaryChunkOffset += 8;

    console.log('GLB JSON: ', json);

    // const imageBuffers: Record<number, ArrayBuffer> = {};
    // const imageWorkers: Worker[] = [];
    const imageLoadingWorkerPool = new WorkerPool<GLBWorkerRequest, GLBWorkerResponse>();
    const imageResults = [];
    imageLoadingWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: `GLB-Image-Worker-${1}` }))
    imageLoadingWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: `GLB-Image-Worker-${2}` }))
    // imageLoadingWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: `GLB-Image-Worker-${3}` }))
    // imageLoadingWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: `GLB-Image-Worker-${4}` }))

    const buffersToTransfer: Transferable[] = [];

    const bufferViews: Record<number, ArrayBuffer> = {};
    const accessorsByBufferView: Record<number, Accessor[]> = {}
    const workers = [];

    const usedBuffers = [];
    for (let i = 0; i < json.images.length; i++) {
        const img = json.images[i];
        const bufferView = json.bufferViews[img.bufferView!];
        const byteOffset = bufferView.byteOffset || 0;

        imageResults.push(imageLoadingWorkerPool
            .submit({
                buffer: fileArrayBuffer.slice(binaryChunkOffset + byteOffset, binaryChunkOffset + byteOffset + bufferView.byteLength),
                mimeType: img.mimeType!
            })
            .then(res => {
                buffersToTransfer.push(res.imageBitmap);
                return { imageBitmaps: res.imageBitmap, name: bufferView.name }
            }));

        usedBuffers.push(img.bufferView);
    }

    for (let i = 0; i < json.bufferViews.length; i++) {
        if (usedBuffers.includes(i)) {
            continue;
        }
        const bufferView = json.bufferViews[i];
        const byteOffset = bufferView.byteOffset || 0;


        bufferViews[i] = fileArrayBuffer.slice(binaryChunkOffset + byteOffset, binaryChunkOffset + byteOffset + bufferView.byteLength);
        accessorsByBufferView[i] = [];
        workers.push(new Worker(new URL('./GLBJsonParserGeometryWorker.ts', import.meta.url), { name: `GLB-Geometry-Worker-${i}` }));
    }

    function groupAccessor(accessorIndex?: number, mesh?: number, attribute?: Attribute) {
        if (accessorIndex === undefined) {
            return;
        }

        const accessor = json.accessors[accessorIndex];
        const bufferView =
            json.bufferViews[accessor.bufferView];


        const data = [
            accessor.byteOffset || 0, // start
            accessor.componentType,
            accessor.count,
            typeToSize[accessor.type],  // elements per vertex
            bufferView.byteStride || 0  // stride
        ]

        accessorsByBufferView[accessor.bufferView].push({
            data,
            mesh: mesh!,
            attribute: attribute!,
            accessor: { accessor, bufferView }
        });
    }

    for (let i = 0; i < json.meshes.length; i++) {
        const mesh = json.meshes[i];
        for (const primitive of mesh.primitives) {
            groupAccessor(primitive.indices, i, Attribute.INDICES);
            groupAccessor(primitive.attributes.POSITION, i, Attribute.POSITIONS);
            groupAccessor(primitive.attributes.NORMAL, i, Attribute.NORMALS);
            groupAccessor(primitive.attributes.TANGENT, i, Attribute.TANGENT);
            groupAccessor(primitive.attributes.JOINTS_0, i, Attribute.JOINTS);
            groupAccessor(primitive.attributes.WEIGHTS_0, i, Attribute.WEIGHTS);
            groupAccessor(primitive.attributes.TEXCOORD_0, i, Attribute.UV_0);
            groupAccessor(primitive.attributes.TEXCOORD_1, i, Attribute.UV_1);
            // groupAccessor(primitive.attributes.TEXCOORD_2, i, 'UV_2');
            // groupAccessor(primitive.attributes.TEXCOORD_3, i, 'UV_3');
        }
    }


    const meshes: Record<number, Record<string, ArrayBuffer>> = {};
    const workerResults = [];
    for (let i = 0; i < workers.length; i++) {
        const worker = workers[i];
        const bufferInfo = new Uint32Array(accessorsByBufferView[i].length * 5);
        for (let j = 0; j < accessorsByBufferView[i].length; j++) {
            bufferInfo.set(accessorsByBufferView[i][j].data, j * 5); // data.length is 5
        }
        worker.postMessage({
            // debugData: { accessors: accessorsByBufferView[i], bufferView: i },
            bufferInfo,
            buffer: bufferViews[i]
        }, [bufferViews[i]]);

        workerResults.push(new Promise(resolve => {
            worker.onmessage = ev => {
                const parsedBuffers = ev.data;
                for (let j = 0; j < accessorsByBufferView[i].length; j++) {
                    if (!meshes[accessorsByBufferView[i][j].mesh]) {
                        meshes[accessorsByBufferView[i][j].mesh] = {
                            [accessorsByBufferView[i][j].attribute]: parsedBuffers[j],
                        }
                    } else {
                        meshes[accessorsByBufferView[i][j].mesh][accessorsByBufferView[i][j].attribute] = parsedBuffers[j]
                    }

                    // buffersToTransfer.push(parsedBuffers[j]);
                }

                resolve(undefined);
            };
        }));
    }

    const imageBitmaps = await Promise.all(imageResults).then(img => {
        imageLoadingWorkerPool.shutdown();
        return img;
    });
    // @ts-ignore
    delete json.bufferViews;
    // @ts-ignore
    delete json.accessors;
    // @ts-ignore
    delete json.asset
    // @ts-ignore
    // delete json.meshes;
    Promise.all(workerResults)
        .then((_) => {
            const meshGeometries = new Array(json.meshes.length);
            for (let i = 0; i < json.meshes.length; i++) {
                const data = meshes[i];
                let geometryData: GeometryData = {
                    indices: new Uint32Array(data[Attribute.INDICES]),
                    vertices: new Float32Array(data[Attribute.POSITIONS]),
                    normals: new Float32Array(data[Attribute.NORMALS]),
                    texCoords: new Float32Array(data[Attribute.UV_0]),
                    tangents: [],
                };


                if (!data[Attribute.TANGENT]) {
                    // geometryData = MathUtil.calculateTangentsVec4(geometryData);
                    geometryData = calculateTangentsVec4(geometryData);
                } else {
                    geometryData.tangents = new Float32Array(data[Attribute.TANGENT]);
                }

                if (data[Attribute.WEIGHTS]) {
                    geometryData.weights = new Uint8Array(data[Attribute.WEIGHTS]);
                }

                if (data[Attribute.JOINTS]) {
                    geometryData.joints = new Uint8Array(data[Attribute.JOINTS]);
                }

                const interleavedData = interleaveData(geometryData, [['vertices', 3], ['texCoords', 2], ['normals', 3], ['tangents', 4]]);
                meshGeometries[i] = {
                    name: json.meshes[i].name,
                    data: interleavedData.buffer,
                    indices: data[Attribute.INDICES],
                    material: json.meshes[i].primitives[0].material,
                };
                buffersToTransfer.push(interleavedData.buffer);
                buffersToTransfer.push(data[Attribute.INDICES]);
            }

            // console.log(`LOADING ${rootDir + relativePath} GLB`, 'Worker done processing, about to post message');

            self.postMessage({
                meshes: meshGeometries,
                imageBitmaps,
                json,
            }, { transfer: buffersToTransfer });
        });
}

function interleaveData(geometry: GeometryData, strides: GeometryStride): Float32Array<ArrayBuffer> {
    strides.forEach(([geometryKey, stride]) => {
        if (!geometry[geometryKey]) {
            console.error('Strides: ', strides, ' Data: ', geometry)
            throw new Error(`Geometry data is missing: ${geometryKey} property.`);
        }

        if (geometry[geometryKey].length % stride !== 0) {
            console.error('Strides: ', strides, ' Data: ', geometry)
            throw new Error(`${geometryKey} has a length that is not a multiple of its stride. Expected: ${stride} Modulo: ${geometry[geometryKey].length % stride}.`);
        }
    });

    const numItems = geometry[strides[0][0]]!.length / strides[0][1];
    const missingKeys: (keyof GeometryData)[] = [];
    strides.forEach(([geometryKey, stride]) => {
        const geometryElement = geometry[geometryKey]!;
        if (geometryElement.length / stride !== numItems) {
            console.warn(`${geometryKey} is not the same size as vertices. Will try to default`);
            console.groupCollapsed('Warning debug');
            console.log(`geometryElement.length / stride: ${geometryElement.length / stride} !== numItems ${numItems}`);
            console.log('Geometry: ', geometry, 'Strides: ', strides);
            console.groupEnd()
            missingKeys.push(geometryKey);
            // throw new Error("All arrays must represent the same number of items based on their strides");
        }
    })

    const totalStride = strides.reduce((sum, stride) => sum + stride[1], 0);

    const interleaved = new Float32Array(numItems * totalStride);

    for (let itemIndex = 0; itemIndex < numItems; itemIndex++) {
        let offset = 0;
        for (let arrayIndex = 0; arrayIndex < strides.length; arrayIndex++) {
            const [geometryKey, stride] = strides[arrayIndex];
            const start = itemIndex * stride;
            const end = start + stride;
            // try to guess any missing geometry properties (normals / uvs)
            if (missingKeys.includes(geometryKey)) {
                const key = missingKeys.find(key => key === geometryKey);
                if (key === 'normals') {
                    interleaved.set([0, 0, 1], itemIndex * totalStride + offset);
                } else if (key === 'texCoords') {
                    interleaved.set([0, 0], itemIndex * totalStride + offset);
                } else if (key === 'tangents') {
                    interleaved.set([0, 0, 0], itemIndex * totalStride + offset);
                } else if (key === 'bitangents') {
                    interleaved.set([0, 0, 0], itemIndex * totalStride + offset);
                }
            } else {
                interleaved.set(geometry[geometryKey]!.slice(start, end), itemIndex * totalStride + offset);
            }

            offset += stride;
        }
    }

    return interleaved;
}

function calculateTangentsVec4(geometryData: GeometryData): GeometryData {
    const vertices = geometryData.vertices,
        normals = geometryData.normals,
        texCoords = geometryData.texCoords,
        indices = geometryData.indices;
    const tangents = new Float32Array(vertices.length * 4 / 3); // 4 components per vertex
    const bitangents = new Float32Array(vertices.length); // Temporary storage for bitangents
    const p0 = vec3.create(), p1 = vec3.create(), p2 = vec3.create(),
        uv0 = vec2.create(), uv1 = vec2.create(), uv2 = vec2.create(),
        deltaPos1 = vec3.create(), deltaPos2 = vec3.create(),
        deltaUV1 = vec2.create(), deltaUV2 = vec2.create(),
        tangent = vec3.create(), tangentTmp = vec3.create(),
        bitangent = vec3.create(), bitangentTmp = vec3.create(),
        t = vec3.create(), b = vec3.create(), n = vec3.create(),
        crossTB = vec3.create(), handiness = vec3.create();
    for (let i = 0; i < indices.length; i += 3) {
        // Positions
        p0[0] = vertices[indices[i] * 3];
        p0[1] = vertices[indices[i] * 3 + 1];
        p0[2] = vertices[indices[i] * 3 + 2];

        p1[0] = vertices[indices[i + 1] * 3];
        p1[1] = vertices[indices[i + 1] * 3 + 1];
        p1[2] = vertices[indices[i + 1] * 3 + 2];

        p2[0] = vertices[indices[i + 2] * 3];
        p2[1] = vertices[indices[i + 2] * 3 + 1];
        p2[2] = vertices[indices[i + 2] * 3 + 2];

        // UVs
        uv0[0] = texCoords[indices[i] * 2];
        uv0[1] = texCoords[indices[i] * 2 + 1];
        uv1[0] = texCoords[indices[i + 1] * 2];
        uv1[1] = texCoords[indices[i + 1] * 2 + 1];
        uv2[0] = texCoords[indices[i + 2] * 2];
        uv2[1] = texCoords[indices[i + 2] * 2 + 1];

        vec3.subtract(deltaPos1, p1, p0);
        vec3.subtract(deltaPos2, p2, p0);

        vec2.subtract(deltaUV1, uv1, uv0);
        vec2.subtract(deltaUV2, uv2, uv0);

        const r = 1.0 / (deltaUV1[0] * deltaUV2[1] - deltaUV1[1] * deltaUV2[0]);

        vec3.scale(
            tangent,
            vec3.subtract(
                tangentTmp,
                vec3.scale(vec3.create(), deltaPos1, deltaUV2[1]),
                vec3.scale(vec3.create(), deltaPos2, deltaUV1[1])
            ),
            r
        );

        vec3.scale(
            bitangent,
            vec3.subtract(
                bitangentTmp,
                vec3.scale(vec3.create(), deltaPos2, deltaUV1[0]),
                vec3.scale(vec3.create(), deltaPos1, deltaUV2[0])
            ),
            r
        );

        // Accumulate tangents and bitangents
        for (const idx of [indices[i], indices[i + 1], indices[i + 2]]) {
            tangents[idx * 4] += tangent[0];
            tangents[idx * 4 + 1] += tangent[1];
            tangents[idx * 4 + 2] += tangent[2];

            bitangents[idx * 3] += bitangent[0];
            bitangents[idx * 3 + 1] += bitangent[1];
            bitangents[idx * 3 + 2] += bitangent[2];
        }
    }


    // Normalize tangents and compute handedness
    for (let i = 0; i < vertices.length / 3; i++) {

        vec3.set(t, tangents[i * 4], tangents[i * 4 + 1], tangents[i * 4 + 2]);
        vec3.set(b, bitangents[i * 3], bitangents[i * 3 + 1], bitangents[i * 3 + 2]);
        vec3.set(n, normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);

        vec3.normalize(t, t);

        // Handedness (w): 1.0 or -1.0
        // const crossTB = vec3.cross(vec3.create(), t, b);
        // const handedness = vec3.dot(crossTB, n) < 0.0 ? -1.0 : 1.0;
        vec3.cross(crossTB, t, b);

        tangents[i * 4] = t[0];
        tangents[i * 4 + 1] = t[1];
        tangents[i * 4 + 2] = t[2];
        tangents[i * 4 + 3] = vec3.dot(crossTB, n) < 0.0 ? -1.0 : 1.0; // Append w
    }

    geometryData.tangents = tangents;
    return geometryData;
    // return { vertices, normals, texCoords, indices, tangents };
}