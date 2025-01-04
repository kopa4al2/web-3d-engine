import { Blend, BlendConfig, BlendFactor, BlendOperation } from 'core/resources/gpu/Blend';

const BlendOperationToGl: Record<BlendOperation, (gl: WebGL2RenderingContext) => GLenum> = {
    'reverse-subtract': gl => gl.FUNC_REVERSE_SUBTRACT,
    add: gl => gl.FUNC_ADD,
    max: gl => gl.MAX, // this probably isnt working
    min: gl => gl.MIN, // this probably isnt working
    subtract: gl => gl.FUNC_SUBTRACT

}

const BlendFactorToGl: Record<BlendFactor, (gl: WebGL2RenderingContext) => GLenum> = {
    "one-minus-src-alpha"(gl: WebGL2RenderingContext): GLenum {
        return gl.ONE_MINUS_SRC_ALPHA;
    }, "src-alpha"(gl: WebGL2RenderingContext): GLenum {
        return gl.SRC_ALPHA;
    }, one(gl: WebGL2RenderingContext): GLenum {
        return gl.ONE;
    }, zero(gl: WebGL2RenderingContext): GLenum {
        return gl.ZERO;
    }

}

export class BlendModeConverter {

    public static setDepthCompare(gl: WebGL2RenderingContext, depthCompare: 'less' | 'greater' | 'equal' | 'always' | 'never' | 'less-equal') {
        if (depthCompare === 'less') {
            gl.depthFunc(gl.LESS);
        } else if (depthCompare === 'greater') {
            gl.depthFunc(gl.GREATER);
        } else {
            gl.depthFunc(gl.EQUAL);
        }
    }

    public static setBlendMode(gl: WebGL2RenderingContext, blend?: Blend) {
        if (!blend) {
            gl.disable(gl.BLEND);
            return;
        }

        gl.enable(gl.BLEND);

        this.setBlendOperation(blend, gl);

        gl.blendFuncSeparate(
            BlendFactorToGl[blend.color.srcFactor || 'zero'](gl),
            BlendFactorToGl[blend.color.dstFactor || 'zero'](gl),
            BlendFactorToGl[blend.alpha.srcFactor || 'zero'](gl),
            BlendFactorToGl[blend.alpha.dstFactor || 'zero'](gl))
    }

    private static setBlendOperation(blend: Blend, gl: WebGL2RenderingContext) {
        if (blend.alpha.operation && blend.color.operation) {
            gl.blendEquationSeparate(
                BlendOperationToGl[blend.color.operation](gl),
                BlendOperationToGl[blend.alpha.operation](gl));
        } else if (blend.color.operation) {
            gl.blendEquation(BlendOperationToGl[blend.color.operation](gl))
        } else {
            console.warn('WebGl2 probably doesnt support setting just the alpha blend function. Review')
        }
    }
}
