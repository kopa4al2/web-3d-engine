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

export enum FragmentShaderName {
    SKY_BOX,
    PHONG_LIT,
    UNLIT,
    BASIC,
    BASIC_INSTANCED,
    TERRAIN,
    PBR,
}
export enum VertexShaderName {
    SKY_BOX= 100,
    LIT_GEOMETRY,
    UNLIT_GEOMETRY,
    TERRAIN,
    LIT_TANGENTS_VEC4,
    SKINNED_LIT,
    UNUSED_OLD_BASIC_INSTANCED,
}
