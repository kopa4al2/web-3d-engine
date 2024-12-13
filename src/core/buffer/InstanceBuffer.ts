import { BindGroupId } from "core/Graphics";
import { BufferId } from "core/resources/gpu/BufferDescription";

export default class InstanceBuffer {
    constructor(public bufferId: BufferId, public bindGroupId: BindGroupId) {
    }
}