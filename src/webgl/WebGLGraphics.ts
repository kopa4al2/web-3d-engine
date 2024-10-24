import { Buffer, BufferData, BufferId, BufferUsage, TextureData } from "core/buffer/Buffer";
import Graphics, { PipelineId, RenderPass } from "core/Graphics";
import PropertiesManager from "core/PropertiesManager";
import { Shader } from "core/shaders/Shader";
import { SamplerId, TextureId } from "core/texture/Texture";
import log from "util/Logger";
import ThrottleUtil from "util/ThrottleUtil";
import Canvas from "../Canvas";

export default class WebGLGraphics implements Graphics {
    glContext: WebGL2RenderingContext;

    public readonly buffers: Map<BufferId, WebGlBufferInfo>;
    readonly textures: Map<TextureId, WebGLTexture>;
    private readonly samplers: Map<SamplerId, WebGLSampler>;


    // VAOs
    public readonly pipelines: Map<PipelineId, WebGlPipelineInfo>;
    public readonly shaders: Map<PipelineId, Shader>;

    constructor(canvas: Canvas, private props: PropertiesManager) {
        const gl = canvas.getWebGl2Context();

        this.buffers = new Map();
        this.textures = new Map();
        this.samplers = new Map();
        this.pipelines = new Map();
        this.shaders = new Map();


        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.depthFunc(gl.LESS);
        gl.cullFace(gl.BACK);
        // gl.disable(gl.CULL_FACE)
        // gl.frontFace(gl.CCW)

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        props.subscribeToAnyPropertyChange(['window.width', 'window.height'],
            () => gl.viewport(0, 0, props.get<number>('window.width'), props.get<number>('window.height')));
        this.glContext = gl;
    }

    initPipeline(shader: Shader): PipelineId {
        const pipelineId = Symbol('WebGl2Pipeline');
        const shaderProgram = this.glContext.createProgram() as WebGLProgram;

        this.glContext.attachShader(shaderProgram, this.loadShader(this.glContext.VERTEX_SHADER, shader.vertexShaderSource));
        this.glContext.attachShader(shaderProgram, this.loadShader(this.glContext.FRAGMENT_SHADER, shader.fragmentShaderSource));
        this.glContext.linkProgram(shaderProgram);

        // UNIFORMS
        let uniformCounter = 0;
        for (let bindGroup of shader.bindGroups) {
            for (let j = 0; j < bindGroup.buffers.length; j++) {
                const { type, id: bufferId, bindNumber, name: blockName } = bindGroup.buffers[j];
                if (type === 'uniform') {
                    const blockIndex = this.glContext.getUniformBlockIndex(shaderProgram, blockName);
                    log.infoGroup('WebGLGraphics', `Binding in webgl: bindNUm: ${bindNumber}. blockName: ${blockName}. ${blockIndex}. ${bufferId.toString()}. ${type}`)
                    this.glContext.uniformBlockBinding(shaderProgram, blockIndex, uniformCounter++);  // Bind UBO to binding point
                } else if (type === 'sampler') {
                    // TODO Implement when specific samplers are needed.
                    /*const sampler = this.samplers.get(bufferId);
                    this.glContext.bindSampler(0, sampler);
                    this.glContext.activeTexture(this.glContext.TEXTURE0);*/
                } else if (type === 'texture') {

                }
            }
        }

        const vaos: WebGLVertexArrayObject[] = [];
        for (let vertexBuffer of shader.vertexBuffers) {
            const vao = this.glContext.createVertexArray();
            const bufferInfo = this.buffers.get(vertexBuffer.id) as WebGlBufferInfo;
            this.glContext.bindVertexArray(vao);
            this.glContext.bindBuffer(this.glContext.ARRAY_BUFFER, bufferInfo.gpuBuffer);
            for (let i = 0; i < vertexBuffer.layout.length; i++) {
                const { offset, format } = vertexBuffer.layout[i];
                const [float, indices] = format.split('x'); // TODO:

                this.glContext.vertexAttribPointer(i, indices as unknown as number, this.glContext.FLOAT, false, vertexBuffer.stride, offset);
                this.glContext.enableVertexAttribArray(i);
            }
            vaos.push(vao as WebGLVertexArrayObject);
        }


        let indexBuffer;
        if (shader.indexBuffer) {
            indexBuffer = (this.buffers.get(shader.indexBuffer.id) as WebGlBufferInfo).gpuBuffer;
        }

        if (!this.glContext.getProgramParameter(shaderProgram, this.glContext.LINK_STATUS)) {
            alert(
                `Unable to initialize the shader program: ${this.glContext.getProgramInfoLog(shaderProgram)}`,
            );
            console.error(this.glContext.getProgramInfoLog(shaderProgram));
            throw "Error creating the shader program";
        }

        this.pipelines.set(pipelineId, { shader, shaderProgram, vaos, indexBuffer });
        return pipelineId
    }

    createBuffer(buffer: Buffer): BufferId {
        const bId = Symbol(`buffer-${buffer.name}`);
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

    createBufferWithData(buffer: Buffer, data: BufferData): BufferId {
        const bId = Symbol('buffer');
        const gpuBuffer = this.glContext.createBuffer() as WebGLBuffer;
        const { type, isUniform } = getBufferType(buffer, this.glContext);

        this.glContext.bindBuffer(type, gpuBuffer);
        if (isUniform) {
            log.infoGroup(`GL BIND BUFFER ${buffer.name}`, buffer.byteLength)
            this.glContext.bufferData(type, data.byteLength, this.glContext.DYNAMIC_DRAW);
            this.glContext.bufferSubData(type, 0, data);
        } else
            this.glContext.bufferData(type, data, this.glContext.STATIC_DRAW);
        this.glContext.bindBuffer(type, null);

        this.buffers.set(bId, {
            gpuBuffer,
            bufferInfo: buffer,
        });

        return bId;
    }

    writeToBuffer(bufferId: BufferId, data: BufferData, bufferOffset: number = 0, dataOffset: number = 0, dataToWriteSize: number = data.length) {
        const buffer = this.buffers.get(bufferId) as WebGlBufferInfo;
        const { type, isUniform } = getBufferType(buffer.bufferInfo, this.glContext);
        this.glContext.bindBuffer(type, buffer.gpuBuffer);

        if (isUniform) {
            // this.glContext.bufferData(type, data.byteLength, this.glContext.DYNAMIC_DRAW);
            this.glContext.bufferSubData(type, bufferOffset, data, dataOffset, dataToWriteSize);
        } else {
            this.glContext.bufferData(type, data, this.glContext.STATIC_DRAW);
        }
        this.glContext.bindBuffer(type, null);
    }

    createTexture(img: TextureData, name?: string): TextureId {
        const textureId = Symbol(`texture-${name}`);
        const texture = this.glContext.createTexture();

        this.glContext.bindTexture(this.glContext.TEXTURE_2D, texture);
        this.glContext.texImage2D(this.glContext.TEXTURE_2D, 0, this.glContext.RGBA, this.glContext.RGBA, this.glContext.UNSIGNED_BYTE, img);
        // TODO: If 1x1 noop texturing doesnt work this is what chatgpt suggested
        // this.glContext.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, dummyTexture);

        // this.glContext.texParameteri(this.glContext.TEXTURE_2D, this.glContext.TEXTURE_WRAP_S, this.glContext.CLAMP_TO_EDGE);
        // this.glContext.texParameteri(this.glContext.TEXTURE_2D, this.glContext.TEXTURE_WRAP_T, this.glContext.CLAMP_TO_EDGE);
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

}

export class WebGLRenderPass implements RenderPass {

    private commandBuffer: Function[];

    private drawMode: GLenum;
    constructor(private glGraphics: WebGLGraphics, props: PropertiesManager) {
        this.commandBuffer = [];
        this.commandBuffer.push(() => {
            glGraphics.glContext.clearColor(0.2, 0.2, 0.2, 1);
            glGraphics.glContext.clear(glGraphics.glContext.COLOR_BUFFER_BIT | glGraphics.glContext.DEPTH_BUFFER_BIT);
        })
        this.drawMode = props.getBoolean('wireframe') ? glGraphics.glContext.LINES : glGraphics.glContext.TRIANGLES;
    }

    draw(pipeline: PipelineId): RenderPass {
        const {
            shader,
            shaderProgram,
            vaos,
            indexBuffer
        } = this.glGraphics.pipelines.get(pipeline) as WebGlPipelineInfo;

        const gl = this.glGraphics.glContext;

        this.commandBuffer.push(
            () => gl.useProgram(shaderProgram),
            () => {
                let uniformCounter = 0;
                let textureCounter = 0;
                for (let bindGroup of shader.bindGroups) {
                    for (let j = 0; j < bindGroup.buffers.length; j++) {
                        const { id: bufferId, type, name } = bindGroup.buffers[j];
                        if (type === 'uniform') {
                            const buffer = this.glGraphics.buffers.get(bufferId) as WebGlBufferInfo;
                            const { gpuBuffer } = buffer;
                            gl.bindBufferBase(gl.UNIFORM_BUFFER, uniformCounter++, gpuBuffer);
                        } else if (type === 'texture') {
                            const texture = this.glGraphics.textures.get(bufferId) as WebGLTexture;
                            gl.activeTexture(gl.TEXTURE0 + textureCounter);
                            gl.bindTexture(gl.TEXTURE_2D, texture);
                            const textureUniform = gl.getUniformLocation(shaderProgram, `${name.replace('-', '')}Texture`);
                            gl.uniform1i(textureUniform, textureCounter);

                            textureCounter += 1;
                        }

                        // TODO: Else if Sampler logic
                    }
                }

                vaos.forEach((vao, idx) => {
                    gl.bindVertexArray(vao);
                    if (indexBuffer && shader.indexBuffer) {
                        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
                        gl.drawElements(this.drawMode, shader.indexBuffer.indices, gl.UNSIGNED_INT, 0);
                    } else {
                        // gl.bindBuffer(gl.ARRAY_BUFFER, vao)
                        gl.drawArrays(this.drawMode, 0, shader.vertexBuffers[idx].vertexCount);
                    }
                    gl.bindVertexArray(null);
                });
            });
        return this;
    }

    submit(): void {
        this.commandBuffer.forEach(fn => fn());
    }

}

interface WebGlBufferInfo {
    bufferInfo: Buffer,
    gpuBuffer: WebGLBuffer
}

interface WebGlPipelineInfo {
    shader: Shader,
    vaos: WebGLVertexArrayObject[],
    indexBuffer?: WebGLBuffer,
    shaderProgram: WebGLShader,
}


function getBufferType(buffer: Buffer, gl: WebGL2RenderingContext): { type: number, isUniform: boolean } {
    const type = (buffer.usage & BufferUsage.UNIFORM && gl.UNIFORM_BUFFER)
        || (buffer.usage & BufferUsage.VERTEX && gl.ARRAY_BUFFER)
        || (buffer.usage & BufferUsage.INDEX && gl.ELEMENT_ARRAY_BUFFER);
    const isUniform = !!(buffer.usage & BufferUsage.UNIFORM);
    return {
        type,
        isUniform
    }
}