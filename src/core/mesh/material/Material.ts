import { MaterialBehaviour } from "core/factories/MaterialFactory";
import Graphics, { BindGroupId, RenderPass } from 'core/Graphics';
import MaterialProperties from 'core/mesh/material/MaterialProperties';
import BindGroup from "core/resources/BindGroup";
import BindGroupLayout from 'core/resources/BindGroupLayout';
import { FragmentShaderName } from 'core/resources/cpu/CpuShaderData';
import { BufferId } from 'core/resources/gpu/BufferDescription';
import { PipelineOptions } from 'core/resources/gpu/GpuShaderData';
import { TextureSize } from 'core/texture/Texture';
import DebugUtil from 'util/DebugUtil';

export interface MaterialDescriptor {
    fragmentShader: FragmentShaderName,
    properties: Partial<PipelineOptions>,
    textureSize?: TextureSize,
    bindGroupLayouts: BindGroupLayout[],
    createBuffers?: (graphics: Graphics) => BufferId[]
    createBindGroups?: (graphics: Graphics) => BindGroup[]
}

interface GpuBufferData {
    bindGroupIndex: number,
    bindGroupId: BindGroupId,
    bufferId: BufferId,
    dynamicOffset?: number,
}

export default class Material {
    private readonly bufferInfo: Partial<GpuBufferData>;
    // public readonly properties: MaterialProperties;
    private hasChanged: boolean;

    constructor(public readonly label: string,
                public readonly descriptor: MaterialDescriptor,
                public readonly properties: MaterialProperties,
                private readonly behaviour: MaterialBehaviour[] = [],
                /*private readonly*/ bufferInfo?: Partial<GpuBufferData>) {
        DebugUtil.addToWindowObject('mat_' + label, this);
        this.hasChanged = true;
        if (!bufferInfo) {
            this.bufferInfo = {};
        } else {
            this.bufferInfo = bufferInfo;
        }
    }

    update<T extends MaterialProperties>(mutator: (t: T) => void) {
        mutator(this.properties as T);
        this.hasChanged = true;
        console.warn('Material updated')
    }

    /*public setBufferData(bindGroupId: BindGroupId,
                         bufferId: BufferId,
                         bindGroupIndex: number,
                         dynamicOffset?: number) {
        if (this.bufferInfo.bindGroupIndex) {
            console.warn('Setting buffer data that is already set');
        }
        this.bufferInfo.bindGroupIndex = bindGroupIndex;
        this.bufferInfo.bindGroupId = bindGroupId;
        this.bufferInfo.bufferId = bufferId;
        this.bufferInfo.dynamicOffset = dynamicOffset;
    }*/

    public setBindGroups(graphics: Graphics, renderPass: RenderPass) {
        if (this.behaviour.length > 0) {
            this.behaviour.forEach(beh => {
                beh.setBindGroup(renderPass);
                if (this.hasChanged) {
                    beh.updateBuffer(graphics, this.properties.getBufferData());
                    this.hasChanged = false;
                }
            });

            return;
        }

        const { bufferId, bindGroupId, bindGroupIndex } = this.bufferInfo as GpuBufferData;
        if (this.hasChanged) {
            graphics.writeToBuffer(bufferId, this.properties.getBufferData());
            this.hasChanged = false;
        }

        renderPass.setBindGroup(bindGroupIndex, bindGroupId);
    }
}
