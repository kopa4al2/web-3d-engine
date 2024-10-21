import { mat4, vec3, vec4 } from "gl-matrix";
import { isMat4, isVec3, isVec4 } from "../core/utils/GlMatrixUtil";
import ShaderProgram from "../core/shaders/ShaderProgram";
import Mesh from "../core/components/Mesh";

export default class WebGlShaderProgram extends ShaderProgram {
    public visit(mesh: Mesh): void {
        throw new Error("Method not implemented.");
    }

    private glProgram: WebGLProgram;


    constructor(private gl: WebGL2RenderingContext, vertexShaderSource: string, fragmentShaderSource: string) {
        super(vertexShaderSource, fragmentShaderSource);

        const vertexShader = this.loadShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.loadShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

        this.glProgram = gl.createProgram() as WebGLProgram;
        gl.attachShader(this.glProgram, vertexShader);
        gl.attachShader(this.glProgram, fragmentShader);

    }

    public link() {
        if (!this.glProgram) {
            throw `Shader program is not initialized`;
        }

        const gl = this.gl;
        gl.linkProgram(this.glProgram);

        if (!gl.getProgramParameter(this.glProgram, gl.LINK_STATUS)) {
            alert(
                `Unable to initialize the shader program: ${gl.getProgramInfoLog(this.glProgram)}`,
            );
            console.error(gl.getProgramInfoLog(this.glProgram));
            throw "Error creating the shader program";
        }
    };
    public bind() {
        this.gl.useProgram(this.glProgram);
    }

    public unbind() {
        this.gl.useProgram(null);
    }

    setUniform(name: string, value: vec3 | vec4 | mat4) {
        const location = this.gl.getUniformLocation(this.glProgram, name);
        if (location === null) {
            throw `Uniform ${name} not found in shader program`;
        }

        if (isVec3(value)) {
            this.gl.uniform3fv(location, value);
        } else if (isVec4(value)) {
            this.gl.uniform4fv(location, value);
        } else if (isMat4(value)) {
            this.gl.uniformMatrix4fv(location, false, value);
        } else {
            throw `Unsupported uniform type for ${name} - ${typeof value}`;
        }

    };

    setTexture(samplerName: string, value: number) {
        const samplerUniformLocation = this.gl.getUniformLocation(this.glProgram, samplerName);
        this.gl.uniform1i(samplerUniformLocation, value);
    }

    public setAttributeLocation(attributeName: string, buffer: WebGLBuffer, size:number, type? :GLenum) {
        const gl = this.gl;
        const location = gl.getAttribLocation(this.glProgram, attributeName);
        if (location === -1) {
            throw `Attribute ${attributeName} not found in shader program`;
        }

        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(location, size, type || gl.FLOAT, normalize, stride, offset);
        gl.enableVertexAttribArray(location);
    }


    private loadShader(type: GLenum, source: string) {
        const gl = this.gl;
        const shader = gl.createShader(type) as WebGLShader;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const shaderType = (type ^ gl.VERTEX_SHADER) ? "FRAGMENT_SHADER" : "VERTEX_SHADER";
            alert(
                `An error occurred compiling ${shaderType} shaders: ${gl.getShaderInfoLog(shader)}`,
            );
            console.log(gl.getShaderInfoLog(shader))
            gl.deleteShader(shader);
            throw 'Error creating shader ' + shaderType;
        }

        return shader;
    }
}