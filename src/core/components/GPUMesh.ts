// import Component from "core/components/Component";
// import { BindGroupId, PipelineId, VertexBufferId } from "core/Graphics";
// import { ShaderProgramName } from 'core/resources/cpu/CpuShaderData';
// import { BufferId } from "core/resources/gpu/BufferDescription";
// import { IndexBuffer } from 'core/resources/gpu/GpuShaderData';
//
// export type GPUMeshAny = GPUMesh | GPUMeshGroup;
// export default class GPUMesh implements Component {
//     static readonly ID: symbol = Symbol("GPUMesh");
//     readonly id: symbol = GPUMesh.ID;
//
//     constructor(public shaderName: ShaderProgramName,
//                 public bufferGroups: StaticGpuUniforms,
//                 public bindGroups: BindGroupId[],
//                 public pipeline: PipelineId,
//                 public vertexBuffers: VertexBufferId[],
//                 public indexBuffer?: IndexBuffer) {
//     }
//
//     get meshes(): GPUMesh[] {
//         return [this];
//     }
// }
//
// export class GPUMeshGroup implements Component {
//     // static readonly ID: symbol = Symbol("GPUMesh");
//     readonly id: symbol = GPUMesh.ID;
//
//     constructor(public meshes: GPUMesh[]) {
//     }
// }
//
// export class StaticGpuUniforms {
//
//     // constructor(public vertexBuffer: BufferId, public fragmentBuffer: BufferId) {}
//
//     constructor(public buffers: Record<string, BufferId>) {
//
//     }
// }
