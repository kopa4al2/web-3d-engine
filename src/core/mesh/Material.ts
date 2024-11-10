import { BindGroupId, BindGroupLayoutGroupId, RenderPass } from 'core/Graphics';
import { FragmentShaderName } from 'core/resources/cpu/CpuShaderData';
import { BufferId, BufferUsage } from 'core/resources/gpu/BufferDescription';
import { BindGroupEntry, PipelineOptions } from 'core/resources/gpu/GpuShaderData';
import GPUResourceManager, { BindGroupLayoutCpu } from 'core/resources/GPUResourceManager';
import { SamplerId, TextureId } from 'core/texture/Texture';

export interface MaterialDescriptor {
    fragmentShader: FragmentShaderName,
    properties: Partial<PipelineOptions>,
    bindGroupLayouts: BindGroupLayoutCpu[],
    readonly data: Record<string, TextureId | SamplerId | Float32Array | Uint32Array>
}

export default class Material {

    public static newMaterial(gpuResourceManager: GPUResourceManager,
                              label: string,
                              descriptor: MaterialDescriptor) {
        const bindGroupLayoutIds = gpuResourceManager.createLayouts(descriptor.bindGroupLayouts);
        const bindGroups = [];

        for (let i = 0; i < bindGroupLayoutIds.length; i++) {
            const bindGroupLayout = descriptor.bindGroupLayouts[i];
            const bindGroupLayoutId = bindGroupLayoutIds[i];

            const bindGroupVars: BindGroupEntry[] = [];
            for (const uniformEntry of bindGroupLayout.entries) {
                const { type, binding, name, visibilityMask, defaultValue } = uniformEntry;
                const data = descriptor.data[name] || defaultValue;

                if (type === 'uniform') {
                    const byteLength = uniformEntry.byteLength!;
                    const id = gpuResourceManager.createBuffer(name, {
                        label: `${label}-${name}`,
                        byteLength,
                        usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST
                    }, data as Float32Array)
                    bindGroupVars.push({ binding, id, name, type, visibilityMask });
                } else if (type === 'storage') {
                    console.warn('Storage buffer used in material.', name)
                    throw '';
                } else if (type === 'texture') {
                    bindGroupVars.push({
                        id: data as TextureId || gpuResourceManager.createTexture(name),
                        binding,
                        name,
                        type,
                        visibilityMask
                    })
                } else {
                    bindGroupVars.push({
                        id: gpuResourceManager.createSampler(name),
                        binding,
                        name,
                        type,
                        visibilityMask
                    })
                }
            }

            bindGroups.push(gpuResourceManager.createBindGroup(bindGroupLayoutId, bindGroupVars));
        }

        return new Material(label, bindGroupLayoutIds, descriptor, bindGroups);
    }

    private constructor(public label: string,
                        public bindGroupLayouts: BindGroupLayoutGroupId[],
                        public descriptor: MaterialDescriptor,
                        private bindGroups: BindGroupId[]) {
    }

    public bind(renderPass: RenderPass) {
        this.bindGroups.forEach((bindGroup, index) => renderPass.setBindGroup(index + 1, bindGroup));
    }
}
