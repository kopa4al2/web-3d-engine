// TODO: Unfinished
import { GLTFJson } from "core/parser/gltf/GLTFParser";

export interface GlbJsonParserRequest {
    rootDir: string,
    relativePath: string,
}

export interface GlbJsonParserResponse {
    imageBitmap: ImageBitmap;
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

self.onmessage = async (event: MessageEvent<GlbJsonParserRequest>) => {
    const { rootDir, relativePath } = event.data;
    const fileArrayBuffer = await fetch(rootDir + relativePath).then(res => res.arrayBuffer());
    const dataView = new DataView(fileArrayBuffer);

    // read headers
    const magic = dataView.getUint32(0, true);
    if (magic !== 0x46546C67) { // "glTF"
        throw new Error('Invalid GLB file');
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
    const binaryChunkOffset = 20 + jsonChunkLength;
    const binaryChunkType = dataView.getUint32(binaryChunkOffset + 4, true);
    if (binaryChunkType !== 0x004E4942) { // "BIN"
        throw new Error('Expected BIN chunk in GLB ' + binaryChunkType);
    }

    console.time('WORKER_GROUP')
    const bufferViews: Record<number, ArrayBuffer> = {};
    const accessorsByBufferView: Record<number, any[]> = {}

    for (let i = 0; i < json.bufferViews.length; i++){
        const bufferView = json.bufferViews[i];
        const byteOffset = bufferView.byteOffset || 0;
        bufferViews[i] = fileArrayBuffer.slice(binaryChunkOffset + byteOffset, binaryChunkOffset + byteOffset + bufferView.byteLength);
        accessorsByBufferView[i] = [];
    }

    const typeToSize: Record<string, number> = {
        SCALAR: 1,
        VEC2: 2,
        VEC3: 3,
        VEC4: 4,
        MAT4: 16,
    };
    // bufferView.byteOffset
    // accessor.byteOffset
    // componentType
    // elementsPerVertex
    // bytes per vertex
    // stride
    // count



    function groupAccessor(accessorIndex?: number, mesh?: number, attribute?: string) {
        if (accessorIndex === undefined) {
            return;
        }

        const accessor = json.accessors[accessorIndex];
        const bufferView = json.bufferViews[accessor.bufferView];

        const bufferViewOffset = bufferView.byteOffset;
        const accessorOffset = accessor.byteOffset;
        const componentType = accessor.componentType;
        const elementsPerVertex = typeToSize[accessor.type];
        const bytesPerVertex = null; // TODO: Can be calculated
        const stride = bufferView.byteStride || bytesPerVertex;
        const count = accessor.count;

        accessorsByBufferView[accessor.bufferView].push({ accessor, stride: json.bufferViews[accessor.bufferView].byteStride, mesh, attribute });
    }

    for (let i = 0; i < json.meshes.length; i++) {
        const mesh = json.meshes[i];
        for (const primitive of mesh.primitives) {
            groupAccessor(primitive.indices, i, 'INDICES');
            groupAccessor(primitive.attributes.POSITION, i, 'POSITIONS');
            groupAccessor(primitive.attributes.NORMAL, i, 'NORMALS');
            groupAccessor(primitive.attributes.TANGENT, i, 'TANGENTS');
            groupAccessor(primitive.attributes.JOINTS_0, i, 'JOINTS_0');
            groupAccessor(primitive.attributes.WEIGHTS_0, i, 'WEIGHTS_0');
            groupAccessor(primitive.attributes.TEXCOORD_0, i, 'UV_0');
            groupAccessor(primitive.attributes.TEXCOORD_1, i, 'UV_1');
            groupAccessor(primitive.attributes.TEXCOORD_2, i, 'UV_2');
            groupAccessor(primitive.attributes.TEXCOORD_3, i, 'UV_3');
        }
    }

    const sorted = Object.entries(accessorsByBufferView).map(entry => ({
        index: entry[0],
        value: entry[1].sort((v1, v2) => v1.accessor.byteOffset - v2.accessor.byteOffset)
    }))
    console.timeEnd('WORKER_GROUP')
    console.log('Accessors by buffer view:', sorted);
}

function getBytesPerElement(componentType: number): number {
    switch (componentType) {
        case 5120: // BYTE
        case 5121: // UNSIGNED_BYTE
            return 1;
        case 5122: // SHORT
        case 5123: // UNSIGNED_SHORT
            return 2;
        case 5125: // UNSIGNED_INT
        case 5126: // FLOAT
            return 4;
        default:
            throw new Error(`Unsupported componentType: ${componentType}`);
    }
}