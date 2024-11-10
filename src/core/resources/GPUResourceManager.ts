import Component from 'core/components/Component';
import Graphics, { BindGroupId, BindGroupLayoutGroupId, PipelineId, VertexBufferId } from "core/Graphics";
import TextureLoader, { TextureName } from 'core/loader/TextureLoader';
import Geometry, { GeometryDescriptor } from 'core/mesh/Geometry';
import Material, { MaterialDescriptor } from 'core/mesh/Material';
import {
    FragmentShaderName,
    ShaderProgramName,
    VertexLayoutEntry,
    VertexShaderName
} from "core/resources/cpu/CpuShaderData";
import {
    BufferData,
    BufferDescription,
    BufferFormat,
    BufferId,
    BufferUsage
} from "core/resources/gpu/BufferDescription";
import {
    BindGroupEntry,
    BindGroupLayout, DEFAULT_PIPELINE_OPTIONS,
    IndexBuffer,
    PipelineOptions,
    ShaderProgramDescription,
    UniformVisibility,
    VertexBufferLayout
} from "core/resources/gpu/GpuShaderData";
import Texture, { SamplerId, TextureId } from "core/texture/Texture";
import Bitmask from 'util/BitMask';
import DebugUtil from 'util/DebugUtil';
import logger from 'util/Logger';
import ObjectUtils from 'util/ObjectUtils';
import glBasicFragmentShader from 'webgl/shaders/basic/basicFragmentShader.frag';
import glBasicVertexShader from 'webgl/shaders/basic/basicVertexShader.vert';
import glBasicVertexShaderInstanced from 'webgl/shaders/basic/basicVertexShaderInstanced.vert';
import glSphereFragmentShader from 'webgl/shaders/debug/sphereFragmentShader.frag';
import glSphereVertexShader from 'webgl/shaders/debug/sphereVertexShader.vert';
import glLightFragmentShader from 'webgl/shaders/light/fragmentShader.frag';
import glLightVertexShader from 'webgl/shaders/light/vertexShader.vert';
import glTerrainFragmentShader from 'webgl/shaders/terrain/terrainFragmentShader.frag';
import glTerrainVertexShader from 'webgl/shaders/terrain/terrainVertexShader.vert';
import WebGPUGraphics from "webgpu/graphics/WebGPUGraphics";
import gpuBasicFragment from 'webgpu/shaders/basic/basicFragmentShader.wgsl';
import basicFragmentShaderInstanced from 'webgpu/shaders/basic/basicFragmentShaderInstanced.wgsl';
import gpuBasicVertex from 'webgpu/shaders/basic/basicVertexShader.wgsl';
import gpuBasicVertexInstanced from 'webgpu/shaders/basic/basicVertexShaderInstanced.wgsl';
import gpuSphereFragmentShader from 'webgpu/shaders/debug/sphereFragmentShader.wgsl';
import gpuSphereVertexShader from 'webgpu/shaders/debug/sphereVertexShader.wgsl';
import gpuLightFragmentShader from 'webgpu/shaders/fragmentShader.wgsl';
import gpuTerrainFragmentShader from 'webgpu/shaders/terrain/terrainFragmentShader.wgsl';
import gpuTerrainVertexShader from 'webgpu/shaders/terrain/terrainVertexShader.wgsl';
import gpuLightVertexShader from 'webgpu/shaders/vertexShader.wgsl';

/**
 * Remove from everywhere and delete
 * @deprecated
 */
export enum ShaderId {
    SPHERE = 'SPHERE',
    BASIC = 'BASIC',
    BASIC_INSTANCED = 'BASIC_INSTANCED',
    LIGHTED = 'LIGHTED'
}

/**
 * Pipeline for webgpu, shader program for webgl2
 * Interface representing a shader program instance.
 * @interface
 */
export interface PipelineInstance {
    pipeline: PipelineId,
    layoutGroups: BindGroupLayoutGroupId[]
}

export interface VertexShaderDescription {
    shaderName: VertexShaderName,
    stride: number,
    layout: VertexLayoutEntry[],
}


export interface FragmentShaderDescription {
    shaderName: FragmentShaderName,
}

export interface BindGroupLayoutCpu {
    label: string,
    entries: BindGroupLayoutEntry[]
}

export interface BindGroupLayoutEntry {
    type: 'texture' | 'sampler' | 'uniform' | 'storage',
    binding: number,
    name: string,
    visibilityMask: Bitmask<UniformVisibility>
    byteLength?: number,
    defaultValue?: BufferData,
    instanceBufferStride?: number,
}

export interface UniformsData {
    shaderLayout: BindGroupLayoutGroupId,
    group: number,
    uniforms: UniformDataEntry[]
}

export interface UniformDataEntry {
    type: 'texture' | 'sampler' | 'uniform' | 'storage',
    binding: number,
    name: string,
    usage: number,
    byteLength?: number,
    visibilityMask: Bitmask<UniformVisibility>
    data?: Float32Array | TextureId | SamplerId
}

export type BufferName = 'GLOBAL' | string;
export type PipelineName = string;

export default class GPUResourceManager {

    private bindGroupLayoutsCache: Record<string, BindGroupLayoutGroupId> = {}
    private pipelinesCache: Record<PipelineName, PipelineId> = {}
    private buffersCache: Record<BufferName, BufferId> = {}
    private texturesCache: Record<TextureName, TextureId> = {}
    private samplersCache: Record<TextureName, SamplerId> = {}

    constructor(private graphics: Graphics) {
        DebugUtil.addToWindowObject('gpuResourceManager', this);
    }

    public generatePipelineHash(geometry: GeometryDescriptor,
                                material: MaterialDescriptor) {
        return `${geometry.vertexShader}-${material.fragmentShader}-${JSON.stringify(this.mergeWithDefaultOptions(material.properties))}-${geometry.vertexLayout.entries.map(e => e.elementsPerVertex).join('-')}`
    }
    public hasPipeline(key: PipelineName) {
        return this.pipelinesCache[key] !== undefined;
    }

    public createPipeline(label: PipelineName,
                          material: MaterialDescriptor,
                          geometry: GeometryDescriptor,
                          bindGroupLayouts: BindGroupLayoutGroupId[]): PipelineId {
        const { fragmentShader } = material;
        const { vertexLayout, vertexShader } = geometry;
        const properties = this.mergeWithDefaultOptions(material.properties);

        const uniqueId = this.generatePipelineHash(geometry, material);
        // TODO: Caching causes problems with webgl2 since bind groups are created when initializing the pipeline
        // if (!this.pipelinesCache[uniqueId]) {
            this.pipelinesCache[uniqueId] = this.graphics.initPipeline({
                label,
                options: this.mergeWithDefaultOptions(properties),

                shaderLayoutIds: bindGroupLayouts,
                fragmentShaderSource: this.getFragmentSource(fragmentShader),

                vertexShaderSource: this.getVertexSource(vertexShader),
                vertexShaderLayout: this.createVertexShaderLayout(vertexLayout.entries),
                vertexShaderStride: vertexLayout.stride,
            });
        // }

        return this.pipelinesCache[uniqueId];
    }

    public _createPipeline(pipelineName: PipelineName,
                          label: string,
                          material: MaterialDescriptor,
                          geometry: GeometryDescriptor,
                          bindGroupLayouts: BindGroupLayoutGroupId[]): PipelineId {
        const { fragmentShader } = material;
        const { vertexLayout, vertexShader } = geometry;
        const properties = this.mergeWithDefaultOptions(material.properties);
        if (!this.pipelinesCache[pipelineName]) {
            this.pipelinesCache[pipelineName] = this.graphics.initPipeline({
                label: pipelineName,
                options: this.mergeWithDefaultOptions(properties),

                shaderLayoutIds: bindGroupLayouts,
                fragmentShaderSource: this.getFragmentSource(fragmentShader),

                vertexShaderSource: this.getVertexSource(vertexShader),
                vertexShaderLayout: this.createVertexShaderLayout(vertexLayout.entries),
                vertexShaderStride: vertexLayout.stride,
            });
        }

        return this.pipelinesCache[pipelineName];
    }

    public createLayout(bindGroupLayout: BindGroupLayoutCpu): BindGroupLayoutGroupId {
        const uniqueKey = bindGroupLayout.entries
            .map(entry => `${entry.name}-${entry.binding}`).join('|');

        if (!this.bindGroupLayoutsCache[uniqueKey]) {
            this.bindGroupLayoutsCache[uniqueKey] = this.graphics.createShaderLayout(this._createBindGroupLayout(bindGroupLayout));
        }

        return this.bindGroupLayoutsCache[uniqueKey];
    }

    public createLayouts(bindGroupLayouts: BindGroupLayoutCpu[]): BindGroupLayoutGroupId[] {
        const returnIds: BindGroupLayoutGroupId[] = [];
        for (const bindGroupLayout of bindGroupLayouts) {
            // TODO disabling caching makes webgl2 to break. Investigate
            const uniqueKey = bindGroupLayout.entries
                .map(entry => `${entry.name}-${entry.binding}`).join('|');
            if (!this.bindGroupLayoutsCache[uniqueKey]) {
                this.bindGroupLayoutsCache[uniqueKey] = this.graphics.createShaderLayout(this._createBindGroupLayout(bindGroupLayout));
            }
            returnIds.push(this.bindGroupLayoutsCache[uniqueKey]);
        }

        return returnIds;
    }

    /**
     * Create a buffer with a given name. If a buffer with such name already exists, return the existing buffer.
     *
     */
    public createBuffer(name: BufferName, description: BufferDescription, data?: BufferData) {
        // TODO: REWORK THIS PIECE OF...
        if (name.toUpperCase() === 'GLOBAL') {
            if (!this.buffersCache[name.toUpperCase()]) {
                this.buffersCache[name.toUpperCase()] = this.graphics.createBuffer(description);
            }

            return this.buffersCache[name.toUpperCase()];
        }

        if (data) {
            return this.graphics.createBufferWithData(description, data);
        } else {
            return this.graphics.createBuffer(description);
        }
    }

    public createBindGroup(bindGroupLayoutId: BindGroupLayoutGroupId,
                           bindGroupEntries: BindGroupEntry[]): BindGroupId {
        return this.graphics.createBindGroup(bindGroupLayoutId, bindGroupEntries);
    }

    public createTexture(name: TextureName, texture?: Texture): TextureId {
        if (!this.texturesCache[name]) {
            if (!texture && !TextureLoader.textures[name]) {
                console.warn(`Texture with name ${name} not present. Fallback to opaque`);
                this.texturesCache[name] = this.graphics.createTexture(Texture.OPAQUE_TEXTURE.imageData, name);
            } else {
                this.texturesCache[name] = this.graphics.createTexture((texture || TextureLoader.textures[name]).imageData, name);
            }
        }
        return this.texturesCache[name];
    }

    public createSampler(label: string): SamplerId {
        if (!this.samplersCache[label]) {
            this.samplersCache[label] = this.graphics.createSampler();
        }

        return this.samplersCache[label];
    }

    private createVertexShaderLayout(layout: VertexLayoutEntry[]) {
        const vertexShaderLayout: VertexBufferLayout[] = [];
        let lastEl = 0, lastOffset = 0;
        for (let i = 0; i < layout.length; i++) {
            const { dataType, elementsPerVertex } = layout[i];
            const format = (elementsPerVertex === 1 ? dataType : `${dataType}x${elementsPerVertex}`) as BufferFormat;

            lastOffset = lastOffset + Float32Array.BYTES_PER_ELEMENT * lastEl;
            vertexShaderLayout.push({
                offset: lastOffset,
                format: format,
                location: i
            });
            lastEl = elementsPerVertex;
        }
        return vertexShaderLayout;
    }

    private _createBindGroupLayout(uniformDescription: BindGroupLayoutCpu): BindGroupLayout {
        const { entries } = uniformDescription;
        const bindGroupVariables: BindGroupEntry[] = entries.map(entry => {
            const { type, name, binding, visibilityMask } = entry;
            if (type === 'uniform') {
                return {
                    type: 'uniform',
                    binding: binding,
                    name,
                    visibilityMask,
                    id: Symbol('TODO: REMOVE ME')
                }
            } else if (type === 'texture') {
                return {
                    type: 'texture',
                    binding: binding,
                    name,
                    visibilityMask,
                    id: Symbol('TODO: REMOVE ME')
                }
            } else if (type === 'sampler') {
                return {
                    type: 'sampler',
                    binding: binding,
                    name,
                    visibilityMask,
                    id: Symbol('TODO: REMOVE ME')
                }
            } else {
                return {
                    type: 'storage',
                    binding: binding,
                    name,
                    visibilityMask,
                    id: Symbol('TODO: REMOVE ME')
                }
            }
        });

        return {
            label: uniformDescription.label,
            variables: bindGroupVariables
        }
    }

    private mergeWithDefaultOptions(pipelineOptions: Partial<PipelineOptions>): PipelineOptions {
        return ObjectUtils.mergePartial(pipelineOptions, DEFAULT_PIPELINE_OPTIONS);
    }

    private getFragmentSource(shaderName: FragmentShaderName) {
        if (this.graphics instanceof WebGPUGraphics) {
            return this.getWebGpuFragmentSource(shaderName);
        }

        return this.getWebGlFragmentSource(shaderName);
    }

    private getVertexSource(shaderName: VertexShaderName) {
        if (this.graphics instanceof WebGPUGraphics) {
            return this.getWebGpuVertexSource(shaderName);
        }

        return this.getWebGlVertexSource(shaderName);
    }

    private getWebGpuVertexSource(shaderName: VertexShaderName) {
        switch (shaderName) {
            case VertexShaderName.BASIC:
                return gpuBasicVertex;
            case VertexShaderName.SPHERE:
                return gpuSphereVertexShader;
            case VertexShaderName.BASIC_INSTANCED:
                return gpuBasicVertexInstanced;
            case VertexShaderName.BASIC_WITH_LIGHT:
                return gpuLightVertexShader;
            case VertexShaderName.TERRAIN:
                return gpuTerrainVertexShader
            default: {
                logger.warn(`Unknown vertex shader name: ${shaderName}. Defaulting to basic!`);
                return gpuBasicVertex;
            }
        }
    }

    private getWebGlVertexSource(shaderName: VertexShaderName) {
        switch (shaderName) {
            case VertexShaderName.BASIC:
                return glBasicVertexShader
            case VertexShaderName.BASIC_INSTANCED:
                return glBasicVertexShaderInstanced;
            case VertexShaderName.SPHERE:
                return glSphereVertexShader;
            case VertexShaderName.BASIC_WITH_LIGHT:
                return glLightVertexShader;
            case VertexShaderName.TERRAIN:
                return glTerrainVertexShader
            default: {
                logger.warn(`Unknown vertex shader name: ${shaderName}. Defaulting to basic!`);
                return glBasicVertexShader;
            }
        }
    }

    private getWebGpuFragmentSource(shaderName: FragmentShaderName) {
        switch (shaderName) {
            case FragmentShaderName.BASIC:
                return gpuBasicFragment;
            case FragmentShaderName.SPHERE:
                return gpuSphereFragmentShader;
            case FragmentShaderName.BASIC_INSTANCED:
                return basicFragmentShaderInstanced;
            case FragmentShaderName.BASIC_WITH_LIGHT:
                return gpuLightFragmentShader;
            case FragmentShaderName.TERRAIN:
                return gpuTerrainFragmentShader;
            default: {
                logger.warn(`Unknown fragment shader name: ${shaderName}. Defaulting to basic!`);
                return gpuBasicFragment;
            }
        }
    }

    private getWebGlFragmentSource(shaderName: FragmentShaderName) {
        switch (shaderName) {
            case FragmentShaderName.BASIC:
            case FragmentShaderName.BASIC_INSTANCED:
                return glBasicFragmentShader;
            case FragmentShaderName.SPHERE:
                return glSphereFragmentShader
            case FragmentShaderName.BASIC_WITH_LIGHT:
                return glLightFragmentShader;
            case FragmentShaderName.TERRAIN:
                return glTerrainFragmentShader;
            default: {
                logger.warn(`Unknown fragment shader name: ${shaderName}. Defaulting to basic!`);
                return glBasicFragmentShader;
            }
        }
    }
}
