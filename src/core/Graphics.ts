import { Buffer, BufferData, BufferId, TextureData } from "core/buffer/Buffer";
import { Shader } from "core/shaders/Shader";
import { SamplerId, TextureId } from "core/texture/Texture";

export type PipelineId = symbol;

export interface GraphicsDevice {

}

export interface GPUContext {

}

export default interface Graphics {

    beginRenderPass(): RenderPass;

    initPipeline(shader: Shader): PipelineId;

    createBuffer(buffer: Buffer): BufferId;

    createBufferWithData(buffer: Buffer, data: BufferData): BufferId;

    createTexture(img: TextureData, name?:string): TextureId;

    createSampler(): SamplerId;

    writeToBuffer(buffer: BufferId, data: BufferData, bufferOffset?: number, dataOffset?: number, dataToWriteSize?: number): void
}

export interface RenderPass {

    draw(pipeline: PipelineId): RenderPass;

    submit(): void;
}
