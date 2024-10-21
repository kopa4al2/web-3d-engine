import { mat4, vec3, vec4 } from "gl-matrix";
import Mesh from "../components/Mesh";


export default abstract class ShaderProgram {
    protected constructor(vertexShaderSource: string, fragmentShaderSource: string) {

    }

    public abstract link() :void;
    public abstract bind() :void;
    public abstract unbind() :void;
    public abstract setUniform(name: string, value: vec3 | vec4 | mat4) :void;
    public abstract setAttributeLocation(name: string, buffer: WebGLBuffer, size:number, type? :number) :void;

    public abstract visit(mesh: Mesh) :void;
}