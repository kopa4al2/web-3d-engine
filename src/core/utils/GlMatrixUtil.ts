import { mat4, vec3, vec4 } from "gl-matrix";

type GlMatrixType = vec3 | vec4 | mat4;
export function isVec3(value: GlMatrixType) : value is vec3 {
    return value && value.length === 3;
    // return value && typeof value === 'object' && value.length === 3 && typeof value[0] === 'number' && typeof value[1] === 'number' && typeof value[2] === 'number';
}

export function isVec4(value: GlMatrixType) : value is vec4 {
    return value && value.length === 4;
}

export function isMat4(value: GlMatrixType) : value is mat4 {
    return value && value.length === 16;
}