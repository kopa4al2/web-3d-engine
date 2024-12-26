import Mesh from "core/components/Mesh";
import Transform, { defaultTransform } from "core/components/Transform";
import GeometryFactory from "core/factories/GeometryFactory";
import MaterialFactory from "core/factories/MaterialFactory";
import Geometry, { GeometryData } from "core/mesh/Geometry";
import { PBRMaterialProperties } from "core/mesh/material/MaterialProperties";
import { GLTFWorkerRequest, GLTFWorkerResponse } from "core/parser/gltf/GLTFWorker";
import { VertexShaderName } from "core/resources/cpu/CpuShaderData";
import { BlendPresets } from "core/resources/gpu/Blend";
import { BufferData, BufferUsage } from "core/resources/gpu/BufferDescription";
import { PipelineColorAttachment } from "core/resources/gpu/GpuShaderData";
import ResourceManager from "core/resources/ResourceManager";
import ShaderManager from "core/resources/shader/ShaderManager";
import TextureManager from "core/resources/TextureManager";
import Texture from "core/texture/Texture";
import WorkerPool from "core/worker/WorkerPool";
import { mat4 } from 'gl-matrix';
import DebugUtil from "../../../util/debug/DebugUtil";
import MathUtil from "../../../util/MathUtil";
import directionalLight from 'core/light/DirectionalLight';
import Globals from '../../../engine/Globals';

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

export default class GLTFParser {
    private static readonly workerPool = new WorkerPool<GLTFWorkerRequest, GLTFWorkerResponse>();

    constructor(public rootDir: string, public json: GLTFJson, public buffers: Map<number, ArrayBuffer>, public images: Texture[]) {
        DebugUtil.addToWindowObject('gltf', this);
    }

    public createMeshes(shaderManager: ShaderManager,
                        geometryFactory: GeometryFactory,
                        materialFactory: MaterialFactory,
                        resourceManager: ResourceManager): Mesh {
        const textureManager: TextureManager = resourceManager.textureManager;

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
        });
        
        let counter = 1;
        const buildNode = (node: GLTFNode, parentTransform?: Transform): Mesh => {
            const newTransform = node.matrix
                ? Transform.fromMat4(node.matrix)
                : defaultTransform();
            
            newTransform.label = node.name;
            if (parentTransform) {
                newTransform.parent = parentTransform;
                parentTransform.children.push(newTransform);
            }

            const currentModel: Partial<Mesh> = {
                id: Mesh.ID,
                subMesh: [],
                transform: newTransform,
                setBindGroup: Mesh.prototype.setBindGroup,
                label: node.name
            };

            if (node.mesh) {

                const mesh = this.json.meshes[node.mesh];
                currentModel.label = mesh.name;
                if (mesh.primitives.length > 1) {
                    console.warn('MORE than one PRIMITIVES', mesh)
                }
                for (const primitive of mesh.primitives) {
                    const gltfMaterial = this.json.materials[primitive.material];
                    const pbr = gltfMaterial.pbrMetallicRoughness || {};
                    const baseColorFactor = pbr.baseColorFactor || [1.0, 1.0, 1.0, 1.0];
                    const metallicFactor = pbr.metallicFactor ?? 1.0;
                    const roughnessFactor = pbr.roughnessFactor ?? 1.0;


                    const normal = gltfMaterial.normalTexture
                        ? this.images[gltfMaterial.normalTexture.index]
                        : textureManager.getTexture(Texture.DEFAULT_NORMAL_MAP);
                    const albedo = pbr.baseColorTexture
                        ? this.images[pbr.baseColorTexture.index]
                        : textureManager.getTexture(Texture.DEFAULT_ALBEDO_MAP);
                    const metallicRoughness = pbr.metallicRoughnessTexture
                        ? this.images[pbr.metallicRoughnessTexture.index]
                        : textureManager.create1x1Texture(
                            `${Texture.DEFAULT_METALLIC_ROUGHNESS_MAP}-${metallicFactor}-${roughnessFactor}`,
                            new Uint8ClampedArray([255, metallicFactor * 255, roughnessFactor * 255, 255]));


                    // const blendMode = BlendPresets.TRANSPARENT;
                    const blendMode = gltfMaterial.alphaMode === 'BLEND' ? BlendPresets.TRANSPARENT : undefined;
                    const pbrMaterialProperties = new PBRMaterialProperties(
                        albedo.index, normal.index, metallicRoughness.index, new Float32Array(baseColorFactor));

                    const material = materialFactory.pbrMaterial(gltfMaterial.name,
                        pbrMaterialProperties,
                        {
                            colorAttachment: { blendMode } as PipelineColorAttachment,
                            cullFace: gltfMaterial.doubleSided ? 'none' : 'back'
                        });

                    const geometry = this.createGeometry(mesh.name, primitive, geometryFactory);

                    if (
                        node.name?.includes('50')
                        || node.name?.includes('57') || node.name?.includes('81')
                        || node.name?.includes('46')
                        || node.name?.endsWith('_9')
                    ) {
                        console.groupCollapsed(node.name);

                        console.log(`geometry: ${mesh.name}`, geometry);
                        console.log(`material: ${gltfMaterial.name}`, pbrMaterialProperties);
                        
                        console.groupEnd();
                    }

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
                    // if (counter++ > 10) {
                    //     return currentModel as Mesh;
                    // }
                    const childModel = buildNode(this.json.nodes[childIndex], newTransform);
                    currentModel.subMesh!.push(childModel);
                }
            }


            return currentModel as Mesh;
        };

        const startOffset = 0;
        return buildNode(this.json.nodes[startOffset]);
    }

    public createGeometry(name: string, primitive: GLTFMeshPrimitive, geometryFactory: GeometryFactory): Geometry {
        const indices = this.parseAccessor(primitive.indices);
        const vertices = this.parseAccessor(primitive.attributes.POSITION);
        const normals = this.parseAccessor(primitive.attributes.NORMAL);
        const texCoords = name === 'material_11'
            ? this.parseAccessor(primitive.attributes.TEXCOORD_2)
            : this.parseAccessor(primitive.attributes.TEXCOORD_0);
        
        if (Globals.FRACT_UV_ON_CPU) {
            for (let i = 0; i < texCoords.length; i+=2) {
                // texCoords[i] = Math.max(0.0, Math.min(texCoords[i], 1.0));
                // texCoords[i + 1] = Math.max(0.0, Math.min(texCoords[i + 1], 1.0));
                // texCoords[i] = MathUtil.fract(texCoords[i]);
                // texCoords[i+1] = MathUtil.fract(texCoords[i+1]);
            }
        }
        
        if (primitive.attributes.TANGENT === undefined) {
            console.warn(`Geometry with name: ${name} is missing tangent. Will generate tangents on the cpu`, primitive);
            return geometryFactory.createGeometry(
                name,
                VertexShaderName.LIT_TANGENTS_VEC4,
                MathUtil.calculateTangentsVec4({ indices, vertices, normals, texCoords } as GeometryData))

        }
        const tangents = this.parseAccessor(primitive.attributes.TANGENT);

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
            console.warn(`Unknown componentType: ${accessor.componentType}, returning Uint8Array`);
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
                throw new Error(`Unsupported componentType: ${componentType}`);
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
        const json = JSON.parse(new TextDecoder().decode(jsonChunk));

        // Read binary chunk
        const binaryChunkOffset = 20 + jsonChunkLength;
        const binaryChunkType = dataView.getUint32(binaryChunkOffset + 4, true);
        if (binaryChunkType !== 0x004E4942) { // "BIN"
            throw new Error('Expected BIN chunk in GLB');
        }
        const buffer = fileArrayBuffer.slice(binaryChunkOffset + 8);

        console.log('GLB JSON: ', json);
        return new GLTFParser(rootDir, json, await this.parseBuffers(rootDir, json, buffer), []);
    }

    // public static async parseGltf(rootDir: string, gltfPath: string, binaryPath: string): Promise<GLTFParser> {
    public static async parseGltf(rootDir: string, gltfPath: string, binaryPath: string, textureManager: TextureManager): Promise<GLTFParser> {
        const [json, binary] = await Promise.all([
            fetch(rootDir + gltfPath).then(res => res.json()),
            fetch(rootDir + binaryPath).then(res => res.arrayBuffer())
        ]);


        this.workerPool.addWorker(new Worker(new URL('./GLTFWorker.ts', import.meta.url), { name: 'GLTF-Worker-1' }));
        this.workerPool.addWorker(new Worker(new URL('./GLTFWorker.ts', import.meta.url), { name: 'GLTF-Worker-2' }));
        this.workerPool.addWorker(new Worker(new URL('./GLTFWorker.ts', import.meta.url), { name: 'GLTF-Worker-3' }));
        this.workerPool.addWorker(new Worker(new URL('./GLTFWorker.ts', import.meta.url), { name: 'GLTF-Worker-4' }));
        this.workerPool.addWorker(new Worker(new URL('./GLTFWorker.ts', import.meta.url), { name: 'GLTF-Worker-5' }));
        this.workerPool.addWorker(new Worker(new URL('./GLTFWorker.ts', import.meta.url), { name: 'GLTF-Worker-6' }));

        const buffers = await this.parseBuffers(rootDir, json, binary);
        const images = await this.parseImages(rootDir, json, textureManager, binary);

        console.log('GLTF JSON: ', json);
        this.workerPool.removeAll();
        return new GLTFParser(rootDir, json, buffers, images);
    }

    private static async parseImages(rootPath: string, json: GLTFJson, textureManager: TextureManager, glbBinaryData?: ArrayBuffer): Promise<Texture[]> {
        const promises: Promise<any>[] = [];

        for (let i = 0; i < json.images.length; i++) {
            const idx = i;
            const image = json.images[i];
            if (image.uri) {
                // const uri = 'assets/scene/sponza_atrium/gltf/textures/material_3_baseColor.jpeg';
                const uri = rootPath + image.uri;
                // promises.push(fetch(uri)
                //     .then(response => response.blob())
                //     .then(blob => createImageBitmap(blob))
                //     .then(bitmap => {
                //         const width = bitmap.width;
                //         const height = bitmap.height;
                //         const canvas = new OffscreenCanvas(width, height);
                //         const context = canvas.getContext('2d', { willReadFrequently: true })!;
                //         context.drawImage(bitmap, 0, 0);
                //
                //         return textureManager.addPreloadedToGlobalTexture(uri, context.getImageData(0, 0, width, height));
                //     }));
                promises.push(this.workerPool.submit({ uri })
                    .then(({ width, height, data }) => {
                        return textureManager
                            .addPreloadedToGlobalTexture(uri, new ImageData(new Uint8ClampedArray(data), width, height))
                    }));
            } else if (image.bufferView !== undefined) {
                const bufferView = json.bufferViews[image.bufferView];
                console.warn(`Image at idx: ${i} is expecting a bufferView: `, image, bufferView);
            } else {
                console.error('Image: ', image);
                throw new Error("Unsupported texture format");
            }
        }

        return Promise.all(promises);
    }

    private static async parseBuffers(rootPath: string, json: GLTFJson, glbBinaryData?: ArrayBuffer): Promise<Map<number, ArrayBuffer>> {
        const buffers = new Map<number, ArrayBuffer>();

        // Iterate over the buffers in the glTF JSON
        for (let i = 0; i < json.buffers.length; i++) {
            const buffer = json.buffers[i];
            if (buffer.uri) {
                // console.warn('Buffer has uri: ', buffer)
                // Handle external or base64-encoded buffers
                if (buffer.uri.startsWith('data:')) {
                    console.warn('Buffer uri starts with `data:`');
                    // Base64-encoded binary data
                    const base64Data = buffer.uri.split(',')[1];
                    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                    buffers.set(i, binaryData.buffer);
                } else if (glbBinaryData) {
                    // console.log('Buffer is part of the preloaded binary')
                    // Use the binary chunk from the GLB file
                    buffers.set(i, glbBinaryData);
                } else {
                    console.warn('Buffer is external file: ', buffer)
                    // External file (load it via fetch)
                    const response = await fetch(rootPath + buffer.uri);
                    if (!response.ok) throw new Error(`Failed to load buffer: ${buffer.uri}`);
                    buffers.set(i, await response.arrayBuffer());
                }
            } else if (glbBinaryData) {
                // Use the binary chunk from the GLB file
                buffers.set(i, glbBinaryData);
            } else {
                throw new Error(`Buffer ${i} is missing data`);
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
    name: string,
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


const GLTFRenderMode = {
    POINTS: 0,
    LINE: 1,
    LINE_LOOP: 2,
    LINE_STRIP: 3,
    TRIANGLES: 4,
    TRIANGLE_STRIP: 5,
    // Note: fans are not supported in WebGPU, use should be
    // an error or converted into a list/strip
    TRIANGLE_FAN: 6,
};

const GLTFComponentType = {
    BYTE: 5120,
    UNSIGNED_BYTE: 5121,
    SHORT: 5122,
    UNSIGNED_SHORT: 5123,
    INT: 5124,
    UNSIGNED_INT: 5125,
    FLOAT: 5126,
    DOUBLE: 5130,
};

const GLTFTextureFilter = {
    NEAREST: 9728,
    LINEAR: 9729,
    NEAREST_MIPMAP_NEAREST: 9984,
    LINEAR_MIPMAP_NEAREST: 9985,
    NEAREST_MIPMAP_LINEAR: 9986,
    LINEAR_MIPMAP_LINEAR: 9987,
};

const GLTFTextureWrap = {
    REPEAT: 10497,
    CLAMP_TO_EDGE: 33071,
    MIRRORED_REPEAT: 33648,
};
