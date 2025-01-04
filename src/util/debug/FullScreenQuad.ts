import Graphics, { BindGroupId, PipelineId } from "core/Graphics";
import { VertexLayoutEntry } from "core/resources/cpu/CpuShaderData";
import { BufferFormat, BufferId, BufferUsage } from "core/resources/gpu/BufferDescription";
import { DEFAULT_PIPELINE_OPTIONS, UniformVisibility } from "core/resources/gpu/GpuShaderData";
import ResourceManager from "core/resources/ResourceManager";
import { createStruct } from "core/resources/shader/DefaultBindGroupLayouts";
import { mat4, vec3 } from "gl-matrix";
import WebGLGraphics from "../../webgl/WebGLGraphics";

export default class FullScreenQuad {
    private quadVertices = new Float32Array([
        // X, Y, Z
        -0.5, -0.5, 0.0, // Bottom-left
        0.5, -0.5, 0.0, // Bottom-right
        -0.5, 0.5, 0.0, // Top-left
        0.5, 0.5, 0.0  // Top-right
    ]);
    private quadIndices = new Uint16Array([
        0, 1, 2, // First triangle
        2, 1, 3  // Second triangle
    ]);
    private readonly vertexBuffer: BufferId;
    // private readonly indexBuffer: BufferId;
    private readonly screenBg: BindGroupId;
    private readonly screenBfr: BufferId;
    private readonly pipeline: PipelineId;


    constructor(private graphics: Graphics, private resourceManager: ResourceManager) {
        const [screenLayout, screenBg, screenBfr] = this.buildScreenLayout();
        this.vertexBuffer = resourceManager.createBuffer({
            usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
            byteLength: this.quadVertices.byteLength,
            vertexLayout: {
                stride: 12,
                entries: [{ elementsPerVertex: 3, dataType: 'float32' }]
            }
        }, this.quadVertices);
        // this.indexBuffer = resourceManager.createBuffer({
        //     usage: BufferUsage.INDEX | BufferUsage.COPY_DST,
        //     byteLength: this.quadIndices.byteLength
        // }, this.quadIndices);

        this.pipeline = this.graphics.initPipeline({
            label: 'Full screen quad',
            options: {
                ...DEFAULT_PIPELINE_OPTIONS,
                drawMode: 'triangle-strip',
            },
            fragmentShaderSource: this.getFragmentShader(),
            shaderLayoutIds: [screenLayout],
            vertexShaderLayout: [{ offset: 0, format: BufferFormat.FLOAT32x3, location: 0 }],
            vertexShaderSource: this.getVertexShader(),
            vertexShaderStride: 12
        });

        this.screenBg = screenBg;
        this.screenBfr = screenBfr;
    }

    public prepare() {

    }

    public draw(mvp: mat4) {

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const screenAspect = screenWidth / screenHeight;
        const viewMat = mat4.lookAt(mat4.create(), vec3.fromValues(0, 0, -1), vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
        const vp = mat4.multiply(mvp, viewMat, mvp);
        mat4.multiply(vp, vp, mat4.create());
        this.graphics.writeToBuffer(this.screenBfr, mat4.create() as Float32Array);
        this.graphics.writeToBuffer(this.screenBfr, new Float32Array([screenWidth, screenHeight, screenAspect]));
        const renderPass = this.graphics.beginRenderPass();

        renderPass.usePipeline(this.pipeline);
        renderPass.setVertexBuffer(0, this.vertexBuffer);
        renderPass.setBindGroup(0, this.screenBg);
        renderPass.drawSimple(4);
        renderPass.submit();
    }

    private buildScreenLayout() {
        const layout = this.resourceManager.getOrCreateLayout({
            label: 'fullScreenQuad', entries: [
                createStruct('screen', 'uniform', 0, UniformVisibility.VERTEX | UniformVisibility.FRAGMENT)
            ]
        });
        const bufferId = this.resourceManager.createBuffer({
            byteLength: 96, usage: BufferUsage.COPY_DST | BufferUsage.UNIFORM
        });
        const bindGroup = this.resourceManager.createBindGroup(layout, {
            label: 'ShadowPassBindGroup',
            entries: [{
                type: 'uniform',
                bufferId,
                binding: 0,
                name: 'full-screen-quad',
            },
            ]
        });
        return [layout, bindGroup, bufferId];
    }

    private getScreenStruct() {
        return `
            struct Screen {
                mvp: mat4x4<f32>,
                width: f32,
                height: f32,
                aspect: f32,
            }
        `
    }

    private getVertexShader() {
        if (this.graphics instanceof WebGLGraphics) {
            return `#version 300 es

                layout(location = 0) in vec3 aVertexPosition;
                layout(location = 1) in vec2 textureUV;
                    
                uniform mat4 lightViewProjMatrix;
                uniform mat4 modelMatrix;
                    
                    
                void main() {
                    gl_Position = lightViewProjMatrix * modelMatrix * vec4(aVertexPosition, 1.0);
                }`;
        }
        return `
            ${this.getScreenStruct()}
            @group(0) @binding(0) var<uniform> screen: Screen;

            @vertex
            fn main(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
                // Return the clip-space position
                //return vec4<f32>(position, 1.0);
                return screen.mvp * vec4<f32>(position, 1.0);
            }
        `;
    }

    private getFragmentShader() {
        if (this.graphics instanceof WebGLGraphics) {
            return undefined;
        }
        return `
                ${this.getScreenStruct()}
                @group(0) @binding(0) var<uniform> screen: Screen;
                    
                @fragment
                fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
                    // Screen-space coordinates
                    let screenWidth = screen.width;
                    let screenHeight = screen.height;
                    let screenAspect = screen.aspect;
                    let screenUV = fragCoord.xy / vec2<f32>(screenWidth, screenHeight);
                
                    // Unproject screen-space position to world space
                    let nearPos = vec3<f32>(
                        (screenUV.x - 0.5) * screenAspect,
                        screenUV.y - 0.5,
                        -1.0 // Near plane Z
                    );
                    let rayDir = normalize(nearPos);
                
                    ${''
            // Compute ray origin and direction in world space
            //         let rayOrigin = cameraPosition;
            //         let rayDirection = (inverseViewMatrix * vec4<f32>(rayDir, 0.0)).xyz;

            // Perform ray-cone intersection
            // if (rayConeIntersection(rayOrigin, rayDirection, spotlightPosition, spotlightDirection, spotlightOuterCutoff, spotlightRange)) {
            //     return vec4<f32>(1.0, 1.0, 0.0, 1.0); // Visualize cone as yellow
            // }
        }
                
                    return vec4<f32>(1.0, 1.0, 0.0, 1.0); // Visualize cone as yellow
}`;
    }
}