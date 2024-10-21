import { vec3, vec4 } from "gl-matrix";
import ShaderProgram from "../core/shaders/ShaderProgram";
import Canvas from "../Canvas";
import WebGlShaderProgram from "./WebGlShaderProgram";

class GLContext {
    public gl: WebGL2RenderingContext;
    public static sgl: WebGL2RenderingContext;

    activeShader: ShaderProgram | null = null;

    public constructor(canvas: Canvas) {
        const gl = canvas.getWebGl2Context();

        if (!gl) {
            throw "Webgl2 is not supported"
        }

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        this.gl = gl;
        GLContext.sgl = gl;//TODO REMOVE ME
    }


    createVBO(data: Float32Array): WebGLBuffer {
        const vbo = this.gl.createBuffer();

        if (!vbo) {
            throw 'Vbo was not created';
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);

        return vbo;
    }

    createVAO(vbo: WebGLBuffer): WebGLVertexArrayObject {
        const vao = this.gl.createVertexArray();

        if (!vao) {
            throw 'VAO was not created';
        }

        this.gl.bindVertexArray(vao);
        // this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);

        this.gl.vertexAttribPointer(0, 3, this.gl.FLOAT, false, 0, 0);

        this.gl.enableVertexAttribArray(0);

        return vao;
    }

    createVAOText(vbo: WebGLBuffer): WebGLVertexArrayObject {
        const vao = this.gl.createVertexArray();

        if (!vao) {
            throw 'VAO was not created';
        }

        this.gl.bindVertexArray(vao);
        // this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);

        this.gl.vertexAttribPointer(0, 3, this.gl.FLOAT, false, 5 * Float32Array.BYTES_PER_ELEMENT, 0);
        this.gl.vertexAttribPointer(1, 2, this.gl.FLOAT, false, 5 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);

        this.gl.enableVertexAttribArray(0);
        this.gl.enableVertexAttribArray(1);

        return vao;
    }

    createTexture(imageBitmap: ImageBitmap) {
        const texture = this.gl.createTexture();

        if (!texture) {
            throw 'Texture could not be created';
        }

        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, imageBitmap);

        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

        // this.gl.generateMipmap(this.gl.TEXTURE_2D);

       /* this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

        // Fill the texture with a 1x1 blue pixel while the image loads
        const level = 0;
        const internalFormat = this.gl.RGBA;
        const width = 1;
        const height = 1;
        const border = 0;
        const srcFormat = this.gl.RGBA;
        const srcType = this.gl.UNSIGNED_BYTE;
        const pixel = new Uint8Array([0, 0, 255, 255]);  // Opaque blue

        this.gl.texImage2D(this.gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, pixel);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, imageBitmap);

        // Set the texture parameters (e.g., filtering, wrapping)
        // if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
        //     this.gl.generateMipmap(this.gl.TEXTURE_2D);  // Generate mipmaps for better scaling
        // } else {
            // No mipmaps for non-power-of-2 textures
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        // }
*/
        return texture;
    }

    useShader(shaderProgram: ShaderProgram) {
        (shaderProgram as WebGlShaderProgram)
        if (this.activeShader !== shaderProgram) {
            this.activeShader?.unbind();
            this.activeShader = shaderProgram;
            this.activeShader.link();
            this.activeShader.bind();
        }
    }

    clearColor(color: vec3 | vec4): void {
        const [r, g, b, a = 1.0] = color;

        this.gl.clearColor(r, g, b, a);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }

}

export default GLContext;