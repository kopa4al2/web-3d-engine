import Mesh from "../core/components/Mesh";
import ShaderProgram from "../core/shaders/ShaderProgram";
import Texture from "../core/texture/Texture";

export default class WebGPUShaderProgramOld extends ShaderProgram {

    public pipeline: GPURenderPipeline;
    public mvpBindGroup: GPUBindGroup;
    public colorBindGroup: GPUBindGroup;
    public mvpBuffer: GPUBuffer;
    public colorBuffer: GPUBuffer;
    public vertexBuffer: GPUBuffer;

    constructor(private device: GPUDevice,
                private shaderSource: string,
                private vertexShaderSource: string,
                private fragmentShaderSource: string,
                private texture: Texture) {
        super(vertexShaderSource, fragmentShaderSource);
        this.device = device;
        const img = texture.imageData;

        const vertexShader = device.createShaderModule({
            code: vertexShaderSource
        })
        const fragmentShader = device.createShaderModule({
            code: fragmentShaderSource
        })

        // const shaderModule = device.createShaderModule({
        //     code: shaderSource
        // });

        const vertexShaderGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' },
                },
            ],
        });

        const fragmentShaderGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float' },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {},
                },
            ],
        });

        const textureGpu = this.device.createTexture({
            size: [img.width, img.height],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING
                | GPUTextureUsage.COPY_DST
                | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        // const commandEncoder = this.device.createCommandEncoder();
        this.device.queue.copyExternalImageToTexture(
            { source: img },
            { texture: textureGpu },
            [img.width, img.height]
        );

        // const commandBuffer = commandEncoder.finish();
        // this.device.queue.submit([commandBuffer]);

        const sampler = this.device.createSampler({
            magFilter: 'linear',  // Linear filtering for magnification
            minFilter: 'linear',  // Linear filtering for minification
            addressModeU: 'repeat',  // Repeat the texture in the U direction
            addressModeV: 'repeat',  // Repeat the texture in the V direction
        });

        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [vertexShaderGroupLayout, fragmentShaderGroupLayout],
        });


        const mvpBuffer = device.createBuffer({
            size: 64, // Size for a 4x4 matrix (16 floats * 4 bytes)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        const vertexBindGroup = device.createBindGroup({
            layout: vertexShaderGroupLayout,
            entries: [{
                binding: 0,
                resource: {
                    buffer: mvpBuffer
                }
            }]
        })

        const colorBuffer = device.createBuffer({
            size: 16, // Size for a vec4 (4 floats * 4 bytes)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        const colorBindGroup = device.createBindGroup({
            layout: fragmentShaderGroupLayout,
            entries: [{
                binding: 0,
                resource: { buffer: colorBuffer }
            }, {
                binding: 1,
                resource: textureGpu.createView(),
            }, {
                binding: 2,
                resource: sampler,
            }]
        })

        this.pipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                // module: shaderModule,
                // entryPoint: 'vertex_main',
                module: vertexShader,
                entryPoint: 'main',
                buffers: [
                    {
                        arrayStride: 4 * (3 + 2), // 3 floats per vertex + 2 per texture
                        attributes: [
                            { shaderLocation: 0, format: 'float32x3', offset: 0, },
                            { shaderLocation: 1, format: 'float32x2', offset: 4 * 3 }
                        ],
                    },
                ],
            },
            fragment: {
                // module: shaderModule,
                // entryPoint: 'fragment_main',
                module: fragmentShader,
                entryPoint: 'main',
                targets: [
                    {
                        format: 'bgra8unorm',
                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back',
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less',
            },
        });

        this.colorBindGroup = colorBindGroup;
        this.mvpBindGroup = vertexBindGroup;
        this.mvpBuffer = mvpBuffer;
        this.colorBuffer = colorBuffer;
        this.vertexBuffer = device.createBuffer({
            label: 'VertexBuffer',
            size: 0, //cubeGeometry.vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
    }

    public link(): void {
        // WebGPU doesn't have a "link" like WebGL, but pipeline setup is done in constructor
    }

    public bind(): void {
        // Binding is handled within the render pass, so this method would not directly bind
        // Instead, you'll use this.bindGroup during render pass in Renderer
    }

    public unbind(): void {
        // WebGPU manages state binding within render passes, no need for explicit unbind
    }

    public setUniform(name: string, value: Float32Array): void {
        // You need to copy data to the uniform buffer
        // this.device.queue.writeBuffer(this.uniformBuffer, 0, value);
    }

    public setAttributeLocation(name: string, buffer: WebGLBuffer, size: number, type?: number | undefined): void {
        throw new Error("Method not implemented.");
    }


    visit(mesh: Mesh) {
    }
}