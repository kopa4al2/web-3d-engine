import InstanceBuffer from "core/buffer/InstanceBuffer";
import Transform, { defaultTransform, ModelMatrix } from 'core/components/Transform';
import Graphics, { PipelineId, RenderPass } from 'core/Graphics';
import Geometry from 'core/mesh/Geometry';
import Material from 'core/mesh/material/Material';
import { BufferId } from 'core/resources/gpu/BufferDescription';
import Component from "./Component";

class MeshV2 implements Component {
    static readonly ID: symbol = Symbol("Mesh");
    readonly id: symbol = Mesh.ID;


    constructor(public geometry: Geometry) {

        // if (instanceData) {
        //     this.instanceBuffer = this.createBuffer(instanceData);
        //     this.instanceCount = instanceData.length / this.getInstanceStride();
        // }
    }

    private getInstanceStride(): number {
        // Return the stride (bytes per instance) for instance data
        // For example, position (3 floats) + scale (1 float) = 4 floats = 16 bytes
        return 16;
    }

    update(api: Graphics, renderPass: RenderPass): void {
        /*renderPass.setVertexBuffer(0, this.geometry.vertexBuffer);
        if (this.instanceBuffer) {
            api.bindInstanceBuffer(this.instanceBuffer);
            api.drawIndexedInstanced(this.indexBuffer, this.instanceCount);
        } else {
            api.drawIndexed(this.indexBuffer);
        }*/
    }
}


class Mesh implements Component {
    static readonly ID: symbol = Symbol("Mesh");
    readonly id: symbol = Mesh.ID;

    constructor(public pipelineId: PipelineId,
                public geometry: Geometry,
                public material: Material,
                public instanceBuffers?: InstanceBuffer[],
                public label = 'N/A') {
    }

    public setBindGroup(graphics: Graphics, renderPass: RenderPass) {
        this.material.setBindGroups(graphics, renderPass);
    }
}

export default Mesh;
