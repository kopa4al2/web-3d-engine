import { BindGroupId, BindGroupLayoutId, RenderPass } from "core/Graphics";
import { BindGroupEntry, BindGroupEntryType } from "core/resources/BindGroup";
import { BufferId, BufferUsage } from "core/resources/gpu/BufferDescription";
import { UniformVisibility } from "core/resources/gpu/GpuShaderData";
import ResourceManager from "core/resources/ResourceManager";
import { ShaderStruct, ShaderStructName } from "core/resources/shader/ShaderStruct";
import Bitmask from "../../util/BitMask";


export type ShaderVariableType = 'vec3' | 'vec2' | 'mat4';

export interface ShaderUniformVariable {
    type: ShaderVariableType,
    name: string,
}

export class ShaderUBO {

    private bufferId?: BufferId;
    private bindGroupId?: BindGroupId;
    private bindGroupLayoutId?: BindGroupLayoutId;

    constructor(public name: string, public structs: ShaderStructV2[]) {
    }

    create(resourceManager: ResourceManager) {
        const entries: ShaderStruct[] = this.structs.map((str, index) => ({
            type: 'uniform',
            binding: index,
            name: str.name,
            visibilityMask: new Bitmask(str.visibility),
        }));
        const byteLength = this.structs.reduce((acc, curr) => {
            acc += this.getByteLength(curr);
            return acc;
        }, 0)
        const layout = resourceManager.getOrCreateLayout({ label: this.name, entries });
        const bufferId = resourceManager.createBuffer({
            byteLength,
            label: this.name,
            usage: BufferUsage.COPY_DST | BufferUsage.UNIFORM
        });
        const bindGroup = resourceManager.createBindGroup(layout, {
            label: this.name,
            entries: entries.map(struct => ({
                ...struct,
                bufferId
            }))
        });

        this.bindGroupLayoutId = layout;
        this.bufferId = bufferId;
        this.bindGroupId = bindGroup;
    }

    public setBindGroup(pass: RenderPass, i: number) {
        pass.setBindGroup(i, this.bindGroupId!);
    }

    public get buffer() {
        return this.bufferId!;
    }

    private getByteLength(struct: ShaderStructV2): number {
        return struct.byteLength;
    }
}

export default class Helpers {
}

export interface ShaderStructV2 {
    name: string,
    visibility: UniformVisibility,
    byteLength: number,
    type?: BindGroupEntryType,
}

export class BindGroupHelper {
    // public bufferId: BufferId;
    public bindGroupId: BindGroupId;
    public bindGroupLayoutId: BindGroupLayoutId;

    private buffers: BufferId[] = [];
    private structs: ShaderStructName[] = [];

    constructor(resourceManager: ResourceManager, public name: string, structs: ShaderStructV2[]) {
        const label = name;
        const entries: (BindGroupEntry & ShaderStruct)[] = [];
        const byteLength = structs.reduce((acc, curr) => {
            acc += this.getByteLength(curr);
            return acc;
        }, 0);
        for (let i = 0; i < structs.length; i++) {
            const struct = structs[i];

            const bufferId = resourceManager.createBuffer({
                byteLength,
                usage: BufferUsage.COPY_DST | (struct.type === 'storage' ? BufferUsage.STORAGE : BufferUsage.UNIFORM),
                label: struct.name,
            });
            this.buffers.push(bufferId);
            this.structs.push(struct.name);
            entries.push({
                type: struct.type || 'uniform',
                binding: i,
                name: struct.name,
                visibilityMask: new Bitmask(struct.visibility),
                bufferId,
            });
        }
        // const entries: ShaderStruct[] = this.structs.map((str, index) => ({
        //     type: str.type || 'uniform',
        //     binding: index,
        //     name: str.name,
        //     visibilityMask: new Bitmask(str.visibility),
        // }));

        const bindGroupLayoutId = resourceManager.getOrCreateLayout({ label, entries });
        // const bufferId = resourceManager.createBuffer({
        //     byteLength,
        //     label: this.name,
        //     usage: BufferUsage.COPY_DST | BufferUsage.UNIFORM
        // });
        const bindGroupId = resourceManager.createBindGroup(bindGroupLayoutId, { label, entries });
        // const bindGroupId = resourceManager.createBindGroup(bindGroupLayoutId, {
        //     label: this.name,
        //     entries: entries.map(struct => ({
        //         ...struct,
        //         bufferId
        //     }))
        // });

        this.bindGroupLayoutId = bindGroupLayoutId;
        this.bindGroupId = bindGroupId;
        // this.bufferId = bufferId;
    }

    get bufferId() {
        return this.buffers[0];
    }

    private getByteLength(struct: ShaderStructV2): number {
        return struct.byteLength;
    }
}