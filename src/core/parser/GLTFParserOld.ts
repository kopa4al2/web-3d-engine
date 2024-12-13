import GeometryFactory from "core/factories/GeometryFactory";
import { GLTFPrimitiveAttribute } from 'core/parser/GLTFParser';
import { mat4 } from 'gl-matrix';

export default class GLTFParserOld {

    static TEMP: Record<string, GLTFParserOld> = {};

    private gltfJson: GLTFJson | undefined;
    private binaryBuffer?: ArrayBuffer;
    // TODO: Temporary made public
    public nodes?: Map<number, GLTFNode>;
    public materials?: Map<number, GLTFMaterial>;
    public meshes?: Map<number, GLTFMesh>;

    get json(): GLTFJson {
        return this.gltfJson!;
    }

    /* START NEW METHODS */

    public createScene(geometryFactory: GeometryFactory) {
        for (let mesh of this.gltfJson!.meshes) {

        }
        const sceneGraph = this.buildSceneGraph(0);
        for (let sceneGraphElement of sceneGraph) {

        }

    }


     /* END NEW METHODS */

    async parseGlb(filePath: string): Promise<void> {
        const fileArrayBuffer = await fetch(filePath).then(res => res.arrayBuffer());
        const dataView = new DataView(fileArrayBuffer);

        // read headers
        const magic = dataView.getUint32(0, true);
        if (magic !== 0x46546C67) { // "glTF"
            throw new Error('Invalid GLB file');
        }

        const version = dataView.getUint32(4, true);
        if (version !== 2) {
            throw new Error('Unsupported GLB version');
        }

        const length = dataView.getUint32(8, true);

        // Read JSON chunk
        const jsonChunkLength = dataView.getUint32(12, true);
        const jsonChunkType = dataView.getUint32(16, true);
        if (jsonChunkType !== 0x4E4F534A) { // "JSON"
            throw new Error('Expected JSON chunk in GLB');
        }
        const jsonChunk = new Uint8Array(fileArrayBuffer, 20, jsonChunkLength);
        console.log("RAW GLB JSON: ", JSON.parse(new TextDecoder().decode(jsonChunk)))
        this.gltfJson = JSON.parse(new TextDecoder().decode(jsonChunk));

        // Read binary chunk
        const binaryChunkOffset = 20 + jsonChunkLength;
        const binaryChunkType = dataView.getUint32(binaryChunkOffset + 4, true);
        if (binaryChunkType !== 0x004E4942) { // "BIN"
            throw new Error('Expected BIN chunk in GLB');
        }
        this.binaryBuffer = fileArrayBuffer.slice(binaryChunkOffset + 8);

        console.log("GLB JSON ", this.gltfJson);
        this.parseGltfJson();
    }

    async parseGltf(filePath: string, binaryPath: string): Promise<void> {
        const [json, binary] = await Promise.all([
            fetch(filePath).then(res => res.json()),
            fetch(binaryPath).then(res => res.arrayBuffer())
        ]);
        this.gltfJson = json;
        this.binaryBuffer = binary;
        console.log("GLTF JSON ", json);
        this.parseGltfJson();
    }

    private parseGltfJson() {
        if (this.json.meshes) {
            // this.meshes = this.parseMeshes();
            // console.log('Meshes', this.meshes);
        }
        if (this.json.nodes) {
            this.nodes = this.parseNodes();
            // console.log(this.nodes);
            const graph = this.buildSceneGraph(0);
            GLTFParserOld.TEMP['root'] = this;
            // console.log('Graph', graph);
        }
        if (this.json.materials) {
            this.materials = this.parseMaterials();
            // console.log('Materials: ', this.materials);
        }
    }

    private parseMeshes() {
        const meshes = new Map<number, GLTFMesh>();

        this.json.meshes.forEach((mesh: GLTFMesh, index: number) => {
            if (!mesh.primitives || mesh.primitives.length === 0) {
                throw new Error(`Mesh: ${ mesh.name } at index: ${ index } has no primitives`);
            }

            const primitive = mesh.primitives[0];
            const positions = this.parseAccessor(primitive.attributes.POSITION);
            const indices = this.parseAccessor(primitive.indices);

            meshes.set(index, mesh);
            // meshes.set(`mesh_${ index }_positions`, positions);
            // meshes.set(`mesh_${ index }_indices`, indices);
        });

        return meshes;
    }

    private parseAccessor(accessorIndex: number): Float32Array | Uint16Array | Uint32Array {
        const accessor = this.json.accessors[accessorIndex];
        const bufferView = this.json.bufferViews[accessor.bufferView];

        if (!bufferView) throw new Error(`BufferView ${ accessor.bufferView } not found`);

        const buffer = this.binaryBuffer;
        if (!buffer) throw new Error('Binary buffer is missing');

        const start = bufferView.byteOffset || 0;
        const length = accessor.count * this.getComponentSize(accessor.componentType);

        const bufferSlice = buffer.slice(start, start + length);

        // Create a typed array based on the componentType
        switch (accessor.componentType) {
            case 5126: // FLOAT
                return new Float32Array(bufferSlice);
            case 5123: // UNSIGNED_SHORT
                return new Uint16Array(bufferSlice);
            case 5125: // UNSIGNED_INT
                return new Uint32Array(bufferSlice);
            default:
                throw new Error(`Unsupported componentType: ${ accessor.componentType }`);
        }
    }

    private getComponentSize(componentType: number): number {
        switch (componentType) {
            case 5120: // BYTE
            case 5121: // UNSIGNED_BYTE
                return 1;
            case 5122: // SHORT
            case 5123: // UNSIGNED_SHORT
                return 2;
            case 5125: // UNSIGNED_INT
                return 4;
            case 5126: // FLOAT
                return 4;
            default:
                throw new Error(`Unsupported componentType: ${ componentType }`);
        }
    }

    buildSceneGraph(rootNodeIndex: number): any {
        const buildNode = (nodeIndex: number): GLTFSceneGraph => {
            const node = this.nodes!.get(nodeIndex);
            if (!node) return { children: [] };

            const children = node.children.map((childIndex: number) => buildNode(childIndex));

            return {
                children,
                mesh: node.mesh,
                matrix: node.matrix,
            };
        };

        return buildNode(rootNodeIndex);
    }

    private parseNodes() {
        const nodes = new Map<number, GLTFNode>();
        this.json.nodes.forEach((node: GLTFNode, index: number) => {
            const parsedNode = {
                mesh: node.mesh,
                translation: node.translation || [0, 0, 0],
                rotation: node.rotation || [0, 0, 0, 1],
                scale: node.scale || [1, 1, 1],
                children: node.children || [],
                matrix: node.matrix || mat4.create(),
            };

            nodes.set(index, parsedNode);
        });

        return nodes;
    }

    parseMaterials(): Map<number, GLTFMaterial> {
        const materials = new Map<number, GLTFMaterial>();
        this.json.materials!.forEach((material: GLTFMaterial, index: number) => {
            const parsedMaterial: any = {};
            parsedMaterial.name = material.name
            // PBR Metallic-Roughness
            if (material.pbrMetallicRoughness) {
                const pbr = material.pbrMetallicRoughness;
                parsedMaterial.baseColorFactor = pbr.baseColorFactor || [1.0, 1.0, 1.0, 1.0];
                parsedMaterial.metallicFactor = pbr.metallicFactor ?? 1.0;
                parsedMaterial.roughnessFactor = pbr.roughnessFactor ?? 1.0;
                if (pbr.baseColorTexture) {
                    parsedMaterial.baseColorTexture = this.getTexture(pbr.baseColorTexture.index);
                }
            }

            // Normal Texture
            if (material.normalTexture) {
                parsedMaterial.normalTexture = this.getTexture(material.normalTexture.index);
            }

            // Emissive Factor
            parsedMaterial.emissiveFactor = material.emissiveFactor || [0.0, 0.0, 0.0];

            // Alpha Mode (e.g., OPAQUE, MASK, BLEND)
            parsedMaterial.alphaMode = material.alphaMode || 'OPAQUE';
            parsedMaterial.alphaCutoff = material.alphaCutoff ?? 0.5;

            materials.set(index, parsedMaterial);
        });

        return materials;
    }

    private getTexture(textureIndex: number): any {
        if (!this.json.textures || !this.json.textures[textureIndex]) {
            throw new Error(`Texture index ${ textureIndex } not found`);
        }

        const texture = this.json.textures[textureIndex];
        const image = this.json.images[texture.source];

        return {
            source: image.uri,
            sampler: this.getSampler(texture.sampler)
        };
    }

    private getSampler(samplerIndex: number): any {
        if (!this.json.samplers || !this.json.samplers[samplerIndex]) {
            return null; // Default sampler
        }

        return this.json.samplers[samplerIndex];
    }

}

interface GLTFJson {
    accessors: GLTFAccessor[]
    asset: {
        version: string;
        generator?: string;
    }
    bufferViews: GLTFBufferView[],
    buffers: GLTFBuffer[],
    images: GLTFImage[],
    materials?: GLTFMaterial[],
    meshes: GLTFMesh[]
    nodes: GLTFNode[]
    samplers: GLTFSampler[]
    scene?: GLTFScene
    scenes: GLTFScene[]
    textures?: [{ sampler: number, source: number }]
}

interface GLTFAccessor {
    bufferView: number,
    componentType: number,
    count: number,
    max: number[],
    min: number[],
    type: 'VEC2' | 'VEC3' | 'SCALAR',
    byteOffset: number
}

interface GLTFMesh {
    name: string,
    primitives: GLTFMeshPrimitive[]
}

interface GLTFMeshPrimitive {
    attributes: {
        NORMAL: number,
        POSITION: number,
        TANGENT: number,
        TEXCOORD_0: number,
        TEXCOORD_1: number,
        TEXCOORD_2: number,
        TEXCOORD_3: number
    },
    indices: number,
    material: number,
    mode: number
}

interface GLTFScene {
    nodes: number[];
}

interface GLTFSceneGraph {
    name?: string,
    matrix?: mat4,
    mesh?: number,
    children: GLTFSceneGraph[]
}

interface GLTFNode {
    name?: string,
    matrix?: mat4,
    mesh?: number;
    children: number[];
    translation?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
}

interface GLTFBuffer {
    uri: string;
    byteLength: number;
}

interface GLTFBufferView {
    buffer: number;
    byteOffset?: number;
    byteLength: number;
}

interface GLTFMaterial {
    name?: string;
    alphaMode?: 'MASK',
    alphaCutoff?: number,
    doubleSided: boolean,
    normalTexture: GLTFTextureRef,
    emissiveFactor?: number,
    pbrMetallicRoughness: {
        baseColorFactor: number[],
        baseColorTexture: GLTFTextureRef,
        metallicRoughnessTexture: GLTFTextureRef,
        metallicFactor?: number,
        roughnessFactor?: number,
    }
}

interface GLTFTextureRef {
    index: number
}

interface GLTFImage {
    uri?: string;
    bufferView?: number;
    mimeType?: string;
}


interface GLTFSampler {
    magFilter?: GLTFSamplerFilter,
    minFilter?: GLTFSamplerFilter,
    wrapS?: GLTFSamplerFilter,
    wrapT?: GLTFSamplerFilter,
}

enum GLTFSamplerFilter {
    LINEAR = 9729,
    MIP_MAP_LINEAR = 9987,
    REPEAT_WRAPPING = 10497
}


/*

function interleaveVertexData(attributes: GLTFPrimitiveAttribute,
    vertexCount: number,
    interleaveFormat: [keyof GLTFPrimitiveAttribute]): Float32Array {
    const stride = this.calculateStride(attributes, interleaveFormat);
    const BYTES_PER_ELEMENT = 4;
    const interleavedBuffer = new Float32Array(vertexCount * (stride / BYTES_PER_ELEMENT));

    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
        let offset = 0;

        for (const attributeName of interleaveFormat) {
            const accessorIndex = attributes[attributeName];
            if (accessorIndex === undefined) {
                console.warn(`Missing attribute: ${attributeName}`);
                continue;
            }

            const accessor = this.json.accessors[accessorIndex];
            const bufferView = this.json.bufferViews[accessor.bufferView];
            const buffer = this.buffers.get(bufferView.buffer)!;

            const byteOffset =
                (bufferView.byteOffset || 0) +
                (accessor.byteOffset || 0) +
                vertexIndex * (bufferView.byteStride || this.getTypeSize(accessor));

            const dataView = new DataView(buffer);
            for (let i = 0; i < this.getElementsCount(accessor); i++) {
                interleavedBuffer[vertexIndex * (stride / BYTES_PER_ELEMENT) + offset + i] = dataView.getFloat32(
                    byteOffset + i * BYTES_PER_ELEMENT,
                    true // little-endian
                );
            }

            offset += this.getElementsCount(accessor);
        }
    }

    return interleavedBuffer;



    calculateStride(attributes: GLTFPrimitiveAttribute,
                    interleaveFormat: [keyof GLTFPrimitiveAttribute]): number {
        let stride = 0;
        for (const attributeName of interleaveFormat) {
            const accessorIndex = attributes[attributeName];
            if (accessorIndex !== undefined) {
                const accessor = this.json.accessors[accessorIndex];
                stride += this.getTypeSize(accessor);
            }
        }
        return stride;
    }

     private calculateStrideOld(attributes: GLTFPrimitiveAttribute): number {
        let stride = 0;
        for (const attributeKey in attributes) {
            // @ts-ignore
            const accessor = this.json.accessors[attributes[attributeKey]];
            stride += this.getTypeSize(accessor);
        }
        return stride;
    }
}*/
