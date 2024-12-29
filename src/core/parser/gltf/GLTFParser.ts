import Mesh from "core/components/Mesh";
import Transform, { defaultTransform } from "core/components/Transform";
import EntityManager, { EntityId } from "core/EntityManager";
import GeometryFactory from "core/factories/GeometryFactory";
import MaterialFactory from "core/factories/MaterialFactory";
import Geometry, { GeometryData } from "core/mesh/Geometry";
import { PBRMaterialProperties } from "core/mesh/material/MaterialProperties";
import { GLBWorkerRequest, GLBWorkerResponse } from "core/parser/gltf/GLBWorker";
import { GLTFWorkerRequest, GLTFWorkerResponse } from "core/parser/gltf/GLTFWorker";
import { BindGroupHelper } from "core/rendering/Helpers";
import { VertexShaderName } from "core/resources/cpu/CpuShaderData";
import { BlendPresets } from "core/resources/gpu/Blend";
import { BufferData } from "core/resources/gpu/BufferDescription";
import { PipelineColorAttachment, UniformVisibility } from "core/resources/gpu/GpuShaderData";
import ResourceManager from "core/resources/ResourceManager";
import ShaderManager from "core/resources/shader/ShaderManager";
import TextureManager from "core/resources/TextureManager";
import Texture, { TextureData } from "core/texture/Texture";
import WorkerPool from "core/worker/WorkerPool";
import { mat4, quat, vec2, vec3 } from 'gl-matrix';
import DebugUtil from "../../../util/debug/DebugUtil";
import JavaMap from "../../../util/JavaMap";
import MathUtil from "../../../util/MathUtil";
import DebugCanvas from '../../../util/debug/DebugCanvas';

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
    private static readonly gltfWorkerPool = new WorkerPool<GLTFWorkerRequest, GLTFWorkerResponse>();
    private static readonly glbWorkerPool = new WorkerPool<GLBWorkerRequest, GLBWorkerResponse>();

    constructor(public json: GLTFJson, public buffers: ArrayBuffer[], public images: Texture[]) {
        DebugUtil.addToWindowObject('gltf', this);
    }

    public createMeshes(shaderManager: ShaderManager,
                        geometryFactory: GeometryFactory,
                        materialFactory: MaterialFactory,
                        resourceManager: ResourceManager,
                        entityManager: EntityManager,
                        rootTransform?: Transform): EntityId[] {
        const textureManager: TextureManager = resourceManager.textureManager;

        const bgHelper = new BindGroupHelper(resourceManager, 'VERTEX-INSTANCE', [{
            type: 'storage',
            byteLength: 4096,
            name: 'InstanceData',
            visibility: UniformVisibility.VERTEX | UniformVisibility.FRAGMENT
        }]);
        const usedMaterials = new JavaMap<string, Mesh>();
        const buildNode = (array: EntityId[], node: GLTFNode, parentTransform?: Transform): EntityId[] => {
            const entity = entityManager.createEntity(node.name);
            array.push(entity);
            const transform = this.parseTransform(node);

            transform.label = node.name;
            if (parentTransform) {
                transform.parent = parentTransform;
                parentTransform.children.push(transform);
            }

            if (typeof node.mesh === 'number') {
                const mesh = this.json.meshes[node.mesh];
                if (mesh.primitives.length > 1) {
                    console.warn('MORE than one PRIMITIVES', mesh)
                }
                for (const primitive of mesh.primitives) {
                    const geometry = this.createGeometry(mesh.name, primitive, geometryFactory);

                    const gltfMaterial = this.json.materials[primitive.material];
                    const matName = gltfMaterial.name || `unnamed-mat-${Math.random()}`;
                    if (usedMaterials.get(matName)) {
                        const usedMesh = usedMaterials.get(matName)!
                        entityManager.addComponents(entity, [
                            new Mesh(usedMesh.pipelineId, geometry,
                                usedMesh.material, usedMesh.instanceBuffers, usedMesh.label)
                        ]);
                        continue;
                    }
                    const pbr = gltfMaterial.pbrMetallicRoughness || {};
                    const baseColorFactor = pbr.baseColorFactor || [1.0, 1.0, 1.0, 1.0];
                    const metallicFactor = pbr.metallicFactor ?? 1.0;
                    const roughnessFactor = pbr.roughnessFactor ?? 1.0;

                    // let normal!: Texture;
                    
                    if (!gltfMaterial.normalTexture) {
                        const normalUv = this.parseAccessor(primitive.attributes.NORMAL) as Float32Array;
                        const uv = this.parseAccessor(primitive.attributes.TEXCOORD_0) as Float32Array;

                        const size = 1024;
                        MathUtil.generateNormalTextureAsImageBitmap(normalUv, uv, size, size)
                            .then((imageBitmap) => {
                                const name = gltfMaterial.name!;
                                const texture = textureManager.addPreloadedToGlobalTexture(`${name}_custom_normal`, imageBitmap);
                                console.log(`${name} normal: `, texture.index.textureLayer, [...texture.index.textureUvOffset], [...texture.index.textureUvScale]);
                                // DebugCanvas.debugTexture(texture);
                            });
                    } else {
                        // normal = this.getTextureAtIndex(gltfMaterial.normalTexture.index);
                    }
                    let normal = gltfMaterial.normalTexture
                        ? this.getTextureAtIndex(gltfMaterial.normalTexture.index)
                        : textureManager.getTexture(Texture.DEFAULT_NORMAL_MAP);
                    const albedo = pbr.baseColorTexture
                        ? this.getTextureAtIndex(pbr.baseColorTexture.index)
                        : textureManager.getTexture(Texture.DEFAULT_ALBEDO_MAP);
                    const metallicRoughness = pbr.metallicRoughnessTexture
                        ? this.getTextureAtIndex(pbr.metallicRoughnessTexture.index)
                        : textureManager.getTexture(Texture.DEFAULT_METALLIC_ROUGHNESS_MAP);
                    const metallicRoughnessFactor = vec2.fromValues(metallicFactor, roughnessFactor);
                        // : textureManager.create1x1Texture(
                        //     `${Texture.DEFAULT_METALLIC_ROUGHNESS_MAP}-${metallicFactor}-${roughnessFactor}`,
                        //     new Uint8ClampedArray([255, metallicFactor * 255, roughnessFactor * 255, 255]));


                    const blendMode = gltfMaterial.alphaMode === 'BLEND' ? BlendPresets.TRANSPARENT : undefined;
                    const pbrMaterialProperties = new PBRMaterialProperties(
                        albedo, normal, metallicRoughness, new Float32Array(baseColorFactor), metallicRoughnessFactor);

                    const material = materialFactory.pbrMaterial(gltfMaterial.name,
                        pbrMaterialProperties,
                        {
                            colorAttachment: { blendMode } as PipelineColorAttachment,
                            // cullFace: 'back'
                            cullFace: gltfMaterial.doubleSided ? 'none' : 'back'
                        });

                    const gpuMesh = new Mesh(
                        shaderManager.createPipeline(geometry, material),
                        geometry, material, [{
                            bindGroupId: bgHelper.bindGroupId,
                            bufferId: bgHelper.bufferId
                        }], mesh.name);
                    entityManager.addComponents(entity, [gpuMesh]);
                    usedMaterials.set(matName, gpuMesh);
                }

            }

            entityManager.addComponents(entity, [transform]);

            if (node.children) {
                for (const childIndex of node.children) {
                    buildNode(array, this.json.nodes[childIndex], transform);
                }
            }


            return array;
            // return currentModel as Mesh;
        };

        const startOffset = 0;

        const arr: EntityId[] = [];
        if (!this.json.scenes) {
            console.warn('No scenes present, creating meshes from the nodes');
            return buildNode([], this.json.nodes[startOffset]);
        }

        // console.warn('Gltf either has no scenes or has more than one active scene. Processing the first scene');
        // for (const scene of this.json.scenes) {
        //     for (const node of scene.nodes) {
        //         buildNode(arr, this.json.nodes[node]);
        //     }
        // }
        // return arr;
        // }

        for (const sceneNode of this.json.scenes[this.json.scene].nodes) {
            buildNode(arr, this.json.nodes[sceneNode], rootTransform);
        }

        return arr;
    }

    private getTextureAtIndex(texture: number) {
        return this.images[this.json.textures[texture].source];
    }

    private parseTransform(node: GLTFNode) {
        if (node.matrix) {
            return Transform.fromMat4(node.matrix);
        }


        if (node.rotation || node.scale || node.translation) {
            if (node.scale && node.scale[0] > 10) {
                console.warn('Large scale detected', JSON.stringify(node), node);
                node.scale = [0.01, 0.01, 0.01];
            }
            if (node.translation && node.translation[0] > 100) {
                console.warn('Large transaltion detected', JSON.stringify(node));
                // node.translation = [0, 0, 0];
            }
            return new Transform(
                node.translation || vec3.fromValues(0, 0, 0),
                node.rotation || quat.create(),
                node.scale || vec3.fromValues(1, 1, 1));
        }

        return defaultTransform();
    }

    public createGeometry(name: string, primitive: GLTFMeshPrimitive, geometryFactory: GeometryFactory): Geometry {
        if (!primitive.indices && primitive.indices !== 0) {
            console.error('Mesh has no indices', primitive);
        }
        const indices = this.parseAccessor(primitive.indices);
        const vertices = this.parseAccessor(primitive.attributes.POSITION);
        const normals = this.parseAccessor(primitive.attributes.NORMAL);
        const texCoords = name === 'material_11'
            ? this.parseAccessor(primitive.attributes.TEXCOORD_2)
            : this.parseAccessor(primitive.attributes.TEXCOORD_0);

        if (primitive.attributes.TANGENT === undefined) {
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
        const buffer = this.buffers[bufferView.buffer];

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
                const targetOffset = i * bytesPerVertex + j * componentSize;

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

    public static async parseGlb(rootDir: string, relativePath: string, textureManager: TextureManager): Promise<GLTFParser> {
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

        // const buffer = fileArrayBuffer.slice(binaryChunkOffset + 8)

        this.glbWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: 'GLB-Worker-1' }))
        this.glbWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: 'GLB-Worker-2' }))
        this.glbWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: 'GLB-Worker-3' }))
        this.glbWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: 'GLB-Worker-4' }))
        // this.glbWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: 'GLB-Worker-5' }))
        // this.glbWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: 'GLB-Worker-6' }))
        // this.glbWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: 'GLB-Worker-7' }))
        // this.glbWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: 'GLB-Worker-8' }))

        console.log('GLB JSON: ', json);
        const parseImagesPromise = json.images
            ? this.parseImages(rootDir, json, textureManager, fileArrayBuffer, binaryChunkOffset + 8)
            : Promise.resolve([]);
        return Promise.all([
            this.parseBuffers(rootDir, json, fileArrayBuffer, binaryChunkOffset + 8),
            parseImagesPromise
        ])
            .then(([buffers, textures]) => {
                this.glbWorkerPool.shutdown();
                return new GLTFParser(json, buffers, textures);
            });
    }

    public static async parseGltf(rootDir: string, gltfPath: string, binaryPath: string, textureManager: TextureManager): Promise<GLTFParser> {
        const [json, binary] = await Promise.all([
            fetch(rootDir + gltfPath).then(res => res.json()),
            fetch(rootDir + binaryPath).then(res => res.arrayBuffer())
        ]);

        console.log('GLTF JSON: ', json);
        

        this.gltfWorkerPool.addWorker(new Worker(new URL('./GLTFWorker.ts', import.meta.url), { name: 'GLTF-Worker-1' }));
        this.gltfWorkerPool.addWorker(new Worker(new URL('./GLTFWorker.ts', import.meta.url), { name: 'GLTF-Worker-2' }));
        this.gltfWorkerPool.addWorker(new Worker(new URL('./GLTFWorker.ts', import.meta.url), { name: 'GLTF-Worker-3' }));
        this.gltfWorkerPool.addWorker(new Worker(new URL('./GLTFWorker.ts', import.meta.url), { name: 'GLTF-Worker-4' }));
        // this.gltfWorkerPool.addWorker(new Worker(new URL('./GLTFWorker.ts', import.meta.url), { name: 'GLTF-Worker-5' }));
        // this.gltfWorkerPool.addWorker(new Worker(new URL('./GLTFWorker.ts', import.meta.url), { name: 'GLTF-Worker-6' }));

        const buffers = await this.parseBuffers(rootDir, json, binary);
        const images = json.images ? await this.parseImages(rootDir, json, textureManager, binary) : [];

        this.gltfWorkerPool.shutdown();
        return new GLTFParser(json, buffers, images);
    }

    private static async parseImages(rootPath: string, json: GLTFJson, textureManager: TextureManager, glbBinaryData?: ArrayBuffer, offset: number = 0): Promise<Texture[]> {
        const promises: Promise<any>[] = [];

        for (let i = 0; i < json.images.length; i++) {
            const idx = i;
            const image = json.images[i];
            if (image.uri) {
                const uri = rootPath + image.uri;
                promises.push(this.gltfWorkerPool.submit({ uri })
                    .then(({ imageBitmap }) => {
                        return textureManager
                            .addPreloadedToGlobalTexture(uri, imageBitmap);
                        // .then(({ width, height, data }) => {
                        //     return textureManager
                        //         .addPreloadedToGlobalTexture(uri, new ImageData(new Uint8ClampedArray(data), width, height))
                    }));
            } else if (image.bufferView !== undefined) {
                const bufferView = json.bufferViews[image.bufferView];
                const mimeType = image.mimeType!;
                // const blob = new Blob([new DataView(glbBinaryData!, offset + bufferView.byteOffset!, bufferView.byteLength)], { type: mimeType});
                // promises.push(createImageBitmap(blob).then(bitmap => textureManager.addPreloadedToGlobalTexture(bufferView.name, bitmap)));
                const slice = glbBinaryData!.slice(offset + bufferView.byteOffset!, offset + bufferView.byteOffset! + bufferView.byteLength);
                promises.push(
                    this.glbWorkerPool.submit(
                        { buffer: slice, mimeType }, [slice])
                        .then(({ imageBitmap }) => textureManager
                            .addPreloadedToGlobalTexture(bufferView.name, imageBitmap)));
            } else {
                console.error('Image: ', image);
                throw new Error("Unsupported texture format");
            }
        }

        return Promise.all(promises);
    }

    private static async parseBuffers(rootPath: string, json: GLTFJson, glbBinaryData?: ArrayBuffer, offset: number = 0): Promise<ArrayBuffer[]> {
        // const buffers = new Map<number, ArrayBuffer>();
        const buffers: ArrayBuffer[] = [];

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
                    buffers[i] = binaryData.buffer;
                    // buffers.set(i, binaryData.buffer);
                } else if (glbBinaryData) {
                    console.log('Buffer is part of the preloaded binary')
                    // Use the binary chunk from the GLB file
                    buffers[i] = glbBinaryData.slice(offset);
                    // buffers[i] = glbBinaryData;
                    // buffers.set(i, glbBinaryData);
                } else {
                    console.warn('Buffer is external file: ', buffer)
                    // External file (load it via fetch)
                    const response = await fetch(rootPath + buffer.uri);
                    if (!response.ok) throw new Error(`Failed to load buffer: ${buffer.uri}`);
                    buffers[i] = await response.arrayBuffer();
                    // buffers.set(i, await response.arrayBuffer());
                }
            } else if (glbBinaryData) {
                // Use the binary chunk from the GLB file
                buffers[i] = glbBinaryData.slice(offset);
                // buffers.set(i, glbBinaryData);
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

    private static async toImageData(imgBuffer: ArrayBuffer, mimeType: string) {
        // const view = imgBuffer instanceof DataView ? imgBuffer : new DataView(imgBuffer);
        const view = new DataView(imgBuffer);
        switch (mimeType) {
            case 'image/png' : {
                const width = view.getUint32(16, false);  // Read width at byte 16
                const height = view.getUint32(20, false); // Read height at byte 20
                const blob = new Blob([imgBuffer], { type: mimeType })
                const bitmap = await createImageBitmap(blob);
                const ctx = new OffscreenCanvas(width, height).getContext('2d')!;
                ctx.drawImage(bitmap, 0, 0);
                return ctx.getImageData(0, 0, width, height);
            }
            case 'image/jpeg': {
                let i = 0;
                while (i < imgBuffer.byteLength) {
                    // JPEG segment marker
                    if (view.getUint8(i) === 0xFF && view.getUint8(i + 1) === 0xC0) {
                        // Skip the 2-byte marker and the length of the segment
                        const length = view.getUint16(i + 2, false);
                        // The width and height are stored at byte 5 and 6 of the segment
                        const height = view.getUint16(i + 5, false);
                        const width = view.getUint16(i + 7, false);
                        const blob = new Blob([imgBuffer], { type: mimeType })
                        const bitmap = await createImageBitmap(blob);
                        const ctx = new OffscreenCanvas(width, height).getContext('2d')!;
                        ctx.drawImage(bitmap, 0, 0);
                        return ctx.getImageData(0, 0, width, height);
                    }
                    i++;
                }
                throw new Error("JPEG dimensions not found.");
            }
            default: {
                throw new Error('Unmapped mime type: ' + mimeType);
            }
        }
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
    // scene?: GLTFScene
    scene: number
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

export interface GltfSkin {
    joints: number[]; // Indices of nodes representing bones
    inverseBindMatrices: mat4[]; // Bind pose matrices
    skeletonRoot: number | null; // Root bone index (if available)
}

export interface AnimationChannel {
    targetNode: number; // Node index affected by this animation
    targetPath: 'translation' | 'rotation' | 'scale'; // Type of transformation
    samplerIndex: number; // Index of the associated sampler
}

export interface AnimationSampler {
    keyframes: number[]; // Array of keyframe times
    values: (vec3[] | quat[] | vec3[]); // Corresponding transformation values
    interpolation: 'LINEAR' | 'STEP' | 'CUBICSPLINE'; // Interpolation type
}

export interface Animation {
    channels: AnimationChannel[];
    samplers: AnimationSampler[];
}


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
