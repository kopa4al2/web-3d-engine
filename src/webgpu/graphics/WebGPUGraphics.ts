import Canvas from "Canvas";
import Graphics, {
    BindGroupId,
    BindGroupLayoutId,
    PipelineId,
    RenderPass,
    RenderPassDescriptor,
    UpdateTexture
} from "core/Graphics";
import PropertiesManager from "core/PropertiesManager";
import BindGroup, {
    BindGroupDynamicOffset,
    BindGroupEntry,
    BindGroupEntryType,
    TextureBindGroupEntry
} from "core/resources/BindGroup";
import BindGroupLayout from "core/resources/BindGroupLayout";
import { BufferData, BufferDescription, BufferId } from "core/resources/gpu/BufferDescription";
import { ShaderProgramDescription } from "core/resources/gpu/GpuShaderData";
import { SamplerStruct, ShaderStruct, TextureStruct } from "core/resources/shader/ShaderStruct";
import SamplingConfig from "core/texture/SamplingConfig";
import {
    ImageChannelRange,
    ImageWithData,
    SamplerId,
    TextureDescription,
    TextureId,
    TextureType
} from "core/texture/Texture";
import { vec3 } from 'gl-matrix';
import DebugUtil from '../../util/debug/DebugUtil';
import { NamedLogger } from "util/Logger";
import WebGPUContext from "webgpu/graphics/WebGPUContext";
import WebGPUDevice from "webgpu/graphics/WebGPUDevice";
import Globals from "../../engine/Globals";

export default class WebGPUGraphics implements Graphics {

    private static readonly logger: NamedLogger = new NamedLogger('WebGPUGraphics');

    public readonly buffers: WeakMap<BufferId, GPUBuffer>;
    private readonly textures: WeakMap<TextureId, GPUTexture>;
    private readonly samplers: WeakMap<SamplerId, GPUSampler>;

    public readonly pipelines: WeakMap<PipelineId, GPUPipelineBase>;
    public readonly bindGroups: WeakMap<PipelineId, GPUBindGroup>;
    public readonly shaderLayouts: WeakMap<BindGroupLayoutId, GPUBindGroupLayout>;

    private readonly _device: GPUDevice;

    private depthTexture?: GPUTexture;
    private currentTexture: GPUTexture;

    constructor(private gpuDevice: WebGPUDevice,
                private gpuContext: WebGPUContext,
                public props: PropertiesManager) {
        DebugUtil.addToWindowObject('gpuGraphics', this);
        this._device = this.gpuDevice.gpuDevice;

        this.buffers = new WeakMap();
        this.textures = new WeakMap();
        this.samplers = new WeakMap();
        this.pipelines = new WeakMap();
        this.bindGroups = new WeakMap();
        this.shaderLayouts = new WeakMap();

        this.initDepthTexture(props);
        this.currentTexture = this.gpuContext.ctx.getCurrentTexture();
        props.subscribeToAnyPropertyChange(['window.width', 'window.height'], this.initDepthTexture.bind(this));
    }

    beginRenderPass(descriptor?: RenderPassDescriptor): RenderPass {
        const device = this.gpuDevice.gpuDevice;
        const context = this.gpuContext.ctx;

        const commandEncoder = device.createCommandEncoder();

        if (!descriptor) {
            const renderPassDescriptor: GPURenderPassDescriptor = {
                label: 'Default render pass',
                colorAttachments: [{
                    // view: this.currentTexture.createView(),
                    view: context.getCurrentTexture().createView(),
                    clearValue: { r: 0.2, g: 0.2, b: 0.2, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                }],
                depthStencilAttachment: {
                    view: this.depthTexture!.createView(),
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store',
                    depthClearValue: 1.0,
                }
            };

            const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

            return new WebGPURenderPass(passEncoder, commandEncoder, this);
        }

        let colorAttachments: GPURenderPassColorAttachment[] = [];
        // TODO: Temporary if no color attachment present, add default one
        if (!descriptor.colorAttachment || !descriptor.colorAttachment.skip) {
            const colorTexture = descriptor.colorAttachment?.textureId
                ? this.textures.get(descriptor.colorAttachment.textureId)!
                // : this.currentTexture;
                : context.getCurrentTexture();

            const view = colorTexture.createView({
                aspect: descriptor.colorAttachment?.textureView?.aspect,
                baseArrayLayer: descriptor.colorAttachment?.textureView?.baseArrayLayer,
                dimension: descriptor.colorAttachment?.textureView?.dimension,
            });
            colorAttachments.push({
                view,
                clearValue: { r: 0.2, g: 0.2, b: 0.2, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            });
        }

        let depthStencilAttachment: GPURenderPassDepthStencilAttachment | undefined = undefined;
        if (!descriptor.depthAttachment.skip) {
            const depthTexture = descriptor.depthAttachment.textureId
                ? this.textures.get(descriptor.depthAttachment.textureId)!
                : this.depthTexture!;

            const view = depthTexture.createView({
                label: descriptor.label + '_depthAttachment',
                aspect: descriptor.depthAttachment.textureView?.aspect,
                baseArrayLayer: descriptor.depthAttachment.textureView?.baseArrayLayer,
                arrayLayerCount: 1,
                dimension: descriptor.depthAttachment.textureView?.dimension,
            })
            depthStencilAttachment = {
                view,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
                depthClearValue: 1.0,
            };
        }

        const renderPassDescriptor: GPURenderPassDescriptor = {
            label: descriptor.label,
            colorAttachments: colorAttachments,
            depthStencilAttachment: depthStencilAttachment
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        const viewport = descriptor.viewport || {};

        passEncoder.setViewport(
            viewport.x || 0,
            viewport.y || 0,
            viewport.width || this.props.getAbsolute('window.width'),
            viewport.height || this.props.getAbsolute('window.height'),
            0.1,
            1.0
        );
        return new WebGPURenderPass(passEncoder, commandEncoder, this);
    }

    initPipeline(shader: ShaderProgramDescription): PipelineId {
        const { options } = shader;
        const device = this._device;
        const vertexShader = device.createShaderModule({
            label: 'vertexShader',
            code: shader.vertexShaderSource
        });

        let fragment: GPUFragmentState | undefined = undefined;
        const targets: [GPUColorTargetState | null] = options.colorAttachment.disabled
            ? [null]
            : [
                {
                    // format: 'rgba16float',
                    // format: 'rgba8unorm',
                    // format: 'bgra8unorm',
                    format: options.colorAttachment.format,
                    blend: options.colorAttachment.blendMode,
                    writeMask: options.colorAttachment.writeMask === 'ALL'
                        ? GPUColorWrite.ALL
                        : GPUColorWrite.RED | GPUColorWrite.GREEN | GPUColorWrite.BLUE
                },
            ];
        if (shader.fragmentShaderSource) {
            fragment = {
                module: device.createShaderModule({
                    label: 'fragmentShader',
                    code: shader.fragmentShaderSource
                }),
                entryPoint: 'main',
                targets,
            };
        }

        const bindGroupLayouts = shader.shaderLayoutIds.map(id => this.shaderLayouts.get(id)!)
        const layout = device.createPipelineLayout({ bindGroupLayouts, label: `pipeline-layout-${ shader.label }` });

        const buffers: GPUVertexBufferLayout[] = [{
            arrayStride: shader.vertexShaderStride,
            attributes: shader.vertexShaderLayout.map(({ offset, format, location }, i) => ({
                shaderLocation: location || i, format, offset
            }))
        }];
        const pipelineId = Symbol(`webgpu-pipeline-${ shader.label }`);
        const depthStencil: GPUDepthStencilState | undefined = options.depthAttachment.disabled
            ? undefined
            : {
                format: options.depthAttachment.format,
                depthWriteEnabled: options.depthAttachment.depthWriteEnabled,
                depthCompare: options.depthAttachment.depthCompare,
            };

        
        this.pipelines.set(pipelineId, device.createRenderPipeline({
            label: `pipeline-${ shader.label }`,
            layout,
            vertex: {
                module: vertexShader,
                entryPoint: 'main',
                buffers,
            },
            fragment,
            primitive: {
                topology: options.drawMode,
                frontFace: 'ccw',
                // cullMode: 'none',
                cullMode: options.cullFace,
            },
            depthStencil,
        }));

        return pipelineId;
    }

    public createShaderLayout(layout: BindGroupLayout): BindGroupLayoutId {
        const id = Symbol(`webgpu-bind-group-layout-${ layout.label }`);
        const groupEntries: GPUBindGroupLayoutEntry[] = layout.entries
            .map(({
                      type,
                      binding,
                      visibilityMask: { mask: visibility },
                      dynamicOffset, ...rest
                  },
                  index) => ({
                binding: index,
                // binding: binding,
                visibility,
                ...generateBufferData(type, dynamicOffset, rest)
            }));

        function generateBufferData(type: BindGroupEntryType,
                                    hasDynamicOffset?: { size: number },
                                    rest?: Partial<ShaderStruct>): Partial<GPUBindGroupLayoutEntry> {
            switch (type) {
                case 'uniform':
                    return hasDynamicOffset
                        ? { buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: hasDynamicOffset.size } }
                        : { buffer: { type: 'uniform' } }
                case "texture-array":
                    return {
                        texture: {
                            viewDimension: '2d-array',
                            sampleType: (<TextureStruct>rest)?.sampleType || 'float'
                        }
                    };
                case "cube-texture":
                    return {
                        texture: {
                            viewDimension: 'cube',
                            sampleType: (<TextureStruct>rest)?.sampleType || 'float'
                        }
                    };
                case "texture":
                    return { texture: { sampleType: (<TextureStruct>rest)?.sampleType || 'float' } };
                case "sampler":
                    return { sampler: { type: (<SamplerStruct>rest).samplerType || 'filtering' } }
                case "storage":
                    return { buffer: { type: 'read-only-storage' } }
                default:
                    throw new Error('Unknown type: ' + type);

            }
        }

        this.shaderLayouts.set(id, this._device.createBindGroupLayout({
            label: `bind-group-layout-${ layout.label }`,
            entries: groupEntries,
        }));

        return id;
    }

    public createBindGroup(layoutId: BindGroupLayoutId, bindGroup: BindGroup): BindGroupId {
        const id = Symbol(`webgpu-bind-group-${ bindGroup.label }`);

        const bindingEntries: GPUBindGroupEntry[] = bindGroup.entries.map((bindGroupEntry, i) => ({
            binding: bindGroupEntry.binding,
            resource: getResourceByType(bindGroupEntry, this)
        }));

        function getResourceByType(entry: BindGroupEntry, _this: WebGPUGraphics): GPUBindingResource {
            switch (entry.type) {
                case 'uniform':
                    const { size } = (entry as BindGroupDynamicOffset);

                    return size
                        ? { buffer: _this.buffers.get(entry.bufferId)!, size }
                        : { buffer: _this.buffers.get(entry.bufferId)! }
                case 'storage':
                    return { buffer: _this.buffers.get(entry.bufferId)! }
                case 'texture':
                    return _this.textures.get(entry.bufferId)!.createView()
                case 'texture-array':
                    return _this.textures.get(entry.bufferId)!
                        .createView({
                            arrayLayerCount: (entry as TextureBindGroupEntry).depth,
                            dimension: '2d-array',
                            baseArrayLayer: 0
                        });
                case 'cube-texture':
                    return _this.textures.get(entry.bufferId)!.createView({ dimension: 'cube' });
                case 'sampler':
                    return _this.samplers.get(entry.bufferId)!
                default:
                    // @ts-ignore
                    throw new Error('Unknown type: ' + entry.type);
            }
        }

        this.bindGroups.set(id, this._device.createBindGroup({
            label: `bind-group-${ bindGroup.label }`,
            layout: this.shaderLayouts.get(layoutId)!,
            entries: bindingEntries
        }));

        return id;
    }

    createBuffer(buffer: BufferDescription): BufferId {
        const bId = Symbol(`buffer_${ buffer.label }`);
        const gpuBuffer = this._device.createBuffer({
            label: buffer.label,
            size: buffer.byteLength,
            usage: buffer.usage
        });

        this.buffers.set(bId, gpuBuffer);

        return bId;
    }

    createBufferWithData(buffer: BufferDescription, data: BufferData): BufferId {
        const bufferId = Symbol(`buffer_d_${ buffer.label }`);
        const gpuBuffer = this._device.createBuffer({
            label: buffer.label,
            size: buffer.byteLength,
            usage: buffer.usage,
        });
        this._device.queue.writeBuffer(gpuBuffer, 0, data, 0, data.length);

        this.buffers.set(bufferId, gpuBuffer);

        return bufferId;
    }

    createTexture(textureDescription: TextureDescription): TextureId {
        const textureId = Symbol(`texture-${ textureDescription.label || 'gpu' }`);

        const textureGpu = this._createWebGpuTexture(textureDescription);
        if ((<ImageWithData>textureDescription.image).imageData) {
            this.updateTexture(textureId, { data: textureDescription.image as ImageWithData, x: 0, y: 0, z: 0 })
        }

        this.textures.set(textureId, textureGpu);

        return textureId;
    }

    private _createWebGpuTexture(textureDescription: TextureDescription): GPUTexture {
        const { image } = textureDescription;
        if (textureDescription.type === TextureType.TEXTURE_ARRAY
            || textureDescription.type === TextureType.CUBE_MAP) {
            return this._device.createTexture({
                label: textureDescription.label,
                size: {
                    width: image.width,
                    height: image.height,
                    depthOrArrayLayers: textureDescription.depth
                },
                dimension: '2d',
                format: image.channel.format,
                usage: textureDescription.usage,
            });
        } else if (textureDescription.type === TextureType.TEXTURE_2D) {
            return this._device.createTexture({
                size: { width: image.width, height: image.height },
                dimension: '2d', format: image.channel.format,
                usage: textureDescription.usage
            })
        }

        console.error('Texture: ', textureDescription);
        // @ts-ignore
        throw new Error(`Unknown type: ${ textureDescription.type }`)
    }

    createSampler(sampler: SamplingConfig): SamplerId {
        const samplerId = Symbol(`${ sampler }-webgpu-sampler`);
        this.samplers.set(samplerId, this._device.createSampler({
            label: sampler.label,
            mipmapFilter: sampler.mipmapFilter,
            magFilter: sampler.magFilter,
            minFilter: sampler.minFilter,
            addressModeU: sampler.addressModeU,
            addressModeV: sampler.addressModeV,
            addressModeW: sampler.addressModeW,
            compare: sampler.compare
        }));

        return samplerId;
    }

    writeToBuffer(buffer: BufferId, data: BufferData, bufferOffset: number = 0, dataOffset: number = 0, dataToWriteSize: number = data.length) {
        const bfr = this.buffers.get(buffer) as GPUBuffer;
        this._device.queue.writeBuffer(bfr, bufferOffset, data, dataOffset, dataToWriteSize)
    }


    public updateTexture(textureId: TextureId, updateTexture: UpdateTexture) {
        const texture = this.textures.get(textureId)!;
        const {
            data: { width, height, channel, imageData },
            dataOffset = 0, x, y, z
        } = updateTexture;

        if (imageData instanceof ImageBitmap) {
            this._device.queue.copyExternalImageToTexture(
                { source: imageData }, // The ImageBitmap
                {
                    texture,
                    origin: { x, y, z },
                },
                [imageData.width, imageData.height, 1]
            );
            return;
        }
        const bytesPerPixel = ImageChannelRange[channel.dataType];
        const bytesPerRow = width * bytesPerPixel;
        // console.groupCollapsed('Update texture: ', textureId.toString())
        // console.log('Width ', width, ' bytes per pixel: ', bytesPerPixel);
        // console.log('Bytes per row', bytesPerRow);
        // console.log('texture: ', texture);
        // console.log('Request: ', updateTexture);
        // console.groupEnd()
        this._device.queue.writeTexture(
            { texture, mipLevel: 0, origin: { x, y, z }, },
            imageData,
            { bytesPerRow: bytesPerRow, rowsPerImage: height, offset: dataOffset },
            [width, height, 1]);
    }

    // public writeToTexture(textureId: TextureId,
    //                       imageData: ImageData,
    //                       origin: vec3 = vec3.create(),
    //                       sourceWidth: number = imageData.width,
    //                       sourceHeight: number = imageData.height
    // ): void {
    //     const texture = this.textures.get(textureId)!;
    //     const bytesPerRow = sourceWidth * 4;
    //     // console.groupCollapsed(textureId.toString())
    //     // console.log('imageData: ', imageData, imageData.data, imageData.data.buffer)
    //     // console.log('texture: ', texture)
    //     // console.log('origin: ', origin)
    //     // console.log('Bytes per row: ', bytesPerRow)
    //     // console.log('rows per image: ', sourceHeight)
    //     // console.log('Multiplied: ', bytesPerRow * sourceHeight)
    //     // console.log('Image size : ', imageData.width, imageData.height)
    //     // // console.log('Data array size : ', imageDataArray.length)
    //     // console.groupEnd()
    //     const imageDataArray = new Uint8ClampedArray(imageData.data, 0, bytesPerRow * sourceHeight);
    //     this._device.queue.writeTexture({
    //             texture,
    //             mipLevel: 0,
    //             origin: { x: origin[0], y: origin[1], z: origin[2] },
    //         },
    //         // imageData.data,
    //         imageDataArray,
    //         {
    //             // width * 4 bytes per pixel for RGBA8
    //             bytesPerRow: bytesPerRow,
    //             rowsPerImage: sourceHeight,
    //         },
    //         {
    //             width: sourceWidth,
    //             height: sourceHeight,
    //             depthOrArrayLayers: 1,
    //         });
    // }


    getDevice(): WebGPUDevice {
        return this.gpuDevice;
    }

    private initDepthTexture(properties: PropertiesManager) {
        const width = <number>properties.getAbsolute('window.width');
        const height = <number>properties.getAbsolute('window.height');

        if (width === 0 || height === 0) {
            this.depthTexture?.destroy();
            this.depthTexture = undefined;
            console.warn('destroying depth texture')
            return;
        }

        this.depthTexture = this._device.createTexture({
            size: [width, height, 1],
            format: Globals.DEFAULT_DEPTH_FORMAT,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    public static async initWebGPU(canvas: Canvas, properties: PropertiesManager): Promise<WebGPUGraphics> {
        const context = canvas.getWebGpuContext();
        const adapter = await navigator?.gpu?.requestAdapter({ powerPreference: 'high-performance' });

        if (!context || !adapter) {
            throw new Error('WebGPU is not supported');
        }

        const device = await adapter.requestDevice({ requiredLimits: { maxBindGroups: 4 } });
        
        console.groupCollapsed('WebGPU Adapter info')
        console.log(adapter)
        console.log(device)
        console.table(adapter.limits)
        console.log('Prefered canvas format: ', navigator.gpu.getPreferredCanvasFormat())
        console.groupEnd();

        // const swapChainFormat = 'rgba16float';
        const swapChainFormat = 'bgra8unorm';
        context.configure({
            device: device,
            format: swapChainFormat,
            alphaMode: 'premultiplied'
        });


        return new WebGPUGraphics(new WebGPUDevice(device), new WebGPUContext(context), properties);
    }

    public _rawApi(): GPUDevice {
        return this._device;
    }

    // _getTextureData(textureId: TextureId, bufferId?: BufferId): Promise<Float32Array> {
    _getTextureData(textureId: TextureId, bufferId?: BufferId): Promise<ArrayBuffer> {
        const texture = this.textures.get(textureId)!;
        const buffer = this.buffers.get(bufferId!)!;
        buffer.unmap();

        const commandEncoder = this._device.createCommandEncoder();
        commandEncoder.copyTextureToBuffer(
            {
                texture,
                aspect: 'depth-only',
            },
            {
                buffer,
                bytesPerRow: texture.width * Float32Array.BYTES_PER_ELEMENT,
            },
            [texture.width, texture.height, 1]
        );

        this._device.queue.submit([commandEncoder.finish()]);
        //  I was waiting for this too , this._device.queue.onSubmittedWorkDone()
        return buffer.mapAsync(GPUMapMode.READ).then(() => buffer.getMappedRange());
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

    public setVertexBuffer(slot: number, vertexBufferId: BufferId): RenderPass {
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

    public drawSimple(indices: number): RenderPass {
        this.passEncoder.draw(indices);
        return this;
    }

    submit(): void {
        this.passEncoder.end();
        const commandBuffer = this.commandEncoder.finish();
        this.graphics.getDevice().gpuDevice.queue.submit([commandBuffer]);
    }

}
