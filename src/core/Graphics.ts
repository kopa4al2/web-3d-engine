import { BufferData, BufferDescription, BufferId, TextureData } from "core/resources/gpu/BufferDescription";
import { BindGroupLayout, BindGroupEntry, ShaderProgramDescription } from "core/resources/gpu/GpuShaderData";
import { SamplerId, TextureId } from "core/texture/Texture";

export type PipelineId = symbol;
export type BindGroupLayoutGroupId = symbol;
export type BindGroupId = symbol;
export type VertexBufferId = symbol;

export interface GraphicsDevice {

}

export interface GPUContext {

}

export default interface Graphics {

    beginRenderPass(): RenderPass;

    initPipeline(shader: ShaderProgramDescription): PipelineId;

    removePipeline?(pipelineId: PipelineId): void;

    createShaderLayout(layout: BindGroupLayout): BindGroupLayoutGroupId;

    createBindGroup(layoutId: BindGroupLayoutGroupId, bindGroups: BindGroupEntry[]): BindGroupId;

    createBuffer(buffer: BufferDescription): BufferId;

    createBufferWithData(buffer: BufferDescription, data: BufferData): BufferId;

    createTexture(img: TextureData, name?: string): TextureId;

    createSampler(): SamplerId;

    writeToBuffer(buffer: BufferId, data: BufferData, bufferOffset?: number, dataOffset?: number, dataToWriteSize?: number): void
}

export interface RenderPass {

    usePipeline(pipeline: PipelineId): RenderPass;

    setVertexBuffer(slot: number, vertexBufferId: BufferId): RenderPass;

    setBindGroup(index: number, bindGroupId: BindGroupId, dynamicOffset?: number[]): RenderPass;

    drawInstanced(indexBuffer: BufferId, indices: number, instances: number): RenderPass;

    drawIndexed(indexBuffer: BufferId, indices: number): RenderPass;

    submit(): void;
}
