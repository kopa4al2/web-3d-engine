// srcFactor and dstFactor are optional in webgpu. In webgl2 we can mimic this by replacing
// gl.ONE with missing src factor or
// gl.ZERO for missing dstFactor
export interface BlendConfig {
    srcFactor?: BlendFactor,
    dstFactor?: BlendFactor,
    operation?: BlendOperation,
}

export interface Blend {
    color: BlendConfig
    alpha: BlendConfig,
}

export type BlendOperation = | 'add'
    | 'subtract'
    | 'reverse-subtract'
    | 'min'
    | 'max';
export type BlendFactor = | 'zero'
    | 'one'
    | 'one-minus-src-alpha'
    | 'src-alpha' // TODO: Enable other modes when needed
    // | 'src'
    // | 'one-minus-src'
    // | 'dst'
    // | 'one-minus-dst'
    // | 'dst-alpha'
    // | 'one-minus-dst-alpha'
    // | 'src-alpha-saturated'
    // | 'constant'
    // | 'one-minus-constant'
    // | 'src1'
    // | 'one-minus-src1'
    // | 'src1-alpha'
    // | 'one-minus-src1-alpha';


export const BlendPresets: Record<'TRANSPARENT' | 'GLOW' | string, Blend> = {
    TRANSPARENT: {
        color: {
            srcFactor: 'src-alpha',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add'
        },
        alpha: {
            srcFactor: 'one',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add'
        }
    },
    GLOW: {
        color: {
            srcFactor: 'src-alpha',
            dstFactor: 'one',
            operation: 'add'
        },
        alpha: {
            srcFactor: 'one',
            dstFactor: 'one',
            operation: 'add'
        }
    }
}
