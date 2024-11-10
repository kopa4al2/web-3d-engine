import Material, { MaterialDescriptor } from 'core/mesh/Material';
import { FragmentShaderName } from 'core/resources/cpu/CpuShaderData';
import {
    FLAGS_STRUCT,
    GLOBAL_STRUCT,
    LIT_MATERIAL_STRUCT,
    STORAGE_BUFFER_STRUCT, UNLIT_MATERIAL_STRUCT
} from 'core/resources/DefaultBindGroupLayouts';
import { BufferId } from 'core/resources/gpu/BufferDescription';
import { UniformVisibility } from 'core/resources/gpu/GpuShaderData';
import GPUResourceManager, { BindGroupLayoutCpu } from 'core/resources/GPUResourceManager';
import { RenderFlags, ShapeFlags } from 'core/resources/MeshManager';
import Bitmask from 'util/BitMask';

export default class MaterialFactory {

    constructor(private gpuResourceManager: GPUResourceManager) {
    }


    public litMaterial(label: string = 'LitMaterial',
                       properties: Partial<MaterialDescriptor> = {}) {
        return Material.newMaterial(this.gpuResourceManager, label, { ...MaterialFactory.LIT_MATERIAL_DESCRIPTOR, ...properties });
    }

    public unlitMaterial(label: string, properties: Partial<MaterialDescriptor> = {}) {
        return Material.newMaterial(this.gpuResourceManager, label, { ...MaterialFactory.UNLIT_MATERIAL_DESCRIPTOR, ...properties });
    }

    public unlitWithFlags(flags: number[], label: string, properties: Partial<MaterialDescriptor>) {
        const descriptor = { ...MaterialFactory.UNLIT_MATERIAL_DESCRIPTOR, ...properties };
        descriptor.data['Flags'] = new Uint32Array(flags);

        return Material.newMaterial(this.gpuResourceManager, label, descriptor);
    }

    public shapeMaterial(shape: ShapeFlags, label: string, properties: Partial<MaterialDescriptor> = {}) {
        const descriptor = { ...MaterialFactory.UNLIT_MATERIAL_DESCRIPTOR, ...properties };
        const currentFlags = descriptor.data['Flags'] as Uint32Array || new Uint32Array([0, shape]);
        currentFlags[1] = shape;
        return this.unlitWithFlags([...currentFlags], label, properties)
    }

    public transparentMaterial(label: string, properties: Partial<MaterialDescriptor> = {}) {
        // TODO: Implement if needed
    }

    public static readonly UNLIT_MATERIAL_DESCRIPTOR: MaterialDescriptor = {
        bindGroupLayouts: [
            {
                label: 'material',
                entries: [UNLIT_MATERIAL_STRUCT, FLAGS_STRUCT]
            },
        ],
        data:{},
        properties: {},
        fragmentShader: FragmentShaderName.SPHERE
    };

    public static readonly LIT_MATERIAL_DESCRIPTOR: MaterialDescriptor = {
        bindGroupLayouts: [
            {
                label: 'material', entries: [
                    LIT_MATERIAL_STRUCT,
                    {
                        type: 'texture',
                        name: 'uSampler',
                        binding: 1,
                        visibilityMask: new Bitmask(UniformVisibility.FRAGMENT)
                    },
                    {
                        type: 'sampler',
                        name: 'uSampler',
                        binding: 2,
                        visibilityMask: new Bitmask(UniformVisibility.FRAGMENT)
                    },
                ]
            }],
        data: {},
        properties: {},
        fragmentShader: FragmentShaderName.BASIC_WITH_LIGHT
    }
}
