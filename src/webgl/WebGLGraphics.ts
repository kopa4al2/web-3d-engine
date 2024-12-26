import Graphics, { BindGroupId, BindGroupLayoutId, PipelineId, RenderPass, UpdateTexture } from "core/Graphics";
import PropertiesManager from "core/PropertiesManager";
import BindGroup from 'core/resources/BindGroup';
import BindGroupLayout from 'core/resources/BindGroupLayout';
import { BufferData, BufferDescription, BufferId, BufferUsage, } from "core/resources/gpu/BufferDescription";
import { ShaderProgramDescription } from "core/resources/gpu/GpuShaderData";
import TextureManager from "core/resources/TextureManager";
import SamplingConfig from "core/texture/SamplingConfig";
import { SamplerId, TextureDescription, TextureId, TextureType } from "core/texture/Texture";
import TexturePacker from "core/texture/TexturePacker";
import { vec3 } from 'gl-matrix';
import DebugUtil from 'util/DebugUtil';
import { BlendModeConverter } from 'webgl/BlendModeConverter';
import Canvas from "../Canvas";
import GlSampler from "./textures/GlSampler";
import GlTexture from "./textures/GlTexture";

const idGenerator = (() => {
    let id = 0;
    return () => {
        return id++;
    }
})();

const EMPTY_FRAGMENT_SHADER = `#version 300 es 
                               void main() {}
                               `;

export type GlTextureCache = { glTexture: WebGLTexture, metaData: TextureDescription, activeTexture: number }
export type GlSamplerCache = { glSampler: WebGLSampler, targetTexture?: TextureId, }


export default class WebGLGraphics implements Graphics {
    readonly glContext: WebGL2RenderingContext;

    public readonly vertexArrayObjects: WeakMap<BufferId, WebGLVertexArrayObject>;
    public readonly bindGroups: WeakMap<BindGroupId, BindGroup>;
    public readonly uniformBlockIndices: Record<string, number>; // ubo name - block index

    public readonly buffers: WeakMap<BufferId, WebGlBufferInfo>;
    public readonly textures: WeakMap<TextureId, GlTextureCache>;
    public readonly samplers: WeakMap<SamplerId, GlSamplerCache>;

    private readonly bindGroupsByLayout: WeakMap<BindGroupLayoutId, WebGlBindGroupInfo>

    public readonly pipelines: WeakMap<PipelineId, WebGlPipelineInfo>;

    private textureUnitCounter


    constructor(canvas: Canvas, private props: PropertiesManager) {
        DebugUtil.addToWindowObject('glGraphics', this);
        const gl = canvas.getWebGl2Context();

        this.bindGroupsByLayout = new WeakMap();

        this.uniformBlockIndices = {};
        this.vertexArrayObjects = new WeakMap<BufferId, WebGLVertexArrayObject>();
        this.bindGroups = new WeakMap();

        this.buffers = new WeakMap();
        this.textures = new WeakMap();
        this.samplers = new WeakMap();
        this.pipelines = new WeakMap();
        this.textureUnitCounter = gl.TEXTURE0;

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
        gl.attachShader(shaderProgram, this.loadShader(gl.FRAGMENT_SHADER, shader.fragmentShaderSource || EMPTY_FRAGMENT_SHADER));
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            console.group('Error initializing the shader program');
            console.log('Shader log: ', gl.getProgramInfoLog(shaderProgram));
            console.log('Shader data: ', shader);
            console.groupEnd()
            throw new Error('Error creating the shader program');
        }

        shader.shaderLayoutIds.forEach(bindGroupLayoutId => {
            if (!this.bindGroupsByLayout.has(bindGroupLayoutId)) {
                console.error(
                    `ERROR: Pipeline ${shader.label} references bindGroupLayout ${bindGroupLayoutId.description} which is not defined`, bindGroupLayoutId, this.bindGroupsByLayout, shader)
            }
            gl.useProgram(shaderProgram);
            this._createBindGroups(gl, shaderProgram, this.bindGroupsByLayout.get(bindGroupLayoutId)!.bindGroup);
        });

        this.pipelines.set(pipelineId, { shaderProgram, shaderDescription: shader });

        return pipelineId;
    }

    public createShaderLayout(layout: BindGroupLayout): BindGroupLayoutId {
        for (const { type, name } of layout.entries) {
            if (type === 'uniform' && this.uniformBlockIndices[name] === undefined) {
                this.uniformBlockIndices[name] = Math.max(...Object.values(this.uniformBlockIndices), -1) + 1;
            }
        }

        return Symbol(`webgl2-${layout.label}-layout`);
    }

    public createBindGroup(groupLayoutId: BindGroupLayoutId, bindGroup: BindGroup): BindGroupId {
        const gl = this.glContext;
        const id = Symbol(`webgl2-bind-group-${bindGroup.label}`);

        this.bindGroupsByLayout.set(groupLayoutId, { bindGroup, bindGroupId: id });
        this.bindGroups.set(id, bindGroup);
        bindGroup.entries
            .filter(entry => entry.type === 'uniform')
            .forEach(({
                          name,
                          bufferId
                      }) => gl.bindBufferBase(gl.UNIFORM_BUFFER, this.uniformBlockIndices[name], this.buffers.get(bufferId)!.gpuBuffer))

        return id;
    }

    createBuffer(buffer: BufferDescription): BufferId {
        const bId = Symbol(`buffer-${buffer.label}`);
        const gpuBuffer = this.glContext.createBuffer() as WebGLBuffer;

        this.buffers.set(bId, {
            gpuBuffer,
            bufferInfo: buffer,
        });

        if (buffer.usage & BufferUsage.STORAGE) {
            return this._createInstancedBuffer(buffer, bId);
        }

        const { isUniform, type } = getBufferType(buffer, this.glContext);

        this.glContext.bindBuffer(type, gpuBuffer);
        this.glContext.bufferData(type, buffer.byteLength, this.glContext.DYNAMIC_DRAW);
        // We assume that since we create the buffer without data we will update it often, so hardcode DYNAMIC_DRAW
        // isUniform ? this.glContext.DYNAMIC_DRAW : this.glContext.STATIC_DRAW);

        return bId;
    }

    createBufferWithData(buffer: BufferDescription, data: BufferData): BufferId {
        const bId = Symbol(`${buffer.label}-buffer`);
        // @ts-ignore We will populate the gpuBuffer
        this.buffers.set(bId, { gpuBuffer: undefined, bufferInfo: buffer, });

        if (buffer.usage & BufferUsage.STORAGE) {
            return this._createInstancedBuffer(buffer, bId);
        }

        if (buffer.usage & BufferUsage.VERTEX) {
            return this._createVertexBuffer(bId, buffer, data);
        }


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

        this.buffers.get(bId)!.gpuBuffer = gpuBuffer;
        return bId;
    }

    writeToBuffer(bufferId: BufferId, data: BufferData,
                  bufferOffset: number = 0, dataOffset: number = 0,
                  dataToWriteSize: number = (data as Float32Array).length) {
        const buffer = this.buffers.get(bufferId) as WebGlBufferInfo;
        const gl = this.glContext;
        if (buffer.bufferInfo.usage & BufferUsage.STORAGE) {
            const instancedBuffer = buffer.gpuBuffer;

            const numberOfFloatsPerData = 16; // ModelMatrix - mat4
            const offsetInFloats = bufferOffset / Float32Array.BYTES_PER_ELEMENT;
            const numberOfFloatsPerPixel = 4;
            const textureOffset = offsetInFloats / numberOfFloatsPerPixel;
            const width = numberOfFloatsPerData / numberOfFloatsPerPixel;

            gl.bindTexture(gl.TEXTURE_2D, instancedBuffer);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, textureOffset, 0, width, 1, gl.RGBA, gl.FLOAT, data as Float32Array);
            return;
        } else if (buffer.bufferInfo.usage & BufferUsage.VERTEX) {
            const vao = this.vertexArrayObjects.get(bufferId)!;
            gl.bindVertexArray(vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer.gpuBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
            return;
        }

        const { type, isUniform } = getBufferType(buffer.bufferInfo, this.glContext);

        this.glContext.bindBuffer(type, buffer.gpuBuffer);
        if (isUniform) {
            this.glContext.bufferSubData(type, bufferOffset, data, dataOffset, dataToWriteSize);
        } else {
            // console.warn('WARNING, THIS MAY NOT WORK AS EXPECTED, WRITE TO BUFFER STATIC DRAW')
            this.glContext.bufferData(type, data, this.glContext.DYNAMIC_DRAW);
        }
        this.glContext.bindBuffer(type, null);
    }

    updateTexture(textureId: TextureId, updateTexture: UpdateTexture): void {
        const texture = this.textures.get(textureId)!;
        GlTexture.writeToTexture(this.glContext, texture, updateTexture);
    }

    createTexture(textureDescription: TextureDescription): TextureId {
        const textureId = Symbol(`texture-${textureDescription.label || 'gl2'}`);
        const activeTexture = this.textureUnitCounter++;
        const texture = GlTexture.createTexture(this.glContext, textureDescription, activeTexture);
        this.textures.set(textureId, {
            glTexture: texture,
            metaData: textureDescription,
            activeTexture: activeTexture
        });
        return textureId;
    }

    createSampler(sampler: SamplingConfig): SamplerId {
        const samplerId = Symbol(`sampler-webgl-${sampler.label}`);
        const glSampler = GlSampler.createSampler(this.glContext, sampler);
        this.samplers.set(samplerId, { glSampler, targetTexture: sampler.targetTexture });
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
            // alert(
            //     `An error occurred compiling ${shaderType} shaders: ${gl.getShaderInfoLog(shader)}`,
            // );
            console.group('Error compiling shader: ' + shaderType);
            console.log('Shader log: ', gl.getShaderInfoLog(shader));
            // console.log('Source: ', source);
            console.groupEnd();
            gl.deleteShader(shader);
            throw new Error('Error creating shader ' + shaderType);
        }

        return shader;
    }

    /**
     * TODO: Rework instancing in webgl!!!
     *
     * Simulate storage buffer using texture.
     */
    private _createInstancedBuffer(bufferDesc: BufferDescription, id: BufferId) {
        const gl = this.glContext;
        const instancedTexture = gl.createTexture() as WebGLTexture;

        const textureWidth = bufferDesc.byteLength / Float32Array.BYTES_PER_ELEMENT;
        const textureHeight = 1;
        gl.activeTexture(gl.TEXTURE15);
        gl.bindTexture(gl.TEXTURE_2D, instancedTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, textureWidth, textureHeight, 0, gl.RGBA, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.buffers.get(id)!.gpuBuffer = instancedTexture;

        return id;
    }

    private _createBindGroups(gl: WebGL2RenderingContext,
                              shaderProgram: WebGLProgram,
                              { entries }: BindGroup) {
        for (const bindGroupEntry of entries) {
            const { type, name, binding, bufferId } = bindGroupEntry;
            if (type === 'uniform') {
                const uniformBindPoint = this.uniformBlockIndices[name];
                // bindGroupEntry.binding = uniformBindPoint;
                const blockIndex = gl.getUniformBlockIndex(shaderProgram, name);
                gl.uniformBlockBinding(shaderProgram, blockIndex, uniformBindPoint);
                // gl.bindBufferBase(gl.UNIFORM_BUFFER, uniformBindPoint, this.buffers.get(bufferId)!.gpuBuffer);
            } else if (type === 'texture-array' || type === 'cube-texture' || type === 'texture') {
                gl.useProgram(shaderProgram);
                const texture = this.textures.get(bufferId)!
                const textureUniform = gl.getUniformLocation(shaderProgram, name);
                gl.uniform1i(textureUniform, texture.activeTexture - gl.TEXTURE0);
            } else if (type === 'storage') {
                const storageBuffer = this.buffers.get(bindGroupEntry.bufferId)!;

                gl.useProgram(shaderProgram);
                gl.uniform1i(gl.getUniformLocation(shaderProgram, "instanceDataTexture"), 15);// TODO Hardcoded
                gl.uniform1f(gl.getUniformLocation(shaderProgram, "textureWidth"),
                    storageBuffer.bufferInfo.byteLength / Float32Array.BYTES_PER_ELEMENT);
            } else if (type === 'sampler') {
                const { glSampler, targetTexture } = this.samplers.get(bindGroupEntry.bufferId)!;
                if (!targetTexture) {
                    console.warn('Sampler without target texture detected. Sampler will be ignored INVESTIGATE!');
                    console.warn('Sampler: ', bindGroupEntry);
                    continue;
                }

                const textureUnit = this.textures.get(targetTexture)!.activeTexture;
                gl.bindSampler(textureUnit - gl.TEXTURE0, glSampler);
            }
        }
    }

    private _createVertexBuffer(id: BufferId,
                                buffer: BufferDescription,
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

        this.vertexArrayObjects.set(vaoBufferId, vao);
        this.buffers.set(vaoBufferId, { ...this.buffers.get(id)!, gpuBuffer: glBuffer! });

        return vaoBufferId;
    }

    public _rawApi(): WebGL2RenderingContext {
        return this.glContext;
    }

    public _exportTextureArray(textureId: TextureId, texturePackerOpt?: TexturePacker) {
        // @ts-ignore
        const texturePacker: TexturePacker = window.texturePacker;

        const gl = this.glContext;
        const framebuffer = gl.createFramebuffer();
        const layerWidth = TextureManager.MAX_TEXTURE_ARRAY_SIZE.width;
        const layerHeight = TextureManager.MAX_TEXTURE_ARRAY_SIZE.height;
        const layers = texturePacker.layers.length;
        // const layers = TextureManager.TEXTURE_ARRAY_LAYERS;
        const gridColumns = Math.ceil(Math.sqrt(layers)); // Square-ish grid
        const gridRows = Math.ceil(layers / gridColumns);

        const pixelBuffer = new Uint8Array(layerWidth * layerHeight * 4); // RGBA8 format
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = gridColumns * layerWidth;
        canvas.height = gridRows * layerHeight;

        console.log(`Canvas width: ${gridColumns * layerWidth}px; height: ${gridRows * layerHeight}px;`);

        const imageData = ctx.createImageData(layerWidth, layerHeight);
        for (let layer = 0; layer < texturePacker.layers.length; layer++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.framebufferTextureLayer(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0,
                this.textures.get(textureId)!.glTexture,
                0,
                layer
            );

            // Check framebuffer status
            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
                console.error(`Framebuffer is not complete for layer ${layer}`);
                continue;
            }

            const col = layer % gridColumns;
            const row = Math.floor(layer / gridColumns);
            ctx.font = "48px bold";
            ctx.fillStyle = "white";

            gl.readPixels(0, 0, layerWidth, layerHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);
            imageData.data.set(pixelBuffer);
            ctx.putImageData(imageData, col * layerWidth, row * layerHeight);
            
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'white';
            ctx.strokeRect(col * layerWidth, row * layerHeight, layerWidth, layerHeight);
            const textX = col * layerWidth + 50;
            const textY = row * layerHeight + 30;
            ctx.fillText(`Layer ${layer}`, textX, textY + 30);
            for (let i = 0; i < texturePacker.layers[layer].occupiedRegions.length; i++) {
                const {
                    label,
                    x,
                    y,
                    width,
                    height,
                    uvScaleX,
                    uvScaleY,
                    uvOffsetX,
                    uvOffsetY
                } = texturePacker.layers[layer].occupiedRegions[i];
                if (width <= 16 || height <= 16) {
                    if (width > 1 && height > 1) {
                        continue;
                    }
                    console.log('4x4?', label, width, height)
                    ctx.font = "12px";
                    ctx.fillText(`${label.substring(label.lastIndexOf('/') + 1, (label.lastIndexOf('.')))}`, textX + x + 120, textY + y);
                    ctx.font = "48px bold";
                    continue;
                }
                ctx.strokeStyle = 'black';
                ctx.strokeRect(x, y, width, height);
                ctx.fillText(`(x: ${x} y: ${y} w: ${width} h: ${height})`, textX + x, textY + y + 90);
                ctx.fillText(`${label.substring(label.lastIndexOf('/') + 1, (label.lastIndexOf('.')))}`, textX + x, textY + y + 180);
                ctx.fillText(`uvOff: (${uvOffsetX.toFixed(1)},${uvOffsetY.toFixed(1)})`, textX + x, textY + y + 240);
                ctx.fillText(`uvScale: (${uvScaleX.toFixed(1)},${uvScaleY.toFixed(1)})`, textX + x, textY + y + 300);
            }

            // gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);

            // const imageData = ctx.createImageData(width, height);
            // imageData.data.set(pixelBuffer);
            // ctx.putImageData(imageData, col * width, row * height);
            //
            // ctx.font = "60px Arial";
            // ctx.fillStyle = "white";
            // ctx.fillText(`Layer ${layer}`, col * width + 10, row * height + 30);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // Save the canvas as an image
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'texture_atlas_grid.png';
        link.click();
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
                depthAttachment: {
                    depthCompare,
                    depthWriteEnabled,
                },
                colorAttachment: {
                    blendMode,
                    writeMask
                },
                cullFace,
            }
        } = shaderDescription

        this.drawMode = wireframe ? gl.LINES : this.drawMode;
        if (cullFace === 'none') {
            gl.disable(gl.CULL_FACE);
        } else {
            gl.enable(gl.CULL_FACE)
            gl.cullFace(cullFace === 'front' ? gl.FRONT : gl.BACK);
        }
        BlendModeConverter.setBlendMode(gl, blendMode);
        BlendModeConverter.setDepthCompare(gl, depthCompare);
        gl.depthMask(depthWriteEnabled);
        gl.colorMask(true, true, true, writeMask === 'ALL');

        return this;
    }

    public setVertexBuffer(slot: number, vertexBufferId: BufferId): RenderPass {
        const vao = this.glGraphics.vertexArrayObjects.get(vertexBufferId)!;
        this.glGraphics.glContext.bindVertexArray(vao);

        return this;
    }

    public setBindGroup(index: number, bindGroupId: BindGroupId, offset: number[]): RenderPass {
        const gl = this.glGraphics.glContext;
        const buffers = this.glGraphics.bindGroups.get(bindGroupId)!.entries;
        buffers.forEach((buffer) => {
            if (buffer.type === 'uniform') {
                const { gpuBuffer } = this.glGraphics.buffers.get(buffer.bufferId)!;
                const uboIndex = this.glGraphics.uniformBlockIndices[buffer.name];
                gl.bindBufferBase(gl.UNIFORM_BUFFER, uboIndex, gpuBuffer);
            } else if (buffer.type === 'storage') {
                // const { gpuBuffer } = this.glGraphics.buffers.get(buffer.bufferId)!;
                // gl.bindTexture(gl.TEXTURE_2D, gpuBuffer);
                // TODO: This is the hard coded texture slot for textures used as instance buffers
                //       This will not work if more than one instance buffers are present.
                gl.activeTexture(gl.TEXTURE15);
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

    public drawSimple(indices: number): RenderPass {
        const gl = this.glGraphics.glContext;
        gl.drawArrays(gl.LINES, 0, indices);
        return this;
    }


    submit(): void {
    }

}

interface WebGlBufferInfo {
    bufferInfo: BufferDescription,
    gpuBuffer: WebGLBuffer | WebGLTexture
}

interface WebGlPipelineInfo {
    shaderProgram: WebGLShader,
    shaderDescription: ShaderProgramDescription
}

interface WebGlBindGroupInfo {
    bindGroup: BindGroup,
    bindGroupId: BindGroupId,
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
