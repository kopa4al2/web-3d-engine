import Mesh from 'core/components/Mesh';
import MaterialFactory from 'core/factories/MaterialFactory';
import { BindGroupId, BindGroupLayoutGroupId, PipelineId } from 'core/Graphics';
import Geometry, { GeometryData, GeometryDescriptor } from 'core/mesh/Geometry';
import Material from 'core/mesh/Material';
import { createVertexLayoutWithDataV2, GLOBAL_BUFFER_LAYOUT } from 'core/resources/DefaultBindGroupLayouts';
import { BufferId, BufferUsage } from 'core/resources/gpu/BufferDescription';
import {
    DEFAULT_PIPELINE_OPTIONS,
    PipelineOptions,
    UniformVisibility,
    VertexBufferLayout
} from 'core/resources/gpu/GpuShaderData';
import GPUResourceManager, { PipelineName, ShaderId } from 'core/resources/GPUResourceManager';
import Bitmask from 'util/BitMask';
import DebugUtil from 'util/DebugUtil';

export type MeshId = symbol;


export enum ShapeFlags {
    CUBE = 0x1,
    SPHERE = 0x2
}

export enum RenderFlags {
    OUTLINE = 0x1,
    SKIP_FILL = 0x2
}

/**
 * CACHING RULES:
 * Same layout + pipeline options + shaders used - same pipeline
 * Same pipeline different geometry - new vertex buffer
 * Same pipeline + same geometry - new instance
 * Materials are generally tightly coupled with pipelines, so basically different materials = different pipelines
 */
export default class MeshManager {

    public readonly globalBuffer: BufferId;
    public readonly globalBufferBG: BindGroupId;

    private readonly meshCache: Record<string, Mesh> = {};
    private readonly cachedPipelines: Record<PipelineName, Mesh> = {};
    // private readonly cachedPipelines: Record<PipelineName, PipelineId> = {};
    private readonly instanceBuffers: Record<string, [BufferId, BindGroupId]> = {};
    private readonly globalBufferLayoutId: BindGroupLayoutGroupId;

    constructor(private gpuResourceManager: GPUResourceManager) {
        DebugUtil.addToWindowObject('meshFactory', this);
        this.globalBuffer = this.gpuResourceManager.createBuffer('GLOBAL', {
            byteLength: 256,
            label: 'Global',
            usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
        });

        const dummyInstanceBuffer = this.gpuResourceManager.createBuffer('Dummy', {
            byteLength: 4,
            label: 'InstanceDummy',
            usage: BufferUsage.STORAGE | BufferUsage.COPY_DST,
        });

        this.globalBufferLayoutId = this.gpuResourceManager.createLayout(GLOBAL_BUFFER_LAYOUT);

        this.globalBufferBG = this.gpuResourceManager.createBindGroup(this.globalBufferLayoutId, [{
            type: 'uniform',
            id: this.globalBuffer,
            binding: 0,
            visibilityMask: new Bitmask<UniformVisibility>(UniformVisibility.VERTEX | UniformVisibility.FRAGMENT),
            name: 'Global',
        }, {
            type: 'storage',
            id: dummyInstanceBuffer,
            binding: 1,
            visibilityMask: new Bitmask<UniformVisibility>(UniformVisibility.VERTEX | UniformVisibility.FRAGMENT),
            name: 'DummyInstance',
        }]);
    }

    /**
     * TODO: Several performance optimizations can be made here:
     * Pipeline caching is happening in gpu resource manager
     * 1. If the same pipeline is used but with different geometry - create new vertex buffer instead of another pipeline
     * 2. Reuse buffers between bind groups of the same materials
     * @param {string} label
     * @param {Material} material
     * @param {Geometry} geometry
     * @returns {Mesh}
     */
    createMeshInstanced(label: string, material: Material, geometry: Geometry): Mesh {
        const pipelineKey = this.gpuResourceManager.generatePipelineHash(geometry.descriptor, material.descriptor);
        const cachedMesh = this.cachedPipelines[pipelineKey];
        if (cachedMesh) {
            // Reuse pipeline
            if (cachedMesh.geometry.equals(geometry)) {
                // Reuse vertex layout + instanced buffer
            } else {
                // New vertex layout + instanced buffer
                // console.warn('Different geometries for the same pipeline are not implemented. Creating new mesh', label);

                // Create pipeline + instance buffer
                const { instanceBuffer, instanceBindGroup } = this.createInstanceBuffer(label);

                const pipelineId = this.gpuResourceManager.createPipeline(
                    material.label,
                    material.descriptor,
                    geometry.descriptor,
                    [this.globalBufferLayoutId, ...material.bindGroupLayouts]);

                return new Mesh(pipelineKey + label, pipelineId, geometry, material, [instanceBuffer, instanceBindGroup]);
                // this.cachedPipelines[pipelineKey] = new Mesh(pipelineKey + label, pipelineId, geometry, material, [instanceBuffer, instanceBindGroup]);
                // return this.cachedPipelines[pipelineKey];
            }
        }

        // Create pipeline + instance buffer
        const { instanceBuffer, instanceBindGroup } = this.createInstanceBuffer(label);

        const pipelineId = this.gpuResourceManager.createPipeline(
            material.label,
            material.descriptor,
            geometry.descriptor,
            [this.globalBufferLayoutId, ...material.bindGroupLayouts]);

        this.meshCache[label] = new Mesh(pipelineKey, pipelineId, geometry, material, [instanceBuffer, instanceBindGroup]);;
        return this.meshCache[label];
    }

    private createInstanceBuffer(label: string) {
        const instanceBuffer = this.gpuResourceManager.createBuffer(`${label}-instanceBuffer`, {
            label: `${label}-instanceBuffer`,
            byteLength: 4096,
            usage: BufferUsage.STORAGE | BufferUsage.COPY_DST
        });
        const instanceBindGroup = this.gpuResourceManager.createBindGroup(this.globalBufferLayoutId, [
            {
                binding: 0,
                id: this.globalBuffer,
                name: 'Global',
                visibilityMask: new Bitmask<UniformVisibility>(UniformVisibility.VERTEX | UniformVisibility.FRAGMENT),
                type: 'uniform'
            },
            {
                binding: 1,
                id: instanceBuffer,
                name: 'InstanceData',
                visibilityMask: new Bitmask<UniformVisibility>(UniformVisibility.VERTEX | UniformVisibility.FRAGMENT),
                type: 'storage'
            }
        ]);
        return { instanceBuffer, instanceBindGroup };
    }

    public getMeshByLabel(label: string): Mesh {
        return this.meshCache[label];
    }
}
