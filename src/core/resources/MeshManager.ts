/*
import Mesh from 'core/components/Mesh';
import { BindGroupId, BindGroupLayoutId, PipelineId, SupportedGraphicsApi } from 'core/Graphics';
import TextureLoader, { TextureName } from 'core/loader/TextureLoader';
import Geometry from 'core/mesh/Geometry';
import Material, { MaterialDescriptor } from 'core/mesh/material/Material';
import { TextureArrayIndex } from 'core/mesh/material/MaterialProperties';
import BindGroup, { BindGroupDynamicOffset, BindGroupEntry, BindGroupInstance } from 'core/resources/BindGroup';
import {
    GLOBAL_BUFFER_LAYOUT,
    INSTANCE_BUFFER_LAYOUT,
    VERTEX_STORAGE_BUFFER_STRUCT
} from 'core/resources/DefaultBindGroupLayouts';
import { BufferId, BufferUsage, TextureUsage } from 'core/resources/gpu/BufferDescription';
import ResourceManager, { PipelineHash } from 'core/resources/ResourceManager';
import ShaderStruct from 'core/resources/ShaderStruct';
import { TextureId } from 'core/texture/Texture';
import { vec2, vec3 } from 'gl-matrix';
import DebugUtil from 'util/DebugUtil';
import JavaMap from 'util/JavaMap';

export type MeshId = symbol;


export enum ShapeFlags {
    CUBE = 0x1,
    SPHERE = 0x2
}

export enum RenderFlags {
    FILL_ONLY = 0,
    OUTLINE = 0x1,
    SKIP_FILL = 0x2,
}

interface PipelineCacheEntry {
    pipelineId: PipelineId,
    bindGroups: BindGroupInstance[],
    numberOfInstances: number,
}

interface PipelineCacheEntryV2 {
    pipelineId: PipelineId,
    bindGroupIds: BindGroupId[]
    instanceBuffer?: BufferId,
    instanceBindGroup?: BindGroupId,
    currentDynamicIndex?: number
    sharedBuffers?: BufferId[],
    meshes: WeakMap<Mesh, MeshInstance>
    nonInstanceMeshes?: Map<Mesh, NonInstanceMesh>
    // can have many geometries, but we dont store them yet
}


interface NonInstanceMesh {
    bindGroup: BindGroupId, // for binding buffer
    buffer: BufferId, // for updating data
    material: Material, // for setting data
}

interface MeshInstance {
    bindGroup: BindGroupId, // for binding buffer
    buffer: BufferId;
    instanceOffset: number;
}

interface MaterialCacheEntry {
    readonly bindGroups: BindGroupInstance[],
    readonly instanceData?: InstanceData
    instancesCount: number,
}

interface InstanceData {
    instanceOffset: number,
    instanceBuffer: BufferId,

    layoutId: BindGroupLayoutId,
    bindGroupId: BindGroupId,
}

interface MeshCacheEntry {
    readonly instanceData?: InstanceData,
    readonly bindGroups: BindGroupInstance[],
}


/!**
 * CACHING RULES:
 * Same layout + pipeline options + shaders used - same pipeline
 * Same pipeline different geometry - new vertex buffer
 * Same pipeline + same geometry - new instance
 * Materials are generally tightly coupled with pipelines, so basically different materials = different pipelines
 *!/
export default class MeshManager {

    public readonly globalBuffer: BufferId;
    public readonly globalTextures: TextureId;
    public readonly globalBufferBG: BindGroupId;

    private readonly cachedPipelinesV2: JavaMap<PipelineId, PipelineCacheEntryV2>;
    private readonly cachedPipelines: JavaMap<PipelineHash, PipelineCacheEntry>;
    private readonly instanceBuffers: JavaMap<Mesh, [BindGroupId, BufferId]>;


    private readonly cachedMeshes: WeakMap<Mesh, MeshCacheEntry>;

    private readonly globalBufferLayoutId: BindGroupLayoutId;
    private globalTextureLayerIdx = 0;

    constructor(private gpuResourceManager: ResourceManager) {
        DebugUtil.addToWindowObject('meshFactory', this);
        this.cachedPipelinesV2 = new JavaMap();
        this.cachedPipelines = new JavaMap();
        this.instanceBuffers = new JavaMap();
        this.cachedMeshes = new WeakMap();

        this.globalBuffer = this.gpuResourceManager.createBuffer('GLOBAL', {
            byteLength: 256,
            label: 'Global',
            usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
        });
        this.globalTextures = this.gpuResourceManager.createTextureFromDescription({
            width: 1024, height: 1024, usage: TextureUsage.COPY_DST | TextureUsage.TEXTURE_BINDING,
            depth: 30,
        });

        const z = this.globalTextureLayerIdx;
        this.gpuResourceManager.writeToTexture(this.globalTextures, TextureLoader.pixelDataTextures['grassTexture1'], vec3.fromValues(0, 0, z), 512, 512)
        this.gpuResourceManager.writeToTexture(this.globalTextures, TextureLoader.pixelDataTextures['mountainTexture1'], vec3.fromValues(0, 512, z), 512, 512)
        this.gpuResourceManager.writeToTexture(this.globalTextures, TextureLoader.pixelDataTextures['snowTexture1'], vec3.fromValues(512, 0, z), 512, 512)
        this.gpuResourceManager.writeToTexture(this.globalTextures, TextureLoader.pixelDataTextures['waterTexture1'], vec3.fromValues(512, 512, z), 512, 512)
        this.globalTextureLayerIdx++;

        this.gpuResourceManager.writeToTexture(this.globalTextures, TextureLoader.pixelDataTextures['texture'], vec3.fromValues(0, 0, 1))

        this.gpuResourceManager.writeToTexture(this.globalTextures, TextureLoader.pixelDataTextures['crate'], vec3.fromValues(0, 0, 2))

        this.globalBufferLayoutId = this.gpuResourceManager.createLayout(GLOBAL_BUFFER_LAYOUT);

        this.globalBufferBG = this.gpuResourceManager.createBindGroup(this.globalBufferLayoutId, {
            label: 'global',
            entries: [{
                type: 'uniform',
                bufferId: this.globalBuffer,
                binding: 0,
                name: 'Global',
            }, {
                type: 'texture-array',
                bufferId: this.globalTextures,
                binding: 1,
                name: 'TexturesArray',
            }, {
                type: 'sampler',
                bufferId: this.gpuResourceManager.createSampler('global-textures-sampler'),
                binding: 2,
                name: 'GlobalSampler',
            }]
        });
    }

    addToGlobalTextureArray(texture: TextureName) : TextureArrayIndex {
        this.gpuResourceManager.writeToTexture(this.globalTextures,
            TextureLoader.pixelDataTextures[texture],
            vec3.fromValues(0, 0, this.globalTextureLayerIdx));
        // TODO: DO some analysis on the texture if it can be fit, scaled up scaled down or new layer should be taken
        //       currently always use new layer

        return {
            textureUvOffset: vec2.fromValues(0, 0),
            textureUvScale: vec2.fromValues(1, 1),
            textureLayer: this.globalTextureLayerIdx++
        }
    }

    hasInstanceBuffer(mesh: Mesh): boolean {
        return this.instanceBuffers.has(mesh);
    }
    getInstanceBuffer(mesh: Mesh): [BufferId, BindGroupId] {
        return this.instanceBuffers.get(mesh)!;
  }

    getPerMeshBindGroups(pipeline: PipelineId, mesh: Mesh): [BindGroupId, number?][] {
        const { meshes, nonInstanceMeshes } = this.cachedPipelinesV2.get(pipeline)!;

        const bindGroup: BindGroupId = (meshes.get(mesh)?.bindGroup || nonInstanceMeshes?.get(mesh)?.bindGroup) as BindGroupId;
        const instanceOffset = meshes.get(mesh)?.instanceOffset;

        return [[bindGroup, instanceOffset]];
    }

    getPipelineBindGroups(pipeline: PipelineId) {
        const pipelineData = this.cachedPipelinesV2.get(pipeline)!;
        return pipelineData.instanceBindGroup ?
            [...pipelineData.bindGroupIds, pipelineData.instanceBindGroup]
            : pipelineData.bindGroupIds;
    }

    newMesh(label: string, material: Material, geometry: Geometry) {
        const pipelineKey = this.gpuResourceManager.generatePipelineHash(geometry.descriptor, material.descriptor);
        const cachedPipeline = this.cachedPipelines.get(pipelineKey);
        if (!cachedPipeline) {
            const bindGroups = this.createPipelineBindGroups(material.descriptor);
            this.addBufferData(material, bindGroups);

            const {
                bindGroupLayoutId: instanceBufferLayout,
                bindGroupId: instanceBufferBindGroup,
                entries: [{ bufferId: instanceBuffer }]
            } = this.buildInstanceBuffer();

            const pipelineId = this.gpuResourceManager.createPipeline(
                material.label,
                material.descriptor,
                geometry.descriptor,
                [this.globalBufferLayoutId, ...bindGroups.map(entry => entry.bindGroupLayoutId), instanceBufferLayout]);

            const mesh = new Mesh(pipelineId, geometry, material);

            this.cachedPipelines.set(pipelineKey, { pipelineId, numberOfInstances: 0, bindGroups })
            this.instanceBuffers.set(mesh, [instanceBufferBindGroup, instanceBuffer]);
            return mesh
        }

        const { pipelineId, numberOfInstances, bindGroups } = this.cachedPipelines.get(pipelineKey)!;
        const {
            bindGroupId: instanceBufferBindGroup,
            entries: [{ bufferId: instanceBuffer }]
        } = this.buildInstanceBuffer();
        this.addBufferData(material, bindGroups, numberOfInstances + 1);
        this.cachedPipelines.get(pipelineKey).numberOfInstances += 1;

        // // TODO: Graphics hack #1
        // const dynamicOffset = this.gpuResourceManager.getActiveGraphicsAPI() === SupportedGraphicsApi.WEBGL2
        //     ? 0 // Hack number 2 - if we dont support dynamic instance set it to negative number
        //     : numberOfInstances < 0 ? numberOfInstances : numberOfInstances + 1;
        // bindGroups.forEach((bindGroup, index) => {
        //     // material.descriptor.bindGroupLayouts.forEach(layout => {
        //     //     const layoutId = this.gpuResourceManager.createLayout(layout);
        //     //     const bindGroupId = this.gpuResourceManager.createBindGroup(layoutId, bindGroup);
        //     //     material.addBindGroup({ ...bindGroup, bindGroupId }, dynamicOffset, index + 1)
        //     // })
        // });

        const mesh = new Mesh(pipelineId, geometry, material);
        this.instanceBuffers.set(mesh, [instanceBufferBindGroup, instanceBuffer]);

        return mesh;
    }

    newNotInstancedMesh(material: Material, geometry: Geometry) {
        const pipelineKey = this.gpuResourceManager.generatePipelineHash(geometry.descriptor, material.descriptor);
        const cachedPipeline = this.cachedPipelines.get(pipelineKey);
        if (!cachedPipeline) {
            const bindGroups = this.createPipelineBindGroups(material.descriptor);
            // this.addBufferData(material, bindGroups);


            const pipelineId = this.gpuResourceManager.createPipeline(
                material.label,
                material.descriptor,
                geometry.descriptor,
                [this.globalBufferLayoutId, ...bindGroups.map(entry => entry.bindGroupLayoutId)]);

            const mesh = new Mesh(pipelineId, geometry, material);

            this.cachedPipelines.set(pipelineKey, { pipelineId, numberOfInstances: 0, bindGroups })
            return mesh
        }

        const { pipelineId } = this.cachedPipelines.get(pipelineKey)!;

        return new Mesh(pipelineId, geometry, material);
    }

    private addBufferData(material: Material, bindGroups: BindGroupInstance[], instanceOffset: number = 0) {
        // TODO: We expect a single material buffer. This may not work as expected if more are provided.
        const bufferId = bindGroups.flatMap(bg => bg.entries.map(entry => entry.bufferId))[0];
        const doesMaterialSupportDynamicOffset = material.descriptor.bindGroupLayouts
            .find(layout => layout.entries
                .find(entry => entry.dynamicOffset !== undefined));
        const dynamicOffset = instanceOffset
        || doesMaterialSupportDynamicOffset ? 0 : undefined;
        // bindGroups.forEach((bingGroup, index) => material.setBufferData(
        //     bingGroup.bindGroupId,
        //     bufferId,
        //     index + 1,
        //     /!*dynamicOffset*!/));
    }

    private buildInstanceBuffer(): BindGroupInstance {
        const instanceBuffer = this.createInstanceBuffer();
        const instanceBindGroup = this.createInstanceBufferBindGroup(instanceBuffer);
        const instanceBufferLayout = this.gpuResourceManager.createLayout(INSTANCE_BUFFER_LAYOUT);
        const bindGroupId = this.gpuResourceManager.createBindGroup(instanceBufferLayout, instanceBindGroup);

        return {
            label: 'InstanceBuffer',
            bindGroupLayoutId: instanceBufferLayout,
            bindGroupId,
            entries: [{ ...VERTEX_STORAGE_BUFFER_STRUCT, bufferId: instanceBuffer }]
        };
    }

    private createInstanceBufferBindGroup(instanceBuffer: symbol): BindGroup {
        return {
            label: 'instance',
            entries: [{
                binding: 0,
                bufferId: instanceBuffer,
                name: 'InstanceData',
                type: 'storage'
            }]
        };
    }

    private createInstanceBuffer(): BufferId {
        return this.gpuResourceManager.createBuffer(`instanceBuffer`, {
            label: `instanceBuffer`,
            byteLength: 4096,
            usage: BufferUsage.STORAGE | BufferUsage.COPY_DST
        });
    }

    private createPipelineBindGroups(materialDescriptor: MaterialDescriptor): BindGroupInstance[] {
        const bindGroupInstances: BindGroupInstance[] = [];
        const bindGroupLayoutIds = this.gpuResourceManager.createLayouts(materialDescriptor.bindGroupLayouts);

        let shouldInitInstanceBuffer = false;
        for (let i = 0; i < bindGroupLayoutIds.length; i++) {
            const bindGroupLayout = materialDescriptor.bindGroupLayouts[i];
            const bindGroupLayoutId = bindGroupLayoutIds[i];

            const bindGroupEntries: BindGroupEntry[] = [];
            for (const uniformEntry of bindGroupLayout.entries) {
                const { type, binding, name } = uniformEntry;

                if (type === 'uniform') {
                    const bufferId = this.gpuResourceManager.createBuffer(name, {
                        label: `${name}`,
                        byteLength: this.determineByteLength(uniformEntry),
                        usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
                    });
                    const size = uniformEntry.dynamicOffset?.size;
                    bindGroupEntries.push({ binding, bufferId, name, type, size } as BindGroupDynamicOffset);
                } else if (type === 'storage') {
                    const bufferId = this.gpuResourceManager.createBuffer(`instanceBuffer`, {
                        label: `instanceBuffer`,
                        byteLength: 4096,
                        usage: BufferUsage.STORAGE | BufferUsage.COPY_DST
                    });
                    bindGroupEntries.push({ binding: 1, bufferId, name, type });
                } else if (type === 'texture') {
                    throw new Error('See console');
                    console.warn('Creating texture from bind group');
                    console.trace(bindGroupLayout);
                    const bufferId = this.gpuResourceManager.createTexture(name);
                    bindGroupEntries.push({ bufferId, binding, name, type });
                } else if (type === 'sampler') {
                    throw new Error('See console');
                    console.warn('Creating samper from bind group');
                    console.trace(bindGroupLayout);
                    const bufferId = this.gpuResourceManager.createSampler(name);
                    bindGroupEntries.push({ bufferId, binding, name, type });
                } else {
                    throw new Error('Unexpected type: ' + type);
                }
            }

            const bindGroup = { label: `${bindGroupLayoutId.toString()}`, entries: bindGroupEntries };
            bindGroupInstances.push({
                bindGroupLayoutId,
                label: bindGroupLayoutId.toString(),
                bindGroupId: this.gpuResourceManager.createBindGroup(bindGroupLayoutId, bindGroup),
                entries: bindGroupEntries
            });
        }

        return bindGroupInstances;
    }

    private determineByteLength(shaderStruct: ShaderStruct): number {
        // Currently only webgpu uses dynamic offsets and webgl2 writes data to the same buffer
        if (shaderStruct.dynamicOffset
            && this.gpuResourceManager.getActiveGraphicsAPI() === SupportedGraphicsApi.WEBGPU) {
            // Create space for 10 instances.
            return shaderStruct.dynamicOffset.size * 10;
        }

        return shaderStruct.byteLength!;
    }

    public getPositionBuffer(pipelineId: PipelineId, mesh: Mesh): MeshInstance {
        const pipelineCacheEntryV2 = this.cachedPipelinesV2.get(pipelineId);
        return pipelineCacheEntryV2!.meshes!.get(mesh)!;
    }
}

*/
