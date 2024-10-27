import Canvas from "Canvas";
import { Buffer, BufferData, BufferFormat, BufferId } from "core/buffer/Buffer";
import Graphics, { BindGroupId, DrawMode, PipelineId, RenderPass, UniformGroupId } from "core/Graphics";
import PropertiesManager from "core/PropertiesManager";
import { BindGroup, GPUShader, PipelineProperties, UniformGroup } from "core/shaders/GPUShader";
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
    public readonly bindGroupLayouts: Map<UniformGroupId, GPUBindGroupLayout>;
    public readonly bindGroups: Map<BindGroupId, GPUBindGroup>;
    public readonly shaders: Map<PipelineId, GPUShader>;

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
        this.bindGroupLayouts = new Map();
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

    initPipeline(props: PipelineProperties, pipelineLayout: UniformGroupId[], name: string = 'unnamed'): PipelineId {
        const device = this._device;
        const vertexShader = device.createShaderModule({
            label: 'vertexShader',
            code: props.vertexShaderSource
        });
        const fragmentShader = device.createShaderModule({
            label: 'fragmentShader',
            code: props.fragmentShaderSource
        });

        const layout = device.createPipelineLayout({
            bindGroupLayouts: pipelineLayout.map(id => this.bindGroupLayouts.get(id)!)
        });

        const vertexShaderLayout = props.vertexShaderLayout;
        const attributes: GPUVertexAttribute[] = [];
        let lastEl = 0, lastOffset = 0, arrayStride = 0;
        for (let index = 0; index < vertexShaderLayout.length; index++) {
            const vertexLayout = vertexShaderLayout[index];
            lastOffset = lastOffset + Float32Array.BYTES_PER_ELEMENT * lastEl;
            attributes.push({
                shaderLocation: index,
                format: `${vertexLayout.dataType}x${vertexLayout.elementsPerVertex}` as BufferFormat,
                offset: lastOffset + Float32Array.BYTES_PER_ELEMENT * lastEl
            });
            lastEl = vertexLayout.elementsPerVertex;
            arrayStride += vertexLayout.elementsPerVertex;
        }
        arrayStride *= Float32Array.BYTES_PER_ELEMENT;

        const pipelineId = Symbol(`${name}-pipeline`);
        this.pipelines.set(pipelineId, device.createRenderPipeline({
            layout,
            vertex: {
                module: vertexShader,
                entryPoint: 'main',
                buffers: [{ arrayStride, attributes }], //TODO: For now only a single vertex buffer is supported
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
                topology: props.topology === DrawMode.WIREFRAME ? 'line-list' : 'triangle-list',
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

    createShaderGroup(group: UniformGroup): UniformGroupId {
        const { shaderUniformGroup: { layout, name }, binding } = group;
        const groupEntries: GPUBindGroupLayoutEntry[] = [];

        for (let globalUniform of layout) {
            const { type, visibility } = globalUniform;
            if (type === 'uniform') {
                groupEntries.push({
                    binding, visibility,
                    buffer: { type: 'uniform' }
                });
            } else if (type === 'texture') {
                groupEntries.push({
                    binding, visibility,
                    texture: { sampleType: 'float' }
                });
            } else if (type === 'sampler') {
                groupEntries.push({
                    binding, visibility,
                    sampler: {}
                });
            }
        }

        const layoutId = Symbol(`${name}-shader-layout`);
        const layoutDescriptor = this._device.createBindGroupLayout({
            label: `group-layout-${name}-${binding}`,
            entries: groupEntries
        });
        this.bindGroupLayouts.set(layoutId, layoutDescriptor);

        return layoutId;
    }


    createBindGroup(layoutId: UniformGroupId, groups: BindGroup[]): BindGroupId {
        const layout = this.bindGroupLayouts.get(layoutId)!;
        const groupId = Symbol(`bind-group-${layout.label}`)
        const bindingEntries: GPUBindGroupEntry[] = [];

        for (let group of groups) {
            const { type, binding, buffer: id } = group;
            if (type === 'uniform') {
                const buffer = this.buffers.get(id) as GPUBuffer;
                bindingEntries.push({
                    binding, resource: { buffer }
                });
            } else if (type === 'texture') {
                const texture = this.textures.get(id) as GPUTexture;
                bindingEntries.push({
                    binding, resource: texture.createView(),
                })

            } else if (type === 'sampler') {
                const sampler = this.samplers.get(id) as GPUSampler;
                bindingEntries.push({
                    binding, resource: sampler,
                });
            }
        }

        this.bindGroups.set(groupId, this._device.createBindGroup({
            label: `bind-group-${layout.label}`,
            layout,
            entries: bindingEntries
        }));

        return groupId;
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
            usage: buffer.usage,
            mappedAtCreation: true,
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

    setPipeline(pipelineId: symbol): RenderPass {
        this.passEncoder.setPipeline(this.graphics.pipelines.get(pipelineId) as GPURenderPipeline);

        return this;
    }

    setVertexBuffer(index: number, id: BufferId): RenderPass {
        this.passEncoder.setVertexBuffer(index, this.graphics.buffers.get(id)!)

        return this;
    }

    setIndexBuffer(id: BufferId): RenderPass {
        this.passEncoder.setIndexBuffer(this.graphics.buffers.get(id)!, 'uint32');

        return this;
    }

    bindGroup(index: number, bindGroup: BindGroupId): RenderPass {
        this.passEncoder.setBindGroup(index, this.graphics.bindGroups.get(bindGroup)!);

        return this;
    }

    draw(drawMode: DrawMode, count: number): RenderPass {
        if (drawMode === DrawMode.INDEX) {
            this.passEncoder.drawIndexed(count, 1, 0, 0, 0);
        } else {
            this.passEncoder.draw(count);
        }

        return this;
    }

    submit(): void {
        this.passEncoder.end();
        const commandBuffer = this.commandEncoder.finish();
        this.graphics.getDevice().gpuDevice.queue.submit([commandBuffer]);
    }

}