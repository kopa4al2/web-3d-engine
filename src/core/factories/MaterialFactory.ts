import Graphics, { RenderPass } from "core/Graphics";
import Material, { MaterialDescriptor } from 'core/mesh/material/Material';
import MaterialProperties, { TerrainMaterialProperties } from 'core/mesh/material/MaterialProperties';
import { FragmentShaderName } from 'core/resources/cpu/CpuShaderData';
import {
    PBR_MATERIAL_STRUCT,
    PHONG_MATERIAL_STRUCT,
    TERRAIN_MATERIAL_STRUCT,
    UNLIT_MATERIAL_STRUCT
} from 'core/resources/DefaultBindGroupLayouts';
import { BufferData, BufferUsage } from "core/resources/gpu/BufferDescription";
import { PipelineOptions } from 'core/resources/gpu/GpuShaderData';
import ResourceManager from "core/resources/ResourceManager";

export interface MaterialBehaviour {
    setBindGroup: (renderPass: RenderPass) => void,
    updateBuffer: (graphics: Graphics, data: BufferData) => void
}

export default class MaterialFactory {

    constructor(private resourceManager: ResourceManager) {
    }

    public terrainMaterial(label: string = 'TerrainMaterial',
                           data: TerrainMaterialProperties,
                           overrides: Partial<PipelineOptions> = {}) {
        return new Material(label,
            {
                ...MaterialFactory.TERRAIN_MATERIAL_DESCRIPTOR,
                properties: {
                    ...MaterialFactory.TERRAIN_MATERIAL_DESCRIPTOR,
                    ...overrides
                }
            }, data);
    }

    public litMaterial(label: string = 'LitMaterial',
                       data: MaterialProperties,
                       overrides: Partial<PipelineOptions> = {}) {
        const descriptor: MaterialDescriptor = {
            ...MaterialFactory.PHONG_MATERIAL_DESCRIPTOR,
            properties: {
                ...MaterialFactory.PHONG_MATERIAL_DESCRIPTOR.properties,
                ...overrides
            }
        };

        const fns:MaterialBehaviour[] = [];
        for (let bindGroupLayout of descriptor.bindGroupLayouts) {
            const layoutId = this.resourceManager.getOrCreateLayout(bindGroupLayout);
            const bufferData = data.getBufferData();

            const buffer = this.resourceManager.createBufferV2({
                byteLength: 64,
                // byteLength: 64,
                // byteLength: bindGroupLayout.entries.reduce((acc: number, entry: ShaderStruct) => acc + (entry.byteLength || 0), 0),
                label: 'Material',
                usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
            }, bufferData)

            const bindGroup = this.resourceManager.createBindGroup(layoutId, {
                label: 'Material',
                entries: bindGroupLayout.entries.map((entry, index) => ({
                    binding: index,
                    name: entry.name,
                    type: entry.type,
                    bufferId: buffer
                }))
            });

            fns.push({
                setBindGroup: (renderPass: RenderPass) => {
                    // TODO: If more bind groups are needed this shouldn't be hardcoded
                    renderPass.setBindGroup(1, bindGroup);
                },
                updateBuffer: (graphics: Graphics, data: BufferData) => {
                    graphics.writeToBuffer(buffer, data);
                }
            });
        }

        return new Material(label, descriptor, data, fns);
    }

    // public unlit(label: string, pipelineOptions: Partial<PipelineOptions>, materialProperties: MaterialProperties) {
    //     return new Material(label,
    //         {
    //             ...MaterialFactory.UNLIT_MATERIAL_DESCRIPTOR,
    //             properties: {
    //                 ...MaterialFactory.UNLIT_MATERIAL_DESCRIPTOR.properties,
    //                 ...pipelineOptions
    //             }
    //         }, materialProperties);
    // }
    //
    // public viewFrustumMaterial() {
    //     return new Material('basic', {
    //         bindGroupLayouts: [],
    //         properties: {
    //             // blendMode: BlendPresets.TRANSPARENT,
    //             wireframe: true,
    //             cullFace: 'none',
    //         },
    //         fragmentShader: FragmentShaderName.BASIC
    //     }, {
    //         getBufferData(): Float32Array {
    //             return new Float32Array([1.0, 1.0, 0.0, 1.0]);
    //         }
    //     })
    // }

    public pbrMaterial(label: string = 'PBRMaterial',
                       data: MaterialProperties,
                       overrides: Partial<PipelineOptions> = {}) {
        const descriptor: MaterialDescriptor = {
            ...MaterialFactory.PBR_MATERIAL_DESCRIPTOR,
            properties: {
                ...MaterialFactory.PBR_MATERIAL_DESCRIPTOR.properties,
                ...overrides
            }
        };

        const fns:MaterialBehaviour[] = [];
        for (let bindGroupLayout of descriptor.bindGroupLayouts) {
            const layoutId = this.resourceManager.getOrCreateLayout(bindGroupLayout);
            const bufferData = data.getBufferData();

            // console.log('Pbr byte len', bufferData.byteLength)
            const buffer = this.resourceManager.createBufferV2({
                byteLength: bufferData.byteLength,
                label: 'Material',
                usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
            }, bufferData)

            const bindGroup = this.resourceManager.createBindGroup(layoutId, {
                label: 'PBR',
                entries: bindGroupLayout.entries.map((entry, index) => ({
                    binding: index,
                    name: entry.name,
                    type: entry.type,
                    bufferId: buffer
                }))
            });

            fns.push({
                setBindGroup: (renderPass: RenderPass) => {
                    // TODO: If more bind groups are needed this shouldn't be hardcoded
                    renderPass.setBindGroup(1, bindGroup);
                },
                updateBuffer: (graphics: Graphics, data: BufferData) => {
                    graphics.writeToBuffer(buffer, data);
                }
            });
        }

        return new Material(label, descriptor, data, fns);
    }

    public static readonly UNLIT_MATERIAL_DESCRIPTOR: MaterialDescriptor = {
        bindGroupLayouts: [{ label: 'UnlitMaterial', entries: [UNLIT_MATERIAL_STRUCT] }],
        properties: {},
        fragmentShader: FragmentShaderName.UNLIT
    };
    public static readonly TERRAIN_MATERIAL_DESCRIPTOR: MaterialDescriptor = {
        bindGroupLayouts: [{ label: 'TerrainMaterial', entries: [TERRAIN_MATERIAL_STRUCT] }],
        properties: {},
        fragmentShader: FragmentShaderName.TERRAIN
    }
    public static readonly PHONG_MATERIAL_DESCRIPTOR: MaterialDescriptor = {
        bindGroupLayouts: [{ label: 'PhongMaterial', entries: [PHONG_MATERIAL_STRUCT] }],
        properties: {},
        fragmentShader: FragmentShaderName.PHONG_LIT
    }

    public static readonly PBR_MATERIAL_DESCRIPTOR: MaterialDescriptor = {
        bindGroupLayouts: [
            { label: 'PBRMaterial', entries: [PBR_MATERIAL_STRUCT] },
        ],
        properties: {
        },
        fragmentShader: FragmentShaderName.PBR,
    }
}
