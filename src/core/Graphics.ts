import BindGroup from 'core/resources/BindGroup';
import BindGroupLayout from 'core/resources/BindGroupLayout';
import { BufferData, BufferDescription, BufferId } from "core/resources/gpu/BufferDescription";
import { ShaderProgramDescription } from "core/resources/gpu/GpuShaderData";
import SamplingConfig from "core/texture/SamplingConfig";
import Texture, {
    SamplerId,
    TextureDescription,
    ImageChannelFormat,
    TextureId,
    ImageChannel,
    ImageWithData, TextureType, GlFace
} from "core/texture/Texture";
import { vec3 } from 'gl-matrix';

export enum SupportedGraphicsApi {
    WEBGL2, WEBGPU
}

export type PipelineId = symbol;
export type BindGroupLayoutId = symbol;
export type BindGroupId = symbol;

export interface GraphicsDevice {

}

export interface GPUContext {

}

export interface UpdateTexture {
    data: ImageWithData
    dataOffset?: number,
    x: number,
    y: number,
    z?: number,
    glFace?: GlFace,
}


export default interface Graphics {

    beginRenderPass(descriptor?: RenderPassDescriptor): RenderPass;

    initPipeline(shader: ShaderProgramDescription): PipelineId;

    createShaderLayout(layout: BindGroupLayout): BindGroupLayoutId;

    createBindGroup(layoutId: BindGroupLayoutId, bindGroups: BindGroup): BindGroupId;

    createBuffer(buffer: BufferDescription): BufferId;

    createBufferWithData(buffer: BufferDescription, data: BufferData): BufferId;

    createTexture(textureDescription: TextureDescription): TextureId;

    createSampler(sampler: SamplingConfig): SamplerId;

    writeToBuffer(buffer: BufferId, data: BufferData, bufferOffset?: number, dataOffset?: number, dataToWriteSize?: number): void;

    writeToTexture?(textureId: TextureId, source: ImageData, coordinates?: vec3, sourceWidth?: number, sourceHeight?: number): void;

    updateTexture(textureId: TextureId, updateTexture: UpdateTexture): void;

    // ONLY FOR DEBUGGING
    _rawApi(): WebGL2RenderingContext | GPUDevice

    _getTextureData?(texture: TextureId): Promise<Float32Array>

    _exportTextureArray?(textureId: TextureId): void
}


export type RenderPassAttachment = { skip: true } | {
    skip?: false
    textureId: TextureId,
    textureView?: { dimension: '2d', baseArrayLayer: number, aspect: 'all' | 'stencil-only' | 'depth-only' }
};
export type RenderPassDepthAttachment = RenderPassAttachment;
export type RenderPassColorAttachment = RenderPassAttachment;

export interface Viewport {
    x?: number,
    y?: number,
    width?: number,
    height?: number,
}

export interface RenderPassDescriptor {
    label?: string,
    depthAttachment: RenderPassDepthAttachment,
    colorAttachment: RenderPassColorAttachment,
    viewport?: Viewport,
}

export interface RenderPass {

    usePipeline(pipeline: PipelineId): RenderPass;

    setVertexBuffer(slot: number, vertexBufferId: BufferId): RenderPass;

    setBindGroup(index: number, bindGroupId: BindGroupId, dynamicOffset?: number[]): RenderPass;

    drawInstanced(indexBuffer: BufferId, indices: number, instances: number): RenderPass;

    drawIndexed(indexBuffer: BufferId, indices: number): RenderPass;

    drawSimple(indices: number): RenderPass;

    submit(): void;
}
