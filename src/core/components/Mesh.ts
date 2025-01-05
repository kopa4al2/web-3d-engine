import InstanceBuffer from 'core/buffer/InstanceBuffer';
import Graphics, { PipelineId, RenderPass } from 'core/Graphics';
import Geometry from 'core/mesh/Geometry';
import Material from 'core/mesh/material/Material';
import Component from './Component';


class Mesh implements Component {
  static readonly ID: symbol = Symbol('Mesh');
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
