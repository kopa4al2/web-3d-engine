import { BufferFormat, BufferId } from "core/buffer/Buffer";
import { DrawMode } from "core/Graphics";
import { ObjFile } from "core/parser/ObjParser";
import { ShaderId, ShaderName } from "core/shaders/ShaderManager";
import Texture, { SamplerId, TextureId } from "core/texture/Texture";


export interface IndexBuffer {
    id: BufferId,
    indices: number,
}

export interface VertexBuffer {
    id: BufferId,
    stride: number;
    vertexCount: number;
    layout: VertexBufferLayout[]
}


export interface VertexBufferLayout {
    offset: number,
    format: BufferFormat;
    location?: number;
}

/**
 * Shader representation used by graphics api.
 */
export interface GPUShader {
    vertexShaderSource: string,
    fragmentShaderSource: string,
    bindGroups: BindGroupLayout[],
    vertexBuffers: VertexBuffer[],
    indexBuffer?: IndexBuffer,
}

export interface BindGroupLayout {
    shaderVisibility: ShaderType,  // vertex of fragment shader
    buffers: BindGroupBuffers [], // list of buffers that are in this group. The order in the array should be the order in which they are declared or the @binding index
}

export interface BindGroupBuffers {
    type: 'texture' | 'sampler' | 'uniform',
    id: (BufferId | TextureId | SamplerId),
    bindNumber: number,
    name: string,
}

export interface FragmentShader {
    // shaderSource: ShaderId,
    shaderSource: string,
    uniforms: UniformInfo[],
}

export interface UniformInfo {
    type: 'texture' | 'sampler' | 'float32Array',
    binding: number,
    group: number,
    name: string,
    visibility: ShaderType,
    value?: (Float32Array | Texture)
}

/**
 * CPU DATA
 */
export interface VertexShader {
    shaderSource: string,
    shader: ShaderName,
    stride: number,
    vertexCount: number,
    vertices: Float32Array,
    indices?: Uint16Array | Uint32Array,
    layout: VertexLayout[],
}

/**
 * CPU DATA
 */
export interface VertexLayout {
    dataType: BufferDataType,
    elementsPerVertex: number,
}

export type BufferDataType = 'float32';

export enum ShaderType {
    VERTEX = 1,
    FRAGMENT = 2,
    COMPUTE = 4,
}


export interface ShaderDescription {
    vertexShader: VertexShaderDescription,
    fragmentShader: FragmentShaderDescription,
}

export interface VertexShaderDescription {
    layout: VertexLayout[],
    name: ShaderName,
    uniforms: UniformGroup[],
}

export interface FragmentShaderDescription {
    name: ShaderName,
    uniforms: UniformGroup[],
}

function defaultGeometry(): VertexShaderDescription {

    return {
        name: 'default',
        layout: [
            { dataType: 'float32', elementsPerVertex: 3 }, // vertices
            { dataType: 'float32', elementsPerVertex: 3 }, // normals
            { dataType: 'float32', elementsPerVertex: 2 }], // texture uv
        uniforms: [{
            shaderUniformGroup: ShaderUniformGroup.WORLD_GROUP,
            binding: 0,
            visibility: ShaderType.VERTEX
        }]
    };
}

function defaultMaterial(): FragmentShaderDescription {
    return {
        name: 'default',
        uniforms: [
            {
                shaderUniformGroup: ShaderUniformGroup.MATERIAL,
                binding: 0,
                visibility: ShaderType.FRAGMENT
            },
            {
                shaderUniformGroup: ShaderUniformGroup.DIRECTIONAL_LIGHT_GROUP,
                binding: 1,
                visibility: ShaderType.FRAGMENT
            }
        ]
    }
}

export interface PipelineProperties {
    vertexShaderSource: string,
    fragmentShaderSource: string,
    vertexShaderStride: number,
    topology: DrawMode,
    vertexShaderLayout: VertexLayout[]
}

// WORLD = projection, model, inverseTranspose
// LIGHT_DIRECTION = ....

export interface UniformGroup {
    shaderUniformGroup: ShaderUniformGroup,
    binding: number,
    visibility: ShaderType
}

export interface BindGroup {
    name: string,
    binding: number,
    type: ShaderUniformType,
    buffer: BufferId | TextureId | SamplerId
}

export class GlobalUniform {

    // MODEL_MATRIX = 1,
    // VIEW_MATRIX = 2,
    // MODEL_INVERSE_TRANSPOSE = 3,
    // LIGHT_DIRECTION = 4,
    // LIGHT_COLOR = 5,
    // AMBIENT_LIGHT = 6,
    // DIFFUSE_LIGHT = 7,
    // SPECULAR_LIGHT = 8,

}

export type ShaderUniformId = symbol;
export type ShaderUniformType = 'texture' | 'sampler' | 'uniform';

export class ShaderUniform {
    static readonly MVP = new ShaderUniform(Symbol('MVP'), 'uniform', ShaderType.VERTEX);
    static readonly MODEL_MATRIX = new ShaderUniform(Symbol('ModelMatrix'), 'uniform', ShaderType.VERTEX);
    static readonly MODEL_INVERSE_TRANSPOSE = new ShaderUniform(Symbol('InverseTransposeMatrix'), 'uniform', ShaderType.VERTEX);

    static readonly LIGHT_DIRECTION = new ShaderUniform(Symbol('InverseTransposeMatrix'), 'uniform', ShaderType.VERTEX);
    static readonly LIGHT_COLOR = new ShaderUniform(Symbol('InverseTransposeMatrix'), 'uniform', ShaderType.VERTEX);
    static readonly VIEW_MATRIX = new ShaderUniform(Symbol('InverseTransposeMatrix'), 'uniform', ShaderType.VERTEX);

    static readonly AMBIENT_LIGHT = new ShaderUniform(Symbol('InverseTransposeMatrix'), 'uniform', ShaderType.VERTEX);
    static readonly DIFFUSE_LIGHT = new ShaderUniform(Symbol('InverseTransposeMatrix'), 'uniform', ShaderType.VERTEX);
    static readonly SPECULAR_LIGHT = new ShaderUniform(Symbol('InverseTransposeMatrix'), 'uniform', ShaderType.VERTEX);

    constructor(public id: ShaderUniformId,
                public type: ShaderUniformType,
                public visibility: ShaderType,
                public size: number = 0, // TODO: Size here or in the ShaderStruct class
                // public properties: SamplerProps | TextureProps | UniformProps) { TODO:
    ) {
    }
}

export class ShaderUniformGroup {
    static readonly WORLD_GROUP: ShaderUniformGroup = new ShaderUniformGroup('World', 192,
        [ShaderUniform.MVP, ShaderUniform.MODEL_MATRIX, ShaderUniform.MODEL_INVERSE_TRANSPOSE]);

    static readonly DIRECTIONAL_LIGHT_GROUP: ShaderUniformGroup = new ShaderUniformGroup('Light', 48,
        [ShaderUniform.LIGHT_DIRECTION, ShaderUniform.LIGHT_COLOR, ShaderUniform.VIEW_MATRIX]);

    static readonly MATERIAL: ShaderUniformGroup = new ShaderUniformGroup('Material', 64,
        [ShaderUniform.AMBIENT_LIGHT, ShaderUniform.DIFFUSE_LIGHT, ShaderUniform.SPECULAR_LIGHT]);


    constructor(public name: string, public size: number, public layout: ShaderUniform[]) {
    }
}