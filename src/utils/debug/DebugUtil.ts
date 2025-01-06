export default class DebugUtil {

  public static glEnumToString(number: number): string {
    if (number >= 33984 && number < 34013) {
      return `TEXTURE${number - 33984}`;
    }

    // @ts-ignore
    return GL_DEBUG_VALUES[number] || `N/A ${Number(number).toString(16)}`;
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

  public static printProgramUniform(gl: WebGL2RenderingContext) {
    const program = gl.getParameter(gl.CURRENT_PROGRAM);
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    console.log('Number of uniforms: ', numUniforms);
    for (let i = 0; i < numUniforms; i++) {
      const uniformInfo = gl.getActiveUniform(program, i);
      console.log(`Uniform info`, uniformInfo);
    }
  }
  public static printProgramUBO(gl: WebGL2RenderingContext) {
    const program = gl.getParameter(gl.CURRENT_PROGRAM);
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    const numBlocks = gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS);

    console.log(`Active Uniforms: ${numUniforms}`);
    console.log(`Active Uniform Blocks: ${numBlocks}`);

    const standaloneUniforms = [];
    const uboMembers = [];

    for (let i = 0; i < numUniforms; i++) {
      const uniformInfo = gl.getActiveUniform(program, i)!;

      // Check if the uniform is part of a UBO
      const blockIndex = gl.getActiveUniforms(program, [i], gl.UNIFORM_BLOCK_INDEX)[0];

      if (blockIndex === -1) {
        // Standalone uniform
        standaloneUniforms.push(uniformInfo.name);
        console.log(`Standalone Uniform: ${uniformInfo.name}`);
      } else {
        // Uniform block member
        uboMembers.push(uniformInfo.name);
        console.log(`UBO Member: ${uniformInfo.name}, Block Index: ${blockIndex}`);
      }
    }
  }
  public static glCheckError(gl: WebGL2RenderingContext, texture?: WebGLTexture | null, ...any: any) {
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
      console.groupCollapsed('GL error');
      console.log('Current program', gl.getParameter(gl.CURRENT_PROGRAM));
      // console.log('Current vertex attrib', gl.getParameter(gl.CURRENT_VERTEX_ATTRIB));
      if (texture) {
        console.log('ActiveTexture: ', gl.getParameter(gl.ACTIVE_TEXTURE),
          'TEXTURE0', gl.TEXTURE0,
          'diff: ', gl.getParameter(gl.ACTIVE_TEXTURE) - gl.TEXTURE0); // Ensure it's gl.TEXTURE0
        console.log('Is texture: ', gl.isTexture(texture)); // Ensure the texture is valid
      }
      // console.log('--- UBO ---');
      // this.printProgramUBO(gl);
      // console.log('--- Uniforms ---');
      // this.printProgramUniform(gl);
      // console.log('-----');
      console.log('Extra info: ', any);
      console.error('WebGL Error:', DebugUtil.glEnumToString(error));
      console.groupEnd();
    }
  }

  public static addToWindowObject(label: string, any: any) {
    if (typeof window === 'undefined') {
      return;
    }

    // @ts-ignore
    if (!window[label]) {
      // @ts-ignore
      window[label] = any;
    }
  }

  public static getRandomColorStyle(): string {
    const r = Math.floor(Math.random() * 255);
    const g = Math.floor(Math.random() * 255);
    const b = Math.floor(Math.random() * 255);
    let color = `#ffffff`;
    if (r + g + b > (255 * 3) / 2) {
      color = `#000000`;
    }
    return `background: rgb(${r}, ${g}, ${b}); color: ${color};`;
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
  0x0B71: 'DEPTH_TEST',
  0x8CAC: 'DEPTH_COMPONENT32F',
  0x1902: 'DEPTH_COMPONENT',
} as const;
