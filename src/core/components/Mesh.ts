import { BindGroupId, PipelineId, RenderPass } from 'core/Graphics';
import Geometry from 'core/mesh/Geometry';
import Material from 'core/mesh/Material';
import { BufferId } from 'core/resources/gpu/BufferDescription';
import { PipelineName } from 'core/resources/GPUResourceManager';
import Component from "./Component";

export default class Mesh implements Component {
    static readonly ID: symbol = Symbol("Mesh");
    readonly id: symbol = Mesh.ID;

    constructor(public meshId: string,
                public pipelineId: PipelineId,
                public geometry: Geometry,
                public material: Material,
                public instanceBuffer: [BufferId, BindGroupId],
                public subMesh: Mesh[] = []) {
    }

    update(renderPass: RenderPass) {
        this.material.bind(renderPass);
    }

    render(renderPass: RenderPass) {
    }
}
