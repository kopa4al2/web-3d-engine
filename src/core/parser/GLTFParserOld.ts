// @ts-nocheck
import Mesh from "core/components/Mesh";
import Transform, { defaultTransform } from "core/components/Transform";
import GeometryFactory from "core/factories/GeometryFactory";
import MaterialFactory from "core/factories/MaterialFactory";
import Geometry from "core/mesh/Geometry";
import Material from "core/mesh/material/Material";
import { PBRMaterialProperties } from "core/mesh/material/MaterialProperties";
import { VertexShaderName } from "core/resources/cpu/CpuShaderData";
import { BlendPresets } from "core/resources/gpu/Blend";
import { BufferData, BufferUsage } from "core/resources/gpu/BufferDescription";
import ResourceManager from "core/resources/ResourceManager";
import ShaderManager from "core/resources/shader/ShaderManager";
import TextureManager from "core/resources/TextureManager";
import Texture from "core/texture/Texture";
import { mat4, vec4 } from 'gl-matrix';

export interface GLTFModel {
    label?: string,
    transform?: mat4,
    mesh?: Mesh,
}

export interface GLTFSceneGraph {
    name?: string,
    matrix?: mat4,
    mesh?: Mesh,
    children: GLTFSceneGraph[]
}

class WorkerPool {
    constructor(private workers: Worker[] = []) {
    }

    addWorker(worker: Worker) {
        this.workers.push(worker);
    }
}

export default class GLTFParser {
    private static readonly workerPool: WorkerPool = new WorkerPool();
    constructor(public rootDir: string, public json: GLTFJson, public buffers: Map<number, ArrayBuffer>) {
        console.log('GLTF JSON: ', json);
    }

    private async buildSceneGraph(rootNodeIndex: number): Promise<GLTFSceneGraph> {
        const buildNode = (nodeIndex: number): GLTFSceneGraph => {
            const node = this.json.nodes[nodeIndex];
            if (!node) return { children: [] };

            // const mesh = this.parseMesh(node.mesh);
            const children = (node.children || []).map((childIndex: number) => buildNode(childIndex));

            return {
                children,
                // mesh: node.mesh,
                matrix: node.matrix,
            };
        };

        return buildNode(rootNodeIndex);
    }


    public async createMeshes(shaderManager: ShaderManager, geometryFactory: GeometryFactory, materialFactory: MaterialFactory, resourceManager: ResourceManager): Promise<Mesh> {
        const worker = new Worker(new URL('./GLTFWorker.ts', import.meta.url), { name: 'GLTF-Worker'});

        console.log('worker:', worker)

        const textureManager: TextureManager = resourceManager.textureManager;

        const buildNode = async (node: GLTFNode, parentTransform?: Transform): Promise<Mesh> => {
            // const buildNode = async (node: GLTFNode, transform?: mat4): Promise<Mesh> => {
            let newTransform: Transform;
            if (node.matrix) {
                newTransform = Transform.fromMat4(node.matrix);
            } else {
                newTransform = defaultTransform();
            }
            newTransform.children = [];

            if (parentTransform) {
                newTransform.parent = parentTransform;
                parentTransform.children?.push(newTransform);
            }

            const currentModel: Partial<Mesh> = {
                id: Mesh.ID,
                subMesh: [],
                modelMatrix: newTransform,
                setBindGroup: Mesh.prototype.setBindGroup,
            };

            if (node.mesh) {
                const mesh = this.json.meshes[node.mesh];
                if (mesh.primitives.length > 1) {
                    console.warn('MORE than one PRIMITIVES', mesh)
                }
                for (const primitive of mesh.primitives) {
                    const vertexInstancedBuffer = resourceManager.createBuffer({
                        label: `sponza-atrium-vertex-instance`,
                        byteLength: 4096,
                        usage: BufferUsage.STORAGE | BufferUsage.COPY_DST
                    });

                    const vertexInstancedLayout = resourceManager.getOrCreateLayout(ShaderManager.INSTANCE_BUFFER_GROUP);
                    const vertexBindGroup = resourceManager.createBindGroup(vertexInstancedLayout, {
                        label: 'sponza-atrium-instance',
                        entries: [{
                            binding: 0,
                            bufferId: vertexInstancedBuffer,
                            name: 'InstanceData',
                            type: 'storage'
                        }]
                    })
                    const gltfMaterial = this.json.materials[primitive.material];

                    // this.createMaterial(gltfMaterial, materialFactory, textureManager)
                    //     .then(material => {
                    //         const geometry = this.createGeometry(mesh.name, primitive, geometryFactory);
                    //
                    //         currentModel.pipelineId = shaderManager.createPipeline(geometry, material);
                    //         currentModel.geometry = geometry;
                    //         currentModel.material = material;
                    //         currentModel.instanceBuffers = [{
                    //             bindGroupId: vertexBindGroup,
                    //             bufferId: vertexInstancedBuffer
                    //         }]
                    //     })
                    const material = await this.createMaterial(gltfMaterial, materialFactory, textureManager);
                    const geometry = this.createGeometry(mesh.name, primitive, geometryFactory);


                    currentModel.pipelineId = shaderManager.createPipeline(geometry, material);
                    currentModel.geometry = geometry;
                    currentModel.material = material;
                    currentModel.instanceBuffers = [{
                        bindGroupId: vertexBindGroup,
                        bufferId: vertexInstancedBuffer
                    }]
                }

            }

            if (node.children) {
                for (const childIndex of node.children) {
                    const childModel = await buildNode(this.json.nodes[childIndex], newTransform);
                    currentModel.subMesh!.push(childModel);
                }
            }


            return currentModel as Mesh;
        };

        return buildNode(this.json.nodes[0]);
        // return buildNode(this.json.nodes[0], mat4.create());
    }

    public async createMaterial(material: GLTFMaterial, materialFactory: MaterialFactory, textureManager: TextureManager): Promise<Material> {

        const {
            baseColorFactor, metallicFactor, roughnessFactor,
            baseColorTexture, normalTexture, metallicRoughnessTexture,
        } = this.parseMaterial(material);

        if ((!(normalTexture && normalTexture.uri))) {
            console.log('Material without normal: ', material)
        }
        const normal = (normalTexture && normalTexture.uri)
            ? await textureManager.addToGlobalTexture(this.rootDir + normalTexture.uri)
            : await textureManager.create1x1Texture(Texture.DEFAULT_NORMAL_MAP, new Uint8ClampedArray([0, 255, 0, 255]));
        const albedo = (baseColorTexture && baseColorTexture.uri)
            ? await textureManager.addToGlobalTexture(this.rootDir + baseColorTexture.uri)
            : await textureManager.create1x1Texture(Texture.DEFAULT_ALBEDO_MAP, new Uint8ClampedArray([255, 255, 255, 255]));
        const metallicRoughness = (metallicRoughnessTexture && metallicRoughnessTexture.uri)
            ? await textureManager.addToGlobalTexture(this.rootDir + metallicRoughnessTexture.uri)
            : await textureManager.create1x1Texture(Texture.DEFAULT_METALLIC_ROUGHNESS_MAP, new Uint8ClampedArray([255, metallicFactor * 255, roughnessFactor * 255, 255]));

        if (material.pbrMetallicRoughness.metallicFactor || material.pbrMetallicRoughness.roughnessFactor) {
            // console.log('Material has metallic or roughness factor: ', material, ' texture; ', metallicRoughnessTexture)
        }

        const blendMode = material.alphaMode === 'BLEND' ? BlendPresets.TRANSPARENT : undefined;
        return materialFactory.pbrMaterial(material.name, new PBRMaterialProperties(albedo, normal, metallicRoughness, new Float32Array(baseColorFactor)),
            {
                blendMode,
                cullFace: material.doubleSided ? 'none' : 'back'
            });
    }

    parseMaterial(material: GLTFMaterial): ParsedMaterial {
        const pbr = material.pbrMetallicRoughness || {};

        const baseColorFactor = pbr.baseColorFactor || [1.0, 1.0, 1.0, 1.0];
        const metallicFactor = pbr.metallicFactor ?? 1.0;
        const roughnessFactor = pbr.roughnessFactor ?? 1.0;

        const baseColorTexture = pbr.baseColorTexture
            ? this.parseTexture(pbr.baseColorTexture.index)
            : null;

        const normalTexture = material.normalTexture
            ? this.parseTexture(material.normalTexture.index)
            : null;

        const metallicRoughnessTexture = pbr.metallicRoughnessTexture
            ? this.parseTexture(pbr.metallicRoughnessTexture.index)
            : null;

        if (pbr.baseColorTexture?.texCoord || material.normalTexture?.texCoord || pbr.metallicRoughnessTexture?.texCoord) {
            // console.log('Material has overridden texCoord ', material)
        }

        return {
            baseColorFactor,
            metallicFactor,
            roughnessFactor,
            baseColorTexture,
            normalTexture,
            metallicRoughnessTexture,
        };
    }

    parseTexture(textureIndex: number): ParsedTexture {
        const texture = this.json.textures[textureIndex];
        const imageIndex = texture.source;
        const image = this.json.images[imageIndex];

        if (image.uri) {
            return {
                type: "uri",
                uri: image.uri,
            };
        } else if (image.bufferView !== undefined) {
            const bufferView = this.json.bufferViews[image.bufferView];
            const buffer = this.buffers.get(bufferView.buffer)!;

            const start = bufferView.byteOffset || 0;
            const length = bufferView.byteLength;
            const imageData = buffer.slice(start, start + length);

            return {
                type: "buffer",
                data: imageData,
            };
        } else {
            throw new Error("Unsupported texture format");
        }
    }


    public createGeometry(name: string, primitive: GLTFMeshPrimitive, geometryFactory: GeometryFactory): Geometry {
        const indices = this.parseAccessor(primitive.indices);
        const vertices = this.parseAccessor(primitive.attributes.POSITION);
        const normals = this.parseAccessor(primitive.attributes.NORMAL);
        const texCoords = name === 'material_11'
            ? this.parseAccessor(primitive.attributes.TEXCOORD_2)
            : this.parseAccessor(primitive.attributes.TEXCOORD_0);
        if (primitive.attributes.TANGENT === undefined) {
            // console.log('missing tangents', primitive, name)
        }
        const tangents = this.parseOrDefault(primitive.attributes.TANGENT, vec4.fromValues(0, 0, 0, 0) as Float32Array);

        return geometryFactory.createGeometry(
            name,
            VertexShaderName.LIT_TANGENTS_VEC4,
            { indices, vertices, normals, texCoords, tangents });
    }

    parseAccessor(accessorIndex: number): BufferData {
        const accessor = this.json.accessors[accessorIndex];
        const bufferView = this.json.bufferViews[accessor.bufferView];
        const buffer = this.buffers.get(bufferView.buffer)!;

        const start = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
        const componentSize = this.getBytesPerElement(accessor.componentType);
        const elementsPerVertex = this.getElementsCount(accessor.type);
        const bytesPerVertex = this.getBytesPerVertex(accessor);
        const stride = bufferView.byteStride || bytesPerVertex;
        const totalVertices = accessor.count;

        const sourceBuffer = new DataView(buffer);
        const targetBuffer = new ArrayBuffer(totalVertices * bytesPerVertex);
        const targetBufferView = new DataView(targetBuffer);

        // if (accessor.componentType === 5123) { // UNSIGNED_SHORT
        //     return new Uint16Array(buffer, start, totalVertices);
        // } else if (accessor.componentType === 5125) { // UNSIGNED_INT
        //     return new Uint32Array(buffer, start, totalVertices);
        // } else if (accessor.componentType === 5126) { // FLOAT
        //     return new Float32Array(buffer, start, totalVertices)
        // }

        // console.log('Raw buffer data: ', new Uint8Array(buffer, bufferView.byteOffset, totalVertices),
        //             'Float32 data: ', new Float32Array(buffer, start, totalVertices),
        //             'Accessor.count: ', totalVertices,
        //             ' Stride: ', stride,
        //             ' BytesPerVertex: ', bytesPerVertex,
        //             ' Elements per vertex: ', elementsPerVertex,
        //             ' Start: ', start);

        for (let i = 0; i < totalVertices; i++) {
            const offset = start + i * stride;

            for (let j = 0; j < elementsPerVertex; j++) {
                const sourceOffset = offset + j * componentSize;
                // const sourceOffset = offset + j * elementsPerVertex;
                // const targetOffset = i * bytesPerVertex + j * elementsPerVertex;
                const targetOffset = i * bytesPerVertex + j * componentSize;

                // console.log(`Offset: ${sourceOffset}, Value: ${sourceBuffer.getFloat32(sourceOffset, true)}`);

                if (sourceOffset + componentSize > start + bufferView.byteLength) {
                    console.error('Source offset exceeds buffer bounds', sourceOffset, buffer.byteLength);
                    throw new Error('Source offset exceeds buffer bounds');
                }

                this.setData(accessor.componentType, sourceBuffer, targetBufferView, sourceOffset, targetOffset);
            }
        }

        if (accessor.componentType === 5123) { // UNSIGNED_SHORT
            return new Uint16Array(targetBuffer);
        } else if (accessor.componentType === 5125) { // UNSIGNED_INT
            return new Uint32Array(targetBuffer);
        } else if (accessor.componentType === 5126) { // FLOAT
            return new Float32Array(targetBuffer)
        } else {
            console.warn(`Unknown componentType: ${ accessor.componentType }, returning Uint8Array`);
            return new Uint8Array(targetBuffer);
        }
    }


    private getElementsCount(type: AccessorType): number {
        const typeToSize: Record<string, number> = {
            SCALAR: 1,
            VEC2: 2,
            VEC3: 3,
            VEC4: 4,
            MAT4: 16,
        };
        return typeToSize[type];
    }

    private getBytesPerElement(componentType: AccessorComponentType): number {
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
                throw new Error(`Unsupported componentType: ${ componentType }`);
        }
    }

    private getBytesPerVertex(accessor: GLTFAccessor): number {
        const { componentType, type } = accessor;
        const componentSize = this.getBytesPerElement(componentType);
        const typeSize = this.getElementsCount(type);
        return componentSize * typeSize;
    }

    private setData(componentType: AccessorComponentType,
                    sourceBuffer: DataView<ArrayBuffer>,
                    targetBuffer: DataView<ArrayBuffer>,
                    sourceOffset: number,
                    targetOffset: number) {
        switch (componentType) {
            case 5120 :
                targetBuffer.setInt8(targetOffset, sourceBuffer.getInt8(sourceOffset));
                break;
            case 5121 :
                targetBuffer.setUint8(targetOffset, sourceBuffer.getUint8(sourceOffset));
                break;
            case 5122 :
                targetBuffer.setInt16(targetOffset, sourceBuffer.getInt16(sourceOffset, true), true);
                break;
            case 5123 :
                targetBuffer.setUint16(targetOffset, sourceBuffer.getUint16(sourceOffset, true), true);
                break;
            case 5125 :
                targetBuffer.setUint32(targetOffset, sourceBuffer.getUint32(sourceOffset, true), true);
                break;
            case 5126 :
                targetBuffer.setFloat32(targetOffset, sourceBuffer.getFloat32(sourceOffset, true), true);
                break;
        }
    }

    public static async parseGlb(rootDir: string, relativePath: string): Promise<GLTFParser> {
        const fileArrayBuffer = await fetch(rootDir + relativePath).then(res => res.arrayBuffer());
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
        const gltfJson = JSON.parse(new TextDecoder().decode(jsonChunk));

        // Read binary chunk
        const binaryChunkOffset = 20 + jsonChunkLength;
        const binaryChunkType = dataView.getUint32(binaryChunkOffset + 4, true);
        if (binaryChunkType !== 0x004E4942) { // "BIN"
            throw new Error('Expected BIN chunk in GLB');
        }
        const buffer = fileArrayBuffer.slice(binaryChunkOffset + 8);

        return new GLTFParser(rootDir, gltfJson, await this.parseBuffers(rootDir, gltfJson, buffer));
    }

    public static async parseGltf(rootDir: string, gltfPath: string, binaryPath: string): Promise<GLTFParser> {
        const [json, binary] = await Promise.all([
            fetch(rootDir + gltfPath).then(res => res.json()),
            fetch(rootDir + binaryPath).then(res => res.arrayBuffer())
        ]);

        return new GLTFParser(rootDir, json, await this.parseBuffers(rootDir, json, binary));
    }

    private static async parseBuffers(rootPath: string, json: GLTFJson, glbBinaryData?: ArrayBuffer): Promise<Map<number, ArrayBuffer>> {
        const buffers = new Map<number, ArrayBuffer>();

        // Iterate over the buffers in the glTF JSON
        for (let i = 0; i < json.buffers.length; i++) {
            const buffer = json.buffers[i];
            if (buffer.uri) {
                console.log(buffer.uri)
                // Handle external or base64-encoded buffers
                if (buffer.uri.startsWith('data:')) {
                    // Base64-encoded binary data
                    const base64Data = buffer.uri.split(',')[1];
                    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                    buffers.set(i, binaryData.buffer);
                } else if (glbBinaryData) {
                    // Use the binary chunk from the GLB file
                    buffers.set(i, glbBinaryData);
                } else {
                    // External file (load it via fetch)
                    const response = await fetch(rootPath + buffer.uri);
                    if (!response.ok) throw new Error(`Failed to load buffer: ${ buffer.uri }`);
                    buffers.set(i, await response.arrayBuffer());
                }
            } else if (glbBinaryData) {
                // Use the binary chunk from the GLB file
                buffers.set(i, glbBinaryData);
            } else {
                throw new Error(`Buffer ${ i } is missing data`);
            }
        }

        return buffers;
    }

    private parseOrDefault(primitive: number | undefined, defaultValue: BufferData): BufferData {
        if (primitive === undefined) {
            return defaultValue;
        }
        return this.parseAccessor(primitive);
    }
}

export interface GLTFJson {
    accessors: GLTFAccessor[]
    asset: {
        version: string;
        generator?: string;
    }
    bufferViews: GLTFBufferView[],
    buffers: GLTFBuffer[],
    images: GLTFImage[],
    materials: GLTFMaterial[],
    meshes: GLTFMesh[]
    nodes: GLTFNode[]
    samplers: GLTFSampler[]
    scene?: GLTFScene
    scenes: GLTFScene[]
    textures: [{ sampler: number, source: number }]
}

type AccessorType = 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT4';

type AccessorComponentType = 5120 | 5121 | 5122 | 5123 | 5125 | 5126;

export interface GLTFAccessor {
    bufferView: number,
    byteOffset: number,
    componentType: AccessorComponentType,
    count: number,
    max: number[],
    min: number[]
    type: AccessorType,
}

export interface GLTFMesh {
    name: string,
    primitives: GLTFMeshPrimitive[]
}

export interface GLTFPrimitiveAttribute {
    NORMAL: number,
    POSITION: number,
    TANGENT: number,
    TEXCOORD_0: number,
    TEXCOORD_1: number,
    TEXCOORD_2: number,
    TEXCOORD_3: number
};

export interface GLTFMeshPrimitive {
    attributes: GLTFPrimitiveAttribute,
    indices: number,
    material: number,
    mode: number
}

export interface GLTFScene {
    nodes: number[];
}

export interface GLTFNode {
    name?: string,
    matrix?: mat4,
    mesh?: number;
    children: number[];
    translation?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
}

export interface GLTFBuffer {
    uri: string;
    byteLength: number;
}

export interface GLTFBufferView {
    buffer: number;
    byteLength: number;
    byteOffset?: number;
    byteStride: number;
    name: string;
    target: number;
}

export interface GLTFMaterial {
    name?: string;
    alphaMode?: 'MASK' | 'BLEND',
    alphaCutoff?: number,
    doubleSided?: boolean,
    normalTexture?: GLTFTextureRef,
    emissiveFactor?: number,
    pbrMetallicRoughness: {
        baseColorFactor: number[],
        baseColorTexture: GLTFTextureRef,
        metallicRoughnessTexture: GLTFTextureRef,
        metallicFactor?: number,
        roughnessFactor?: number,
    }
}

export interface GLTFTextureRef {
    index: number,
    texCoord?: number,
}

export interface GLTFImage {
    uri?: string;
    bufferView?: number;
    mimeType?: string;
}


export interface GLTFSampler {
    magFilter?: GLTFSamplerFilter,
    minFilter?: GLTFSamplerFilter,
    wrapS?: GLTFSamplerFilter,
    wrapT?: GLTFSamplerFilter,
}

export enum GLTFSamplerFilter {
    LINEAR = 9729,
    MIP_MAP_LINEAR = 9987,
    REPEAT_WRAPPING = 10497
}


interface ParsedMaterial {
    baseColorFactor: number[]; // RGBA
    metallicFactor: number;
    roughnessFactor: number;
    baseColorTexture: ParsedTexture | null;
    normalTexture: ParsedTexture | null;
    metallicRoughnessTexture: ParsedTexture | null;
}

interface ParsedTexture {
    type: "uri" | "buffer";
    uri?: string; // For external textures
    data?: ArrayBuffer; // For embedded textures
}


/*public createGeometries(geometryFactory: GeometryFactory): Geometry[] {
        const geometries: Geometry[] = [];
        for (const mesh of this.json.meshes) {
            const primitive = mesh.primitives[0];

            // console.groupCollapsed('Indices')
            const indices = this.parseAccessor(primitive.indices);
            // console.log('Indices: ', [...indices])
            // console.groupEnd()
            // console.groupCollapsed('Vertices')
            const vertices = this.parseAccessor(primitive.attributes.POSITION);
            // console.log('Vertices: ', [...vertices])
            // console.groupEnd()
            // console.groupCollapsed('Normals')
            const normals = this.parseAccessor(primitive.attributes.NORMAL);
            // console.log('Normals: ', normals)
            // console.groupEnd()
            // console.groupCollapsed('TexCoord')
            const texCoords = this.parseAccessor(primitive.attributes.TEXCOORD_0);
            // console.log('Tex coordinates: ', texCoords)
            // console.groupEnd()
            // console.groupCollapsed('Tangents')
            const tangents = this.parseOrDefault(primitive.attributes.TANGENT, vec4.fromValues(0, 0, 0, 0) as Float32Array);
            // console.log('Tangents: ', tangents)
            // console.groupEnd()
            // const bitangents = MathUtil.calculateBiTangents(normals, tangents, vertices.length / 3);

            const geometry = geometryFactory.createGeometry(
                mesh.name,
                VertexShaderName.LIT_TANGENTS_VEC4,
                { indices, vertices, normals, texCoords, tangents });

            geometries.push(geometry);


            /!*
             for (let i = 0; i < 4; i++) {
                 const texcoordKey = `TEXCOORD_${ i }`;
                 // @ts-ignore
                 if (primitive.attributes[texcoordKey] !== undefined) {
                     console.groupCollapsed(`TEXCOORD_${ texcoordKey }`);
                     // @ts-ignore
                     meshData.texCoords[i] = this.parseAccessor(primitive.attributes[texcoordKey]);
                     console.groupEnd()
                 }
             }*!/


        }
        return geometries;
    }*/


/*

    public async createMaterials(materialFactory: MaterialFactory, textureManager: TextureManager): Promise<Material[]> {

        const materials = [];
        for (const mesh of this.json.meshes) {
            const primitive = mesh.primitives[0];
            const material = this.json.materials[primitive.material];
            const { pbrMetallicRoughness } = material;

            const {
                baseColorTexture,
                metallicRoughnessTexture,
                baseColorFactor,
                roughnessFactor,
                metallicFactor
            } = pbrMetallicRoughness;

            // const texture = this.getTexture(baseColorTexture);
            const { sampler, source } = this.json.textures[baseColorTexture.index];
            // const { sampler, source } = this.json.textures[metallicRoughnessTexture.index];

            // console.log('Primitive: ', primitive, ' Material: ', material, ' Sampler: ', sampler, ' Source', source)

            const result = this.parseMaterial(this.json.materials[primitive.material])
            materials.push(result);
        }

        console.log(materials)
        // @ts-ignore
        return await Promise.all(materials.map(async (mat) => {
            if (!mat.normalTexture || !mat.normalTexture!.uri) {
                console.warn('Material without normal texture uri ', mat)
                return;
            }
            if (!mat.baseColorTexture || !mat.baseColorTexture!.uri) {
                console.warn('Material without baseColorTexture texture uri ', mat)
                return;
            }

            const albedo = await textureManager.addToGlobalTexture(this.rootDir + mat.normalTexture!.uri!);
            const normal = await textureManager.addToGlobalTexture(this.rootDir + mat.baseColorTexture!.uri!);

            return materialFactory.pbrMaterial('label', new PBRMaterialProperties(albedo, normal, normal, vec4.fromValues(1, 1, 1, 1)));
        }))
    }

 */
