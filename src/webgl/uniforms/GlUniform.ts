import DebugUtil from 'utils/debug/DebugUtil';

export default class GlUniform {
  private static boundUniforms: Record<string, number> = {};

  public static bindUniform(gl: WebGL2RenderingContext, program: WebGLProgram, name: string) {
    // const program = gl.getParameter(gl.CURRENT_PROGRAM);

    const uniformLocation = gl.getUniformLocation(program, name);
    if (uniformLocation) {
      const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < numUniforms; i++) {
        const uniformInfo = gl.getActiveUniform(program, i);
        if (uniformInfo?.name.toLowerCase() === name.toLowerCase() || uniformInfo?.name.toLowerCase().startsWith(name.toLowerCase())) {
          return;
        }
      }
      console.error(`Uniform not found: ${name} location: `, uniformLocation, 'Program ', program);
    } else {
      if (!this.boundUniforms[name]) {
        console.warn(`Registering bound uniform: ${name}`);
        this.boundUniforms[name] = Object.keys(this.boundUniforms).length;
      }

      const blockIndex = gl.getUniformBlockIndex(program, name);
      gl.uniformBlockBinding(program, blockIndex, this.boundUniforms[name]);
      DebugUtil.glCheckError(gl, null, `UBO name: ${name}`, blockIndex, this.boundUniforms[name]);
    }
  }

  public static getUniformIndex(name: string) {
    return this.boundUniforms[name];
  }

  public static registerUniform(name: string) {
    if (this.boundUniforms[name] !== undefined) {
      console.warn(`Trying to register uniform ${name} which is already present at: ${this.boundUniforms[name]}`);
      return;
    }

    // this.boundUniforms[name] = Object.keys(this.boundUniforms).length;
    this.boundUniforms[name] =  Math.max(...Object.values(this.boundUniforms), -1) + 1;
  }

  public static uniform(gl: WebGL2RenderingContext, type: GLenum, location: WebGLUniformLocation, ...values: (GLint | GLfloat)[]) {
    switch (type) {
      case gl.FLOAT:
        gl.uniform1f(location, values[0]);
        break;
      case gl.FLOAT_VEC2:
        gl.uniform2fv(location, values);
        break;
      case gl.FLOAT_VEC3:
        gl.uniform3fv(location, values);
        break;
      case gl.FLOAT_VEC4:
        gl.uniform4fv(location, values);
        break;
      case gl.INT:
      case gl.BOOL: // Booleans are set using the same functions as integers
        gl.uniform1i(location, values[0]);
        break;
      case gl.FLOAT_MAT4:
        gl.uniformMatrix4fv(location, false, values);
        break;
      case gl.SAMPLER_2D:
      case gl.SAMPLER_CUBE:
        gl.uniform1i(location, values[0]);
        break;
      default:
        console.error(`Unhandled uniform type: ${type}`);
    }
  }
}