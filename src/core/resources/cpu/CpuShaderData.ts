/**
 * CPU DATA
 */
export interface VertexLayout {
    stride: number,
    entries: VertexLayoutEntry[],
}
export interface VertexLayoutEntry {
    dataType: BufferDataType,
    elementsPerVertex: number,
}

export type BufferDataType = 'float32';


export type ShaderProgramName = `${VertexShaderName}_${FragmentShaderName}`;

export enum FragmentShaderName {
    BASIC,
    SPHERE,
    BASIC_INSTANCED,
    BASIC_WITH_LIGHT,
    TERRAIN,
}
export enum VertexShaderName {
    BASIC,
    SPHERE,
    BASIC_INSTANCED,
    BASIC_WITH_LIGHT,
    TERRAIN,
}
export enum ShaderStage {
    ONE = 0,
    TWO = 1,
    THREE = 3,
}