import { BufferId } from "core/buffer/Buffer";
import Component from "core/components/Component";
import { Geometry } from "core/components/Mesh";
import { PipelineId } from "core/Graphics";
import { Shader } from "core/shaders/Shader";

export default class GPUMesh implements Component {
    static readonly ID: symbol = Symbol("GPUMesh");
    readonly id: symbol = GPUMesh.ID;

    constructor(public shader: Shader,
                public bufferGroups: StaticGpuUniforms,
                public pipeline: PipelineId) {
    }

    get meshes(): GPUMesh[] {
        return [this];
    }
}

export class GPUMeshGroup implements Component {
    static readonly ID: symbol = Symbol("GPUMesh");
    readonly id: symbol = GPUMesh.ID;

    constructor(public meshes: GPUMesh[]) {
    }
}

export class StaticGpuUniforms {

    constructor(public vertexBuffer: BufferId, public fragmentBuffer: BufferId) {

    }
}
