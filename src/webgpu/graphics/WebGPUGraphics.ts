import Canvas from "Canvas";
import Graphics, { BindGroupId, PipelineId, RenderPass, BindGroupLayoutGroupId, VertexBufferId } from "core/Graphics";
import PropertiesManager from "core/PropertiesManager";
import { BufferData, BufferDescription, BufferId } from "core/resources/gpu/BufferDescription";
import { BindGroupLayout, BindGroupEntry, ShaderProgramDescription } from "core/resources/gpu/GpuShaderData";
import { SamplerId, TextureId } from "core/texture/Texture";
import { NamedLogger } from "util/Logger";
import WebGPUContext from "webgpu/graphics/WebGPUContext";
import WebGPUDevice from "webgpu/graphics/WebGPUDevice";

export default class WebGPUGraphics implements Graphics {

    private static readonly logger: NamedLogger = new NamedLogger('WebGPUGraphics');

    public readonly buffers: Map<BufferId, GPUBuffer>;
    private readonly textures: Map<TextureId, GPUTexture>;
    private readonly samplers: Map<SamplerId, GPUSampler>;

    public readonly pipelines: Map<PipelineId, GPUPipelineBase>;
    public readonly bindGroups: Map<PipelineId, GPUBindGroup>;
    public readonly shaderLayouts: Map<BindGroupLayoutGroupId, GPUBindGroupLayout>;

    private readonly _device: GPUDevice;
    // @ts-ignore
    private depthTexture: GPUTextureView;

    constructor(private gpuDevice: WebGPUDevice,
                private gpuContext: WebGPUContext,
                public props: PropertiesManager) {
        this._device = this.gpuDevice.gpuDevice;

        this.buffers = new Map();
        this.textures = new Map();
        this.samplers = new Map();
        this.pipelines = new Map();
        this.bindGroups = new Map();
        this.shaderLayouts = new Map();

        this.initDepthTexture(props);
        props.subscribeToAnyPropertyChange(['window.width', 'window.height'], this.initDepthTexture.bind(this));
    }

    beginRenderPass(): RenderPass {
        const device = this.gpuDevice.gpuDevice;
        const context = this.gpuContext.ctx;

        const commandEncoder = device.createCommandEncoder();
        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    clearValue: { r: 0.2, g: 0.2, b: 0.2, a: 1.0 }, // Clear color
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
            depthStencilAttachment: {
                view: this.depthTexture,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
                depthClearValue: 1.0,
            }
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

        return new WebGPURenderPass(passEncoder, commandEncoder, this);
    }

    initPipeline(shader: ShaderProgramDescription): PipelineId {
        const device = this._device;
        const vertexShader = device.createShaderModule({
            label: 'vertexShader',
            code: shader.vertexShaderSource
        });
        const fragmentShader = device.createShaderModule({
            label: 'fragmentShader',
            code: shader.fragmentShaderSource
        });

        const bindGroupLayouts = shader.shaderLayoutIds.map(id => this.shaderLayouts.get(id)!)
        console.log('Bind group layouts: ', bindGroupLayouts)
        const layout = device.createPipelineLayout({ bindGroupLayouts, label: `pipeline-layout-${shader.label}` });

        const buffers: GPUVertexBufferLayout[] = [{
            arrayStride: shader.vertexShaderStride,
            attributes: shader.vertexShaderLayout.map(({ offset, format, location }, i) => ({
                shaderLocation: location || i, format, offset
            }))
        }];
        const pipelineId = Symbol(`webgpu-pipeline-${shader.label}`);

        this.pipelines.set(pipelineId, device.createRenderPipeline({
            label: `pipeline-${shader.label}`,
            layout,
            vertex: {
                module: vertexShader,
                entryPoint: 'main',
                buffers,
            },
            fragment: {
                module: fragmentShader,
                entryPoint: 'main',
                targets: [
                    {
                        format: 'bgra8unorm',
                        blend: shader.options.blendMode,
                        writeMask: shader.options.writeMask === 'ALL'
                            ? GPUColorWrite.ALL
                            : GPUColorWrite.RED | GPUColorWrite.GREEN | GPUColorWrite.BLUE
                    },
                ],
            },
            primitive: {
                topology: (this.props.getBoolean('wireframe') || shader.options.wireframe) ? 'line-list' : 'triangle-list',
                frontFace: 'ccw',
                cullMode: shader.options.cullFace,
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: shader.options.depthWriteEnabled,
                depthCompare: shader.options.depthCompare,
            },
        }));
        // this.pipelines.get(pipelineId)!.getBindGroupLayout()
        return pipelineId;
    }

    public removePipeline(pipelineId: PipelineId): void {
    }

    createVertexBuffer(buffer: BufferDescription, data: BufferData): BufferId {
        return this.createBufferWithData(buffer, data);
    };

    public createShaderLayout(layout: BindGroupLayout): BindGroupLayoutGroupId {
        const id = Symbol(`webgpu-bind-group-layout-${layout.label}`);

        const { variables } = layout;
        const groupEntries: GPUBindGroupLayoutEntry[] = variables
            .map(({ type, binding, visibilityMask: { mask: visibility } }) => ({
                binding: binding,
                visibility,
                ...byType(type)
            }));

        function byType(type: string): Partial<GPUBindGroupLayoutEntry> {
            if (type === 'uniform') return { buffer: { type: 'uniform' } }
            if (type === 'storage') return { buffer: { type: 'read-only-storage' } }
            if (type === 'texture') return { texture: { sampleType: 'float' } }
            if (type === 'sampler') return { sampler: {} }
            throw 'Unknown type: ' + type;
        }

        this.shaderLayouts.set(id, this._device.createBindGroupLayout({
            // label: `bind-group-layout`,
            label: `bind-group-layout-${layout.label}`,
            entries: groupEntries,
        }));

        return id;
    }

    private id: number = 0
    public createBindGroup(layoutId: BindGroupLayoutGroupId, bindGroups: BindGroupEntry[]): BindGroupId {
        const id = Symbol(`webgpu-bind-group-${this.id++}`);

        const bindingEntries: GPUBindGroupEntry[] = bindGroups.map(({ binding, type, id }) => ({
            binding: binding,
            resource: getResourceByType(id, type, this)
        }));

        function getResourceByType(id: BufferId, type: string, _this: WebGPUGraphics): GPUBindingResource {
            if (type === 'uniform' || type === 'storage') return { buffer: _this.buffers.get(id)! }
            if (type === 'texture') return _this.textures.get(id)!.createView()
            if (type === 'sampler') return _this.samplers.get(id)!
            throw 'Unknown type: ' + type;
        }

        this.bindGroups.set(id, this._device.createBindGroup({
            label: `bind-group-${layoutId.toString()}`,
            layout: this.shaderLayouts.get(layoutId)!,
            entries: bindingEntries
        }));

        return id;
    }

    createBuffer(buffer: BufferDescription): BufferId {
        const bId = Symbol(`buffer_${buffer.label}`);
        const gpuBuffer = this._device.createBuffer({
            label: buffer.label,
            size: buffer.byteLength,
            usage: buffer.usage
        });

        this.buffers.set(bId, gpuBuffer);

        return bId;
    }

    createBufferWithData(buffer: BufferDescription, data: BufferData): BufferId {
        const bufferId = Symbol(`buffer_d_${buffer.label}`);
        const gpuBuffer = this._device.createBuffer({
            label: buffer.label,
            size: buffer.byteLength,
            // usage: (buffer.usage & (~GPUBufferUsage.COPY_DST)),
            usage: buffer.usage,
            // mappedAtCreation: true,
        });
        // new Float32Array(gpuBuffer.getMappedRange()).set(data);
        // gpuBuffer.unmap();
        this._device.queue.writeBuffer(gpuBuffer, 0, data, 0, data.length);

        this.buffers.set(bufferId, gpuBuffer);

        return bufferId;
    }

    createTexture(img: ImageBitmap): TextureId {
        const textureId = Symbol('texture');

        const textureGpu = this._device.createTexture({
            size: [img.width, img.height],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING
                | GPUTextureUsage.COPY_DST
                | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        this._device.queue.copyExternalImageToTexture(
            { source: img },
            { texture: textureGpu },
            [img.width, img.height]
        );

        this.textures.set(textureId, textureGpu);
        return textureId;
    }

    createSampler(): SamplerId {
        const samplerId = Symbol('sampler');
        this.samplers.set(samplerId, this._device.createSampler({
            magFilter: 'linear',  // Linear filtering for magnification
            minFilter: 'linear',  // Linear filtering for minification
            addressModeU: 'repeat',  // Repeat the texture in the U direction
            addressModeV: 'repeat',  // Repeat the texture in the V direction
        }));

        return samplerId;
    }

    writeToBuffer(buffer: BufferId, data: BufferData, bufferOffset: number = 0, dataOffset: number = 0, dataToWriteSize: number = data.length) {
        const bfr = this.buffers.get(buffer) as GPUBuffer;
        this._device.queue.writeBuffer(bfr, bufferOffset, data, dataOffset, dataToWriteSize)
    }

    getDevice(): WebGPUDevice {
        return this.gpuDevice;
    }

    getContext(): WebGPUContext {
        return this.gpuContext;
    }

    private initDepthTexture(properties: PropertiesManager) {
        this.depthTexture = this._device.createTexture({
            size: [properties.getAbsolute('window.width'), properties.getAbsolute('window.height'), 1],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        }).createView();
    }

    public static async initWebGPU(canvas: Canvas, properties: PropertiesManager): Promise<WebGPUGraphics> {
        const context = canvas.getWebGpuContext();
        const adapter = await navigator?.gpu?.requestAdapter({ powerPreference: 'high-performance' });

        if (!context || !adapter) {
            throw 'WebGPU is not supported';
        }

        const device = await adapter.requestDevice({ requiredLimits: { maxBindGroups: 4 } });

        console.groupCollapsed('WebGPU Adapter limits')
        console.table(adapter.limits)
        console.groupEnd();

        const swapChainFormat = 'bgra8unorm';
        context.configure({
            device: device,
            format: swapChainFormat,
        });
        /*context.configure({
            device: device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: 'premultiplied'
        });*/


        return new WebGPUGraphics(new WebGPUDevice(device), new WebGPUContext(context), properties);
    }
}

export class WebGPURenderPass implements RenderPass {

    // @ts-ignore
    private pipelineId: PipelineId;

    constructor(private passEncoder: GPURenderPassEncoder,
                private commandEncoder: GPUCommandEncoder,
                private graphics: WebGPUGraphics) {
    }

    public usePipeline(pipeline: PipelineId): RenderPass {
        this.pipelineId = pipeline;
        this.passEncoder.setPipeline(this.graphics.pipelines.get(pipeline) as GPURenderPipeline);
        return this;
    }

    public setVertexBuffer(slot: number, vertexBufferId: VertexBufferId): RenderPass {
        // Dirty temporary hack, why do we save separate buffer id for vertex buffer and normal buffer?
        // const { bufferId } = this.graphics.vertexBuffers[vertexBufferId] || { bufferId: vertexBufferId };
        this.passEncoder.setVertexBuffer(slot, this.graphics.buffers.get(vertexBufferId)!)

        return this;
    }

    public setBindGroup(index: number, bindGroupId: BindGroupId, dynamicOffset?: number[]): RenderPass {
        const bindGroup = this.graphics.bindGroups.get(bindGroupId) as GPUBindGroup;

        this.passEncoder.setBindGroup(index, bindGroup, dynamicOffset);

        return this;
    }


    public drawInstanced(indexBuffer: BufferId, indices: number, instances: number): RenderPass {
        const buffer = this.graphics.buffers.get(indexBuffer) as GPUBuffer;
        this.passEncoder.setIndexBuffer(buffer, 'uint32');

        this.passEncoder.drawIndexed(indices, instances);

        // this.passEncoder.drawIndexedIndirect(indices, 1, 0, 0, 0);
        return this;
    }

    public drawIndexed(indexBuffer: BufferId, indices: number): RenderPass {
        const buffer = this.graphics.buffers.get(indexBuffer) as GPUBuffer;
        this.passEncoder.setIndexBuffer(buffer, 'uint32');

        this.passEncoder.drawIndexed(indices, 1, 0, 0, 0);
        return this;
    }


    submit(): void {
        this.passEncoder.end();
        const commandBuffer = this.commandEncoder.finish();
        this.graphics.getDevice().gpuDevice.queue.submit([commandBuffer]);
    }

}
