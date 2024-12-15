import Canvas from "Canvas";
import Graphics, { BindGroupId, BindGroupLayoutId, PipelineId, RenderPass, UpdateTexture } from "core/Graphics";
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
import SamplingConfig from "core/texture/SamplingConfig";
import {
    GlFace,
    ImageChannelRange,
    ImageWithData,
    SamplerId,
    TextureDescription,
    TextureId,
    TextureType
} from "core/texture/Texture";
import { vec3 } from 'gl-matrix';
import DebugUtil from 'util/DebugUtil';
import { NamedLogger } from "util/Logger";
import WebGPUContext from "webgpu/graphics/WebGPUContext";
import WebGPUDevice from "webgpu/graphics/WebGPUDevice";

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
                    clearValue: { r: 0.2, g: 0.2, b: 0.2, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
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
        const layout = device.createPipelineLayout({ bindGroupLayouts, label: `pipeline-layout-${ shader.label }` });

        const buffers: GPUVertexBufferLayout[] = [{
            arrayStride: shader.vertexShaderStride,
            attributes: shader.vertexShaderLayout.map(({ offset, format, location }, i) => ({
                shaderLocation: location || i, format, offset
            }))
        }];
        const pipelineId = Symbol(`webgpu-pipeline-${ shader.label }`);
        this.pipelines.set(pipelineId, device.createRenderPipeline({
            label: `pipeline-${ shader.label }`,
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
                        // format: 'rgba16float',
                        // format: 'rgba8unorm',
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
                // cullMode: 'none',
                cullMode: shader.options.cullFace,
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: shader.options.depthWriteEnabled,
                depthCompare: shader.options.depthCompare,
            },
        }));
        // console.log(`Cullface: ${shader.options.cullFace} TOPOLOGY for ${shader.label}: `, (this.props.getBoolean('wireframe') || shader.options.wireframe) ? 'line-list' : 'triangle-list')
        return pipelineId;
    }

    public createShaderLayout(layout: BindGroupLayout): BindGroupLayoutId {
        const id = Symbol(`webgpu-bind-group-layout-${ layout.label }`);
        const groupEntries: GPUBindGroupLayoutEntry[] = layout.entries
            .map(({ type, binding, visibilityMask: { mask: visibility }, dynamicOffset }, index) => ({
                binding: index,
                // binding: binding,
                visibility,
                ...generateBufferData(type, dynamicOffset)
            }));

        function generateBufferData(type: BindGroupEntryType,
                                    hasDynamicOffset?: { size: number }): Partial<GPUBindGroupLayoutEntry> {
            switch (type) {
                case 'uniform':
                    return hasDynamicOffset
                        ? { buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: hasDynamicOffset.size } }
                        : { buffer: { type: 'uniform' } }
                case "texture-array":
                    return { texture: { viewDimension: '2d-array', sampleType: 'float' } };
                case "cube-texture":
                    return { texture: { viewDimension: 'cube', sampleType: 'float' } };
                case "texture":
                    return { texture: { sampleType: 'float' } };
                case "sampler":
                    return { sampler: {} }
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
                size: {
                    width: image.width,
                    height: image.height,
                    depthOrArrayLayers: textureDescription.depth
                },
                dimension: '2d',
                format: image.channel.format,
                usage: textureDescription.usage,
            });
        }

        console.error('Texture: ', textureDescription);
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

    public writeToTexture(textureId: TextureId,
                          imageData: ImageData,
                          origin: vec3 = vec3.create(),
                          sourceWidth: number = imageData.width,
                          sourceHeight: number = imageData.height
    ): void {
        const texture = this.textures.get(textureId)!;
        const bytesPerRow = sourceWidth * 4;
        // console.groupCollapsed(textureId.toString())
        // console.log('imageData: ', imageData, imageData.data, imageData.data.buffer)
        // console.log('texture: ', texture)
        // console.log('origin: ', origin)
        // console.log('Bytes per row: ', bytesPerRow)
        // console.log('rows per image: ', sourceHeight)
        // console.log('Multiplied: ', bytesPerRow * sourceHeight)
        // console.log('Image size : ', imageData.width, imageData.height)
        // // console.log('Data array size : ', imageDataArray.length)
        // console.groupEnd()
        const imageDataArray = new Uint8ClampedArray(imageData.data, 0, bytesPerRow * sourceHeight);
        this._device.queue.writeTexture({
                texture,
                mipLevel: 0,
                origin: { x: origin[0], y: origin[1], z: origin[2] },
            },
            // imageData.data,
            imageDataArray,
            {
                // width * 4 bytes per pixel for RGBA8
                bytesPerRow: bytesPerRow,
                rowsPerImage: sourceHeight,
            },
            {
                width: sourceWidth,
                height: sourceHeight,
                depthOrArrayLayers: 1,
            });
    }


    getDevice(): WebGPUDevice {
        return this.gpuDevice;
    }

    private initDepthTexture(properties: PropertiesManager) {
        const width = <number>properties.getAbsolute('window.width');
        const height = <number>properties.getAbsolute('window.height');
        console.log('GPU dimensions updated', width, height);
        if (width === 0 || height === 0) {
            this.depthTexture?.destroy();
            this.depthTexture = undefined;
            return;
        }
        //
        // if (!this.depthTexture || this.depthTexture.width !== width || this.depthTexture.height !== height) {
        //     if (this.depthTexture) {
        //         this.depthTexture.destroy();
        //     }
        // }

        this.depthTexture = this._device.createTexture({
            size: [width, height, 1],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    public static async initWebGPU(canvas: Canvas, properties: PropertiesManager): Promise<WebGPUGraphics> {
        const context = canvas.getWebGpuContext();
        const adapter = await navigator?.gpu?.requestAdapter({ powerPreference: 'high-performance' });

        if (!context || !adapter) {
            throw 'WebGPU is not supported';
        }

        const device = await adapter.requestDevice({ requiredLimits: { maxBindGroups: 4 } });

        device.onuncapturederror = (error) => {
            // alert('web gpu error')
            // console.error("WebGPU Error:", error);
        };
        console.groupCollapsed('WebGPU Adapter limits')
        console.table(adapter.limits)
        console.log('Prefered canvas format: ', navigator.gpu.getPreferredCanvasFormat())
        console.groupEnd();

        // const swapChainFormat = 'rgba16float';
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

    public _rawApi(): GPUDevice {
        return this._device;
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

// RE CREATE DEPTH TEXTURE
/*

if (!depthTexture ||
        depthTexture.width !== canvasTexture.width ||
        depthTexture.height !== canvasTexture.height) {
      if (depthTexture) {
        depthTexture.destroy();
      }
      depthTexture = device.createTexture({
        size: [canvasTexture.width, canvasTexture.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }
 */
