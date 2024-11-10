import Graphics, { BindGroupId, BindGroupLayoutGroupId, PipelineId, RenderPass, VertexBufferId } from "core/Graphics";
import PropertiesManager from "core/PropertiesManager";
import {
    BufferData,
    BufferDescription,
    BufferId,
    BufferUsage,
    TextureData
} from "core/resources/gpu/BufferDescription";
import {
    BindGroupEntry,
    BindGroupLayout,
    ShaderProgramDescription,
    VertexBufferLayout
} from "core/resources/gpu/GpuShaderData";
import { SamplerId, TextureId } from "core/texture/Texture";
import DebugUtil from 'util/DebugUtil';
import { rateLimitedLog } from 'util/Logger';
import ThrottleUtil from 'util/ThrottleUtil';
import { BlendModeConverter } from 'webgl/BlendModeConverter';
import Canvas from "../Canvas";

const idGenerator = (() => {
    let id = 0;
    return () => {
        return id++;
    }
})();

interface DeferredVao {
    getVao(buffer: WebGLBuffer): WebGLVertexArrayObject
}

export default class WebGLGraphics implements Graphics {
    readonly glContext: WebGL2RenderingContext;

    public readonly instancedBuffers: Record<TextureId, WebGLTexture>
    public readonly vertexArrayObjects: Record<VertexBufferId, WebGLVertexArrayObject>;
    public readonly bindGroups: Record<BindGroupId, BindGroupEntry[]>;
    public readonly uniformBlockIndices: Record<string, number>; // ubo name - block index
    public readonly textureBindGroups: Record<string, GLenum>; // texture name - texture unit gl.TEXTURE0 ++

    public readonly buffers: Map<BufferId, WebGlBufferInfo>;
    public readonly textures: Map<TextureId, WebGLTexture>;

    private readonly bindGroupLayouts: Record<BindGroupLayoutGroupId, BindGroupEntry[]>

    public readonly pipelines: Map<PipelineId, WebGlPipelineInfo>;


    constructor(canvas: Canvas, private props: PropertiesManager) {
        DebugUtil.addToWindowObject('glGraphics', this);
        const gl = canvas.getWebGl2Context();

        this.bindGroupLayouts = {};

        this.instancedBuffers = {};
        this.uniformBlockIndices = {};
        this.textureBindGroups = {};
        this.vertexArrayObjects = {};
        this.bindGroups = {};

        this.buffers = new Map();
        this.textures = new Map();
        this.pipelines = new Map();


        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.depthFunc(gl.LESS);
        gl.cullFace(gl.BACK);
        gl.frontFace(gl.CCW)
        // gl.disable(gl.CULL_FACE)

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        props.subscribeToAnyPropertyChange(['window.width', 'window.height'],
            () => gl.viewport(0, 0, props.get<number>('window.width'), props.get<number>('window.height')));
        this.glContext = gl;
    }

    public initPipeline(shader: ShaderProgramDescription): PipelineId {
        const pipelineId = Symbol(`WebGl2Pipeline-${shader.label}`);
        const gl = this.glContext;
        const shaderProgram = gl.createProgram() as WebGLProgram;

        gl.attachShader(shaderProgram, this.loadShader(gl.VERTEX_SHADER, shader.vertexShaderSource));
        gl.attachShader(shaderProgram, this.loadShader(gl.FRAGMENT_SHADER, shader.fragmentShaderSource));
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            alert(
                `Unable to initialize the shader program: ${gl.getProgramInfoLog(shaderProgram)}`,
            );
            console.error(gl.getProgramInfoLog(shaderProgram));
            throw "Error creating the shader program";
        }

        shader.shaderLayoutIds.forEach(bindGroupLayoutId => {
            gl.useProgram(shaderProgram);
            this._createBindGroups(gl, shaderProgram, this.bindGroupLayouts[bindGroupLayoutId]);
        });

        this.pipelines.set(pipelineId, { shaderProgram, shaderDescription: shader });

        return pipelineId;
    }

    public createShaderLayout(layout: BindGroupLayout): BindGroupLayoutGroupId {
        const gl = this.glContext;
        for (const { type, name, binding } of layout.variables) {
            if (type === 'uniform' && this.uniformBlockIndices[name] === undefined) {
                this.uniformBlockIndices[name] = Math.max(...Object.values(this.uniformBlockIndices), -1) + 1;
            } else if (type === 'texture' && this.textureBindGroups[binding] === undefined) {
                this.textureBindGroups[binding] = Math.max(...Object.values(this.textureBindGroups), (gl.TEXTURE0 - 1)) + 1;
            }
        }

        return Symbol(`webgl2-shader-layout-${idGenerator()}`);
    }

    public createBindGroup(groupLayoutId: BindGroupLayoutGroupId, bindGroups: BindGroupEntry[]): BindGroupId {
        const id = Symbol(`webgl2-bind-group-${bindGroups[0].name}-${idGenerator()}`);

        const currentBindGroups: BindGroupEntry[] = this.bindGroupLayouts[groupLayoutId] || [];
        bindGroups.forEach(bg => currentBindGroups.push(bg));
        this.bindGroupLayouts[groupLayoutId] = currentBindGroups;
        this.bindGroups[id] = bindGroups;
        return id;
    }

    createBuffer(buffer: BufferDescription): BufferId {
        if (buffer.usage & BufferUsage.STORAGE) {
            return this._createInstancedBuffer(buffer);
        }

        const bId = Symbol(`buffer-${buffer.label}-${idGenerator()}`);
        const gpuBuffer = this.glContext.createBuffer() as WebGLBuffer;

        this.buffers.set(bId, {
            gpuBuffer,
            bufferInfo: buffer,
        });

        const { isUniform, type } = getBufferType(buffer, this.glContext);

        this.glContext.bindBuffer(type, gpuBuffer);
        this.glContext.bufferData(type, buffer.byteLength,
            isUniform ? this.glContext.DYNAMIC_DRAW : this.glContext.STATIC_DRAW);

        return bId;
    }

    createBufferWithData(buffer: BufferDescription, data: BufferData): BufferId {
        if (buffer.usage & BufferUsage.STORAGE) {
            return this._createInstancedBuffer(buffer);
        }

        if (buffer.usage & BufferUsage.VERTEX) {
            return this._createVertexBuffer(buffer, data);
        }

        const bId = Symbol(`${buffer.label}-buffer`);

        const gpuBuffer = this.glContext.createBuffer() as WebGLBuffer;
        const { type, isUniform } = getBufferType(buffer, this.glContext);

        this.glContext.bindBuffer(type, gpuBuffer);
        if (isUniform) {
            this.glContext.bufferData(type, buffer.byteLength, this.glContext.DYNAMIC_DRAW);
            this.glContext.bufferSubData(type, 0, data);
        } else {
            this.glContext.bufferData(type, data, this.glContext.STATIC_DRAW);
        }
        this.glContext.bindBuffer(type, null);

        this.buffers.set(bId, {
            gpuBuffer,
            bufferInfo: buffer,
        });

        return bId;
    }

    writeToBuffer(bufferId: BufferId, data: BufferData,
                  bufferOffset: number = 0, dataOffset: number = 0,
                  dataToWriteSize: number = data.length) {
        const buffer = this.buffers.get(bufferId) as WebGlBufferInfo;
        if (buffer === undefined) {
            const instancedBuffer = this.instancedBuffers[bufferId]
            const gl = this.glContext;

            const numberOfFloatsPerData = 16; // ModelMatrix - mat4
            const offsetInFloats = bufferOffset / Float32Array.BYTES_PER_ELEMENT;
            const numberOfFloatsPerPixel = 4;
            const textureOffset = offsetInFloats / numberOfFloatsPerPixel;
            const width = numberOfFloatsPerData / numberOfFloatsPerPixel;

            gl.bindTexture(gl.TEXTURE_2D, instancedBuffer);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, textureOffset, 0, width, 1, gl.RGBA, gl.FLOAT, data as Float32Array);
            return;
        }
        const { type, isUniform } = getBufferType(buffer.bufferInfo, this.glContext);

        this.glContext.bindBuffer(type, buffer.gpuBuffer);
        if (isUniform) {
            this.glContext.bufferSubData(type, bufferOffset, data, dataOffset, dataToWriteSize);
        } else {
            console.trace('WARNING, THIS MAY NOT WORK AS EXPECTED, WRITE TO BUFFER STATIC DRAW')
            this.glContext.bufferData(type, data, this.glContext.STATIC_DRAW);
        }
        this.glContext.bindBuffer(type, null);
    }

    createTexture(img: TextureData, name?: string): TextureId {
        const textureId = Symbol(`texture-${name}`);
        const texture = this.glContext.createTexture();

        this.glContext.bindTexture(this.glContext.TEXTURE_2D, texture);
        this.glContext.texImage2D(this.glContext.TEXTURE_2D, 0, this.glContext.RGBA, this.glContext.RGBA, this.glContext.UNSIGNED_BYTE, img);
        this.glContext.texParameteri(this.glContext.TEXTURE_2D, this.glContext.TEXTURE_WRAP_S, this.glContext.REPEAT);
        this.glContext.texParameteri(this.glContext.TEXTURE_2D, this.glContext.TEXTURE_WRAP_T, this.glContext.REPEAT);
        this.glContext.texParameteri(this.glContext.TEXTURE_2D, this.glContext.TEXTURE_MAG_FILTER, this.glContext.LINEAR);
        this.glContext.texParameteri(this.glContext.TEXTURE_2D, this.glContext.TEXTURE_MIN_FILTER, this.glContext.LINEAR);

        this.textures.set(textureId, texture as WebGLTexture);

        return textureId;
    }

    createSampler(): SamplerId {
        const gl = this.glContext;
        const samplerId = Symbol('WebGLSampler');
        const sampler = gl.createSampler() as WebGLSampler;

        gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_S, gl.REPEAT);  // Repeat texture horizontally
        gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_T, gl.REPEAT);  // Repeat texture vertically
        gl.samplerParameteri(sampler, gl.TEXTURE_MIN_FILTER, gl.LINEAR);  // Linear filtering when minifying
        gl.samplerParameteri(sampler, gl.TEXTURE_MAG_FILTER, gl.NEAREST);  // Nearest filtering when magnifying

        return samplerId;
    }

    beginRenderPass(): RenderPass {
        return new WebGLRenderPass(this, this.props);
    }

    private loadShader(type: GLenum, source: string) {
        const gl = this.glContext;
        const shader = gl.createShader(type) as WebGLShader;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const shaderType = (type ^ gl.VERTEX_SHADER) ? "FRAGMENT_SHADER" : "VERTEX_SHADER";
            alert(
                `An error occurred compiling ${shaderType} shaders: ${gl.getShaderInfoLog(shader)}`,
            );
            console.error(gl.getShaderInfoLog(shader))
            gl.deleteShader(shader);
            throw 'Error creating shader ' + shaderType;
        }

        return shader;
    }

    /**
     * Simulate storage buffer using texture.
     */
    private _createInstancedBuffer(bufferDesc: BufferDescription) {
        const gl = this.glContext;
        const tId = Symbol(`instance-buffer-${bufferDesc.label}`)
        const instancedTexture = gl.createTexture() as WebGLTexture;

        const textureWidth = bufferDesc.byteLength / Float32Array.BYTES_PER_ELEMENT;
        // console.log(`Creating storage buffer: ${bufferDesc.label}. Using texture with width`, textureWidth)
        const textureHeight = 1;
        gl.bindTexture(gl.TEXTURE_2D, instancedTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, textureWidth, textureHeight, 0, gl.RGBA, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.instancedBuffers[tId] = instancedTexture;

        return tId;
    }

    private _createBindGroups(gl: WebGL2RenderingContext,
                              shaderProgram: WebGLProgram,
                              bindGroups: BindGroupEntry[]) {
        for (const bindGroup of bindGroups) {
            const { type, name, binding } = bindGroup;
            if (type === 'uniform') {
                const bindNumber = this.uniformBlockIndices[name];
                bindGroup.binding = bindNumber;
                const blockIndex = gl.getUniformBlockIndex(shaderProgram, name);
                gl.uniformBlockBinding(shaderProgram, blockIndex, blockIndex);
            } else if (type === 'texture') {
                gl.useProgram(shaderProgram);
                const textureLocation = this.textureBindGroups[binding];

                let textureUniform = gl.getUniformLocation(shaderProgram, name);
                if (textureUniform === null) {
                    // TODO: Rework me
                    textureUniform = gl.getUniformLocation(shaderProgram, 'uSampler')
                }
                const samplerUniformIndex = textureLocation - gl.TEXTURE0;
                gl.uniform1i(textureUniform, samplerUniformIndex);
            } else if (type === 'storage') {
                gl.useProgram(shaderProgram);
                gl.uniform1i(gl.getUniformLocation(shaderProgram, "instanceDataTexture"), 15);// TODO Hardcoded
                gl.uniform1f(gl.getUniformLocation(shaderProgram, "textureWidth"), 1024);
            }
        }
    }

    private _createVertexBuffer(buffer: BufferDescription,
                                data: BufferData): BufferId {
        const gl = this.glContext;

        const vaoBufferId = Symbol(`VAO-Buffer-${buffer.label}`);
        const vao = gl.createVertexArray();
        const glBuffer = gl.createBuffer();

        const { stride, entries } = buffer.vertexLayout!;

        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, glBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        let lastOffset = 0, lastElementsPerVertex = 0;
        for (let i = 0; i < entries.length; i++) {
            const { elementsPerVertex } = entries[i];

            lastOffset = lastOffset + Float32Array.BYTES_PER_ELEMENT * lastElementsPerVertex;
            gl.enableVertexAttribArray(i);
            gl.vertexAttribPointer(i, elementsPerVertex || 1, gl.FLOAT, false, stride, lastOffset);
            lastElementsPerVertex = elementsPerVertex;
        }

        // TODO: Use this to add new attribute buffer to the VAO (also bin the buffer)
        // gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
        // gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
        // gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 6 * 4);

        this.vertexArrayObjects[vaoBufferId] = vao!;

        return vaoBufferId;
    }

    private _createVAO(layout: VertexBufferLayout[],
                       stride: number,
                       arrayBuffer: WebGLBuffer) {
        const gl = this.glContext;

        const vao = gl.createVertexArray();


        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, arrayBuffer);

        for (let i = 0; i < layout.length; i++) {
            const { offset, format, location } = layout[i];
            const [float, paramsCount] = format.split('x'); // TODO:


            gl.enableVertexAttribArray(location || i);
            gl.vertexAttribPointer(location || i, parseInt(paramsCount) || 1, gl.FLOAT, false, stride, offset);
        }

        return vao!;
    }
}

export class WebGLRenderPass implements RenderPass {

    private drawMode: GLenum;
    private pipeline?: PipelineId;

    constructor(private glGraphics: WebGLGraphics, props: PropertiesManager) {
        glGraphics.glContext.clearColor(0.2, 0.2, 0.2, 1);
        glGraphics.glContext.clear(glGraphics.glContext.COLOR_BUFFER_BIT | glGraphics.glContext.DEPTH_BUFFER_BIT);
        this.drawMode = props.getBoolean('wireframe') ? glGraphics.glContext.LINES : glGraphics.glContext.TRIANGLES;
    }

    usePipeline(pipeline: PipelineId): RenderPass {
        const gl = this.glGraphics.glContext;
        const { shaderProgram, shaderDescription } = this.glGraphics.pipelines.get(pipeline)!;
        gl.useProgram(shaderProgram);
        this.pipeline = pipeline;

        const {
            options: {
                wireframe,
                depthCompare,
                cullFace,
                blendMode,
                depthWriteEnabled,
                writeMask
            }
        } = shaderDescription

        this.drawMode = wireframe ? gl.LINES : this.drawMode;
        gl.cullFace(cullFace === 'front' ? gl.FRONT : gl.BACK);
        BlendModeConverter.setBlendMode(gl, blendMode);
        BlendModeConverter.setDepthCompare(gl, depthCompare);
        gl.depthMask(depthWriteEnabled);
        gl.colorMask(true, true, true, writeMask === 'ALL');


        return this;
    }

    public setVertexBuffer(slot: number, vertexBufferId: BufferId): RenderPass {
        const gl = this.glGraphics.glContext;
        const graphics = this.glGraphics;

        const vao = graphics.vertexArrayObjects[vertexBufferId]!;

        gl.bindVertexArray(vao);

        return this;
    }

    public setBindGroup(index: number, bindGroupId: BindGroupId): RenderPass {
        const gl = this.glGraphics.glContext;
        const buffers = this.glGraphics.bindGroups[bindGroupId];

        buffers.forEach((buffer) => {
            if (buffer.type === 'uniform') {
                const { gpuBuffer } = this.glGraphics.buffers.get(buffer.id)!;
                gl.bindBuffer(gl.UNIFORM_BUFFER, gpuBuffer);
                gl.bindBufferBase(gl.UNIFORM_BUFFER, buffer.binding, gpuBuffer);
            }
            if (buffer.type === 'texture') {
                const texture = this.glGraphics.textures.get(buffer.id) as WebGLTexture;
                const textureBinding = this.glGraphics.textureBindGroups[buffer.binding];

                gl.activeTexture(textureBinding);
                gl.bindTexture(gl.TEXTURE_2D, texture);
            }
            if (buffer.type === 'storage') {
                const texture = this.glGraphics.instancedBuffers[buffer.id] as WebGLTexture;
                gl.activeTexture(gl.TEXTURE15); // TODO: This is hardcoded
                gl.bindTexture(gl.TEXTURE_2D, texture);
            }
        });

        return this;
    }

    public drawInstanced(indexBuffer: BufferId, indices: number, instances: number): RenderPass {
        const gl = this.glGraphics.glContext;

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.glGraphics.buffers.get(indexBuffer)!.gpuBuffer)
        gl.drawElementsInstanced(this.drawMode, indices, gl.UNSIGNED_INT, 0, instances);
        gl.bindVertexArray(null);

        return this;
    }

    public drawIndexed(indexBuffer: BufferId, indices: number): RenderPass {
        const gl = this.glGraphics.glContext;

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.glGraphics.buffers.get(indexBuffer)!.gpuBuffer)
        gl.drawElements(this.drawMode, indices, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);

        return this;
    }


    submit(): void {
        // this.commandBuffer.forEach(fn => fn());
        // this.glGraphics.glContext.finish();
        // this.glGraphics.glContext.flush();
        // this.commandBuffer = [];
    }

}

interface WebGlBufferInfo {
    bufferInfo: BufferDescription,
    gpuBuffer: WebGLBuffer
}

interface WebGlPipelineInfo {
    shaderProgram: WebGLShader,
    shaderDescription: ShaderProgramDescription
}


function getBufferType(buffer: BufferDescription, gl: WebGL2RenderingContext): { type: number, isUniform: boolean } {
    let type: GLenum = gl.ARRAY_BUFFER, isUniform = false;
    if (buffer.usage & BufferUsage.STORAGE) {
        isUniform = true;
    } else if (buffer.usage & BufferUsage.UNIFORM) {
        type = gl.UNIFORM_BUFFER;
        isUniform = true;
    } else if (buffer.usage & BufferUsage.INDEX) {
        type = gl.ELEMENT_ARRAY_BUFFER;
    }

    return { type, isUniform }
}
