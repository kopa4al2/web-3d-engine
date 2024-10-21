import Canvas from "Canvas";
import { Buffer, BufferData, BufferId } from "core/buffer/Buffer";
import Graphics, { PipelineId, RenderPass } from "core/Graphics";
import PropertiesManager, { WindowProperties } from "core/PropertiesManager";
import { Shader, ShaderType } from "core/shaders/Shader";
import { SamplerId, TextureId } from "core/texture/Texture";
import log, { NamedLogger } from "util/Logger";
import ThrottleUtil from "util/ThrottleUtil";
import WebGPUContext from "webgpu/graphics/WebGPUContext";
import WebGPUDevice from "webgpu/graphics/WebGPUDevice";

export default class WebGPUGraphics implements Graphics {

    private static readonly logger: NamedLogger = new NamedLogger('WebGPUGraphics');

    public readonly buffers: Map<BufferId, GPUBuffer>;
    private readonly textures: Map<TextureId, GPUTexture>;
    private readonly samplers: Map<SamplerId, GPUSampler>;

    public readonly pipelines: Map<PipelineId, GPUPipelineBase>;
    public readonly bindGroups: Map<PipelineId, GPUBindGroup[]>;
    public readonly shaders: Map<PipelineId, Shader>;

    private readonly _device: GPUDevice;
    // @ts-ignore
    private depthTexture: GPUTexture;

    constructor(private gpuDevice: WebGPUDevice,
                private gpuContext: WebGPUContext,
                public props: PropertiesManager) {
        this._device = this.gpuDevice.gpuDevice;
        this.buffers = new Map();
        this.textures = new Map();
        this.samplers = new Map();
        this.pipelines = new Map();
        this.bindGroups = new Map();
        this.shaders = new Map();

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
                view: this.depthTexture.createView(),
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
                depthClearValue: 1.0,
            }
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

        return new WebGPURenderPass(passEncoder, commandEncoder, this);
    }

    initPipeline(shader: Shader): PipelineId {
        const device = this._device;
        const vertexShader = device.createShaderModule({
            label: 'vertexShader',
            code: shader.vertexShaderSource
        });
        const fragmentShader = device.createShaderModule({
            label: 'fragmentShader',
            code: shader.fragmentShaderSource
        });
        log.infoGroup('Shader', shader)

        const bindGroupLayouts: GPUBindGroupLayout[] = [];
        const gpuBindGroups: GPUBindGroup[] = [];
        for (let i = 0; i < shader.bindGroups.length; i++) {
            const { buffers, groupNumber, targetShader: visibility } = shader.bindGroups[i];
            const groupEntries: GPUBindGroupLayoutEntry[] = [];
            const bindingEntries: GPUBindGroupEntry[] = [];

            buffers.forEach(bufferInfo => {
                    const { type, name, id, bindNumber: binding } = bufferInfo;
                    if (type === 'uniform') {
                        const buffer = this.buffers.get(id) as GPUBuffer;
                        bindingEntries.push({
                            binding, resource: { buffer }
                        });
                        groupEntries.push({
                            binding, visibility,
                            buffer: { type: 'uniform' }
                        });
                    } else if (type === 'texture') {
                        const texture = this.textures.get(id) as GPUTexture;
                        bindingEntries.push({
                            binding, resource: texture.createView(),
                        })
                        groupEntries.push({
                            binding, visibility,
                            texture: { sampleType: 'float' }
                        });
                    } else if (type === 'sampler') {
                        const sampler = this.samplers.get(id) as GPUSampler;
                        bindingEntries.push({
                            binding, resource: sampler,
                        });
                        groupEntries.push({
                            binding, visibility,
                            sampler: {}
                        });
                    }
                }
            )

            log.infoGroup(`bind-group-layout-${groupNumber}`, groupEntries)
            log.infoGroup(`bind-group-${groupNumber}`, bindingEntries)

            const layoutDescriptor = device.createBindGroupLayout({
                label: `bind-group-layout-${groupNumber}`,
                entries: groupEntries
            });
            gpuBindGroups.push(device.createBindGroup({
                label: `bind-group-${groupNumber}`,
                layout: layoutDescriptor,
                entries: bindingEntries
            }));
            bindGroupLayouts.push(layoutDescriptor);
        }


        const layout = device.createPipelineLayout({ bindGroupLayouts });


        const buffers: GPUVertexBufferLayout[] = shader.vertexBuffers.map((vertexBuffer) => ({
            arrayStride: vertexBuffer.stride,
            attributes: vertexBuffer.layout.map(({ offset, format, location: shaderLocation }, i) => ({
                shaderLocation: i, format, offset
            }))
        }));

        const pipelineId = Symbol('pipeline');
        this.bindGroups.set(pipelineId, gpuBindGroups);
        this.shaders.set(pipelineId, shader);

        this.pipelines.set(pipelineId, device.createRenderPipeline({
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
                    },
                ],
            },
            primitive: {
                topology: this.props.getBoolean('wireframe') ? 'line-list' : 'triangle-list',
                // topology: 'triangle-list',
                frontFace: 'ccw',
                cullMode: 'back',
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less',
            },
        }));

        return pipelineId;
    }

    createBuffer(buffer: Buffer): BufferId {
        const bId = Symbol(`buffer_${buffer.name}`);
        const gpuBuffer = this._device.createBuffer({
            label: buffer.name,
            size: buffer.byteLength,
            usage: buffer.usage
        });

        this.buffers.set(bId, gpuBuffer);

        return bId;
    }

    createBufferWithData(buffer: Buffer, data: BufferData): BufferId {
        const bufferId = Symbol(`buffer_d_${buffer.name}`);
        const gpuBuffer = this._device.createBuffer({
            label: buffer.name,
            size: buffer.byteLength,
            usage: buffer.usage
        });
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
        });
    }

    public static async initWebGPU(canvas: Canvas, properties: PropertiesManager): Promise<WebGPUGraphics> {
        const context = canvas.getWebGpuContext();
        const adapter = await navigator?.gpu?.requestAdapter();

        if (!context || !adapter) {
            throw 'WebGPU is not supported';
        }

        const device = await adapter.requestDevice();
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
    constructor(private passEncoder: GPURenderPassEncoder,
                private commandEncoder: GPUCommandEncoder,
                private graphics: WebGPUGraphics) {
    }

    draw(pipelineId: symbol): RenderPass {
        const pipeline = this.graphics.pipelines.get(pipelineId) as GPURenderPipeline;
        const bindGroups = this.graphics.bindGroups.get(pipelineId) as GPUBindGroup[];
        const shader = this.graphics.shaders.get(pipelineId) as Shader;

        const { width, height } = this.graphics.props.getT<WindowProperties>('window');
        // this.passEncoder.setViewport(0, 0, width, height, 0.0, 1.0);
        this.passEncoder.setPipeline(pipeline)

        shader.vertexBuffers.forEach((vertexBuffer, index) => {
            this.passEncoder.setVertexBuffer(index, this.graphics.buffers.get(vertexBuffer.id) as GPUBuffer)
        })

        for (let i = 0; i < bindGroups.length; i++) {
            this.passEncoder.setBindGroup(i, bindGroups[i]);
        }

        const indexBuffer = shader.indexBuffer;
        if (indexBuffer) {
            const buffer = this.graphics.buffers.get(indexBuffer.id) as GPUBuffer;
            this.passEncoder.setIndexBuffer(buffer, 'uint32');
            this.passEncoder.drawIndexed(indexBuffer.indices, 1, 0, 0, 0);
        } else {
            this.passEncoder.draw(shader.vertexBuffers[0].vertexCount);
        }

        return this;
    }

    submit(): void {
        this.passEncoder.end();
        const commandBuffer = this.commandEncoder.finish();
        this.graphics.getDevice().gpuDevice.queue.submit([commandBuffer]);
    }

}