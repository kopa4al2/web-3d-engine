export default class DebugUtil {

    public static glEnumToString(number: number): string {
        if (number >= 33984 && number < 34013) {
            return `TEXTURE${ number - 33984 }`
        }

        // @ts-ignore
        return GL_DEBUG_VALUES[number] || `N/A ${ number }`
        // if (number === 0x8A11) {
        //     return 'UNIFORM_BUFFER'
        // }
        //
        // if (number === 0x8892) {
        //     return 'ARRAY_BUFFER'
        // }
        //
        // if (number === 0x8893) {
        //     return 'ELEMENT_ARRAY_BUFFER'
        // }
        //
        // if (number === 0x8058) {
        //     return 'RGBA8'
        // }
        //
        // return `N/A ${ number }`;
    }

    public static glCheckError(gl: WebGL2RenderingContext, texture: WebGLTexture) {
        const error = gl.getError();
        if (error !== gl.NO_ERROR) {
            console.log('ActiveTexture: ', gl.getParameter(gl.ACTIVE_TEXTURE), 'TEXTURE0', gl.TEXTURE0, 'diff: ', gl.getParameter(gl.ACTIVE_TEXTURE) - gl.TEXTURE0); // Ensure it's gl.TEXTURE0
            console.log('Is texture: ', gl.isTexture(texture)); // Ensure the texture is valid
            console.error('WebGL Error:', DebugUtil.glEnumToString(error));
        }
    }

    public static addToWindowObject(label: string, any: any) {
        // @ts-ignore
        if (!window[label]) {
            // @ts-ignore
            window[label] = any;
        }
    }
}

const GL_DEBUG_VALUES = {
    0x8A11: 'UNIFORM_BUFFER',
    0x8892: 'ARRAY_BUFFER',
    0x8893: 'ELEMENT_ARRAY_BUFFER',
    0x8058: 'RGBA8',
    0x1908: 'RGBA',
    0x881A: 'RGBA16F',
    0x8814: 'RGBA32F',
    0x8C43: 'SRGB8_ALPHA8',
    0x1401: 'UNSIGNED_BYTE',
    0x1405: 'UNSIGNED_INT',
    0x1406: 'FLOAT',
    0x0500: 'INVALID_ENUM',
    0x0501: 'INVALID_VALUE',
    0x0502: 'INVALID_OPERATION',
    0x0505: 'OUT_OF_MEMORY',
} as const
