import Mesh from "core/components/Mesh";
import Transform, { defaultTransform } from "core/components/Transform";
import EntityManager, { EntityId } from "core/EntityManager";
import GeometryFactory from "core/factories/GeometryFactory";
import MaterialFactory from "core/factories/MaterialFactory";
import Geometry, { GeometryData } from "core/mesh/Geometry";
import { PBRMaterialProperties } from "core/mesh/material/MaterialProperties";
import Skeleton from "core/mesh/Skeleton";
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
import Texture from "core/texture/Texture";
import WorkerPool from "core/worker/WorkerPool";
import { mat4, quat, vec2, vec3 } from 'gl-matrix';
import DebugUtil from "../../../util/debug/DebugUtil";
import JavaMap from "../../../util/JavaMap";
import MathUtil from "../../../util/MathUtil";

export default class GLTFParser {
    private static readonly gltfWorkerPool = new WorkerPool<GLTFWorkerRequest, GLTFWorkerResponse>();
    private static readonly glbWorkerPool = new WorkerPool<GLBWorkerRequest, GLBWorkerResponse>();

    constructor(public json: GLTFJson, public buffers: ArrayBuffer[], public images: Texture[]) {
        DebugUtil.addToWindowObject('gltf', this);
    }

    public initializeEntities(entityManager: EntityManager) {
        for (let i = 0; i < this.json.nodes.length; i++) {

        }
    }

    private parseSkin(name: string, gltfSkeleton: GltfSkin) {
        const joints = gltfSkeleton.joints;
        const inverseBindMatricesAccessor = gltfSkeleton.inverseBindMatrices;

        const skeleton = new Skeleton(name, new Array(joints.length), new Array(joints.length));

        const inverseBindMatrices: mat4[] = [];
        if (inverseBindMatricesAccessor !== undefined) {
            const accessor = this.json.accessors[inverseBindMatricesAccessor];
            const bufferView = this.json.bufferViews[accessor.bufferView];
            const buffer = this.buffers[bufferView.buffer];
            const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
            const byteLength = accessor.count * 16 * Float32Array.BYTES_PER_ELEMENT; // 16 floats per mat4
            const rawData = new Float32Array(buffer, byteOffset, accessor.count * 16);
            console.log(accessor, bufferView, buffer)

            console.log('Accessor count: ', accessor.count);
            for (let i = 0; i < accessor.count; i++) {
                skeleton.inverseBindMatrices[i] = rawData.slice(i * 16, (i + 1) * 16) as mat4;
                // inverseBindMatrices.push(matrix);
            }
        }

        return skeleton;
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

        const usedSkeletons = new JavaMap<number, Skeleton>();
        const usedMaterials = new JavaMap<string, Mesh>();
        const nodesToEntity = new JavaMap<number, EntityId>();
        const buildNode = (array: EntityId[], nodeIndex: number, parentTransform?: Transform): EntityId[] => {
            const node = this.json.nodes[nodeIndex];
            const entity = entityManager.createEntity(node.name);
            nodesToEntity.set(nodeIndex, entity);
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

            if (typeof node.skin === 'number') {
                if (!usedSkeletons.has(node.skin)) {
                    const skeleton = this.parseSkin(node.name, this.json.skins[node.skin]);
                    usedSkeletons.set(node.skin, skeleton);
                    entityManager.addComponents(entity, [skeleton]);
                }
            }

            entityManager.addComponents(entity, [transform]);

            if (node.children) {
                for (const childIndex of node.children) {
                    buildNode(array, childIndex, transform);
                }
            }

            return array;
        };

        const startOffset = 0;

        const arr: EntityId[] = [];
        if (!this.json.scenes) {
            console.warn('No scenes present, creating meshes from the nodes');
            return buildNode([], startOffset);
        }

        for (const sceneNode of this.json.scenes[this.json.scene].nodes) {
            buildNode(arr, sceneNode, rootTransform);
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
                // console.warn('Large scale detected', JSON.stringify(node), node);
                node.scale = [0.01, 0.01, 0.01];
            }
            if (node.translation && node.translation[0] > 100) {
                // console.warn('Large transaltion detected', JSON.stringify(node));
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

        const worker = new Worker(new URL('./workers/GLBJsonParserWorker.ts', import.meta.url), { name: 'GLB-Parser-Worker-1' });
        worker.postMessage({ rootDir, relativePath });

        this.glbWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: 'GLB-Worker-1' }))
        this.glbWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: 'GLB-Worker-2' }))
        this.glbWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: 'GLB-Worker-3' }))
        this.glbWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: 'GLB-Worker-4' }))

        // this.glbWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: 'GLB-Worker-5' }))
        // this.glbWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: 'GLB-Worker-6' }))
        // this.glbWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: 'GLB-Worker-7' }))
        // this.glbWorkerPool.addWorker(new Worker(new URL('./GLBWorker.ts', import.meta.url), { name: 'GLB-Worker-8' }))

        console.log('GLB JSON: ', json);
        return Promise.all([
            this.parseBuffers(rootDir, json, fileArrayBuffer, binaryChunkOffset + 8),
            json.images
                ? this.parseImages(rootDir, json, textureManager, fileArrayBuffer, binaryChunkOffset + 8)
                : Promise.resolve([])
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
                    }));
            } else if (image.bufferView !== undefined) {
                const bufferView = json.bufferViews[image.bufferView];
                const mimeType = image.mimeType!;
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
    animations: GLTFAnimation[],
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
    scene: number
    scenes: GLTFScene[]
    textures: [{ sampler: number, source: number }]
    skins: GltfSkin[],
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
    TEXCOORD_3: number,
    WEIGHTS_0?: number,
    JOINTS_0?: number,
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
    skin?: number;
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
    byteOffset: number;
    byteStride: number;
    name: string;
    target: GLTFBufferViewTarget;
}

export enum GLTFBufferViewTarget {
    ARRAY_BUFFER = 34962, // The buffer view contains vertex data (e.g., positions, normals, UVs).
    ELEMENT_ARRAY_BUFFER = 34963 // The buffer view contains index data for drawing elements.
}

export interface GLTFMaterial {
    name: string;
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
    inverseBindMatrices: number; // Bind pose matrices
    skeleton: number; // Root bone index (if available)
}

export interface GLTFAnimation {
    channels: GLTFAnimationChannel[],
    name: string,
    samplers: GLTFAnimationSampler[],
}

export interface GLTFAnimationChannel {
    sampler: number,
    target: { node: number, path: 'translation' | 'rotation' | 'scale' }
}

export interface GLTFAnimationSampler {
    input: number,
    interpolation: 'LINEAR' | 'STEP' | 'CUBICSPLINE',
    output: number,
}

export interface AnimationChannel {
    targetNode: number; // Node index affected by this animation
    targetPath: 'translation' | 'rotation' | 'scale'; // Type of transformation
    samplerIndex: number; // Index of the associated sampler
}

export interface AnimationSampler {
    keyframes: number[]; // Array of keyframe times
    values: (quat[] | vec3[]); // Corresponding transformation values
    interpolation: 'LINEAR' | 'STEP' | 'CUBICSPLINE'; // Interpolation type
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


// parseAnimations(): Animation[] {
//     const animations = this.json.animations || [];
//     const parsedAnimations: Animation[] = [];
//
//     for (const anim of animations) {
//         const channels: AnimationChannel[] = [];
//         const samplers: AnimationSampler[] = [];
//
//         // Parse samplers
//         for (const sampler of anim.samplers) {
//             const inputAccessor = this.json.accessors[sampler.input];
//             const outputAccessor = this.json.accessors[sampler.output];
//
//             // Decode input (keyframe times)
//             const inputBufferView = this.json.bufferViews[inputAccessor.bufferView];
//             const inputBuffer = this.json.buffers[inputBufferView.buffer];
//             const inputOffset = (inputBufferView.byteOffset || 0) + (inputAccessor.byteOffset || 0);
//             const inputTimes = new Float32Array(inputBuffer, inputOffset, inputAccessor.count);
//
//             // Decode output (transform values)
//             const outputBufferView = this.json.bufferViews[outputAccessor.bufferView];
//             const outputBuffer = this.json.buffers[outputBufferView.buffer];
//             const outputOffset = (outputBufferView.byteOffset || 0) + (outputAccessor.byteOffset || 0);
//             let outputValues: any;
//             if (outputAccessor.type === 'VEC3') {
//                 outputValues = new Float32Array(outputBuffer, outputOffset, outputAccessor.count * 3);
//             } else if (outputAccessor.type === 'VEC4') {
//                 outputValues = new Float32Array(outputBuffer, outputOffset, outputAccessor.count * 4);
//             }
//
//             // Normalize values for each keyframe
//             const parsedOutput: vec3[] | quat[] = [];
//             for (let i = 0; i < outputAccessor.count; i++) {
//                 if (outputAccessor.type === 'VEC3') {
//                     parsedOutput.push(vec3.fromValues(
//                         outputValues[i * 3],
//                         outputValues[i * 3 + 1],
//                         outputValues[i * 3 + 2]
//                     ));
//                 } else if (outputAccessor.type === 'VEC4') {
//                     parsedOutput.push(quat.fromValues(
//                         outputValues[i * 4],
//                         outputValues[i * 4 + 1],
//                         outputValues[i * 4 + 2],
//                         outputValues[i * 4 + 3]
//                     ));
//                 }
//             }
//
//             samplers.push({
//                 input: Array.from(inputTimes),
//                 output: parsedOutput,
//                 interpolation: sampler.interpolation,
//             });
//         }
//
//         // Parse channels
//         for (const channel of anim.channels) {
//             channels.push({
//                 targetNode: channel.target.node,
//                 targetPath: channel.target.path as 'translation' | 'rotation' | 'scale',
//                 samplerIndex: channel.sampler,
//             });
//         }
//
//         parsedAnimations.push({ channels, samplers });
//     }
//
//     return parsedAnimations;
// }


/*

public parseSkeletons(shaderManager: ShaderManager,
    geometryFactory: GeometryFactory,
    materialFactory: MaterialFactory,
    resourceManager: ResourceManager,
    entityManager: EntityManager): Skeleton[] {
    const skeletons: Skeleton[] = [];

    for (const skin of this.json.skins) {
        const joints = skin.joints; // Array of node indices
        const inverseBindMatricesAccessor = skin.inverseBindMatrices;

        // Decode inverse bind matrices
        const inverseBindMatrices: mat4[] = [];
        if (inverseBindMatricesAccessor !== undefined) {
            const accessor = this.json.accessors[inverseBindMatricesAccessor];
            const bufferView = this.json.bufferViews[accessor.bufferView];
            const buffer = this.buffers[bufferView.buffer];
            const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
            const byteLength = accessor.count * 16 * Float32Array.BYTES_PER_ELEMENT; // 16 floats per mat4
            const rawData = new Float32Array(buffer, byteOffset, accessor.count * 16);
            console.log(accessor, bufferView, buffer)

            for (let i = 0; i < accessor.count; i++) {
                const matrix = rawData.slice(i * 16, (i + 1) * 16) as mat4;
                inverseBindMatrices.push(matrix);
            }
        }

        // for (let i = 0; i < joints.length; i++) {
        //     const jointIndex = joints[i];
        //     const node = this.json.nodes[jointIndex];
        //
        //     // Use animation transform if available, otherwise use node's base transform
        //     const localTransform = animationTransforms[jointIndex] || mat4.create();
        //     if (!animationTransforms[jointIndex]) {
        //         mat4.fromTranslation(localTransform, node.translation || [0, 0, 0]);
        //         mat4.rotate(localTransform, localTransform, node.rotation || [0, 0, 0, 1]);
        //         mat4.scale(localTransform, localTransform, node.scale || [1, 1, 1]);
        //     }
        //
        //     // Combine with parent's global transform
        //     const parentIndex = node.parent; // Get parent node index
        //     const globalTransform = mat4.create();
        //     if (parentIndex !== undefined && globalTransforms[parentIndex]) {
        //         mat4.multiply(globalTransform, globalTransforms[parentIndex], localTransform);
        //     } else {
        //         mat4.copy(globalTransform, localTransform);
        //     }
        //     globalTransforms.push(globalTransform);
        //
        //     // Combine global transform with inverse bind matrix
        //     const jointMatrix = mat4.create();
        //     mat4.multiply(jointMatrix, globalTransform, skeleton.inverseBindMatrices[i]);
        //     jointMatrices.push(jointMatrix);
        // }

        const rootNode = this.json.nodes[skin.skeleton]
        // @ts-ignore
        skeletons.push(new Skeleton(rootNode.name, joints, inverseBindMatrices));
        console.log('Parsed skeletons: ', skeletons);
        console.log(joints.length, inverseBindMatrices.length)
        console.log('Root node is: ', skin.skeleton, this.json.nodes[skin.skeleton]);
    }

    return skeletons;
}
*/
