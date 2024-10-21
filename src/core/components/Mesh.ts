import { FragmentShader, Shader } from "core/shaders/Shader";
import Component from "./Component";
import GLContext from "../../webgl/GLContext";
import ShaderProgram from "../shaders/ShaderProgram";
import { vec3, vec4 } from "gl-matrix";
import Texture from "../texture/Texture";

export interface Geometry {
    vertices: Float32Array;
    indices?: Uint16Array;
    normals?: Float32Array;
    uvs?: Float32Array;
}

export interface Material {
    color: Float32Array
    texture: Texture;
    shaderProgram: ShaderProgram;
}

export default abstract class Mesh implements Component {
    static readonly ID: symbol = Symbol("Mesh");
    readonly id: symbol = Mesh.ID;

    protected constructor(public geometry: Geometry, public material: Material) {
    }
}