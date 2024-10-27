import { Buffer, BufferData, BufferId, TextureData } from "core/buffer/Buffer";
import { BindGroup, BindGroupLayout, GPUShader, PipelineProperties, UniformGroup } from "core/shaders/GPUShader";
import { SamplerId, TextureId } from "core/texture/Texture";

export type PipelineId = symbol;
export type BindGroupId = symbol;
export type UniformGroupId = symbol;

export interface GraphicsDevice {

}

export interface GPUContext {

}

export default interface Graphics {

    beginRenderPass(): RenderPass;

    initPipeline(pipelineProperties: PipelineProperties, pipelineLayout: UniformGroupId[], name?: string): PipelineId;

    createShaderGroup(groupLayout: UniformGroup): UniformGroupId;

    createBindGroup(layoutId: UniformGroupId, layout: BindGroup[]): BindGroupId;

    createBuffer(buffer: Buffer): BufferId;

    createBufferWithData(buffer: Buffer, data: BufferData): BufferId;

    createTexture(img: TextureData, name?: string): TextureId;

    createSampler(): SamplerId;

    writeToBuffer(buffer: BufferId, data: BufferData, bufferOffset?: number, dataOffset?: number, dataToWriteSize?: number): void
}

export interface RenderPass {

    setPipeline(pipeline: PipelineId): RenderPass;

    setVertexBuffer(index: number, id: BufferId): RenderPass;

    setIndexBuffer(id: BufferId): RenderPass;

    bindGroup(index: number, bindGroup: BindGroupId): RenderPass;

    draw(drawMode: DrawMode, count: number): RenderPass;

    submit(): void;
}


export enum DrawMode {
    INDEX,
    VERTICES_ONLY,
    WIREFRAME,
}