import Component from "core/components/Component";
import { FragmentShader, FragmentUniformInfo, ShaderType } from "core/shaders/Shader";
import Texture from "core/texture/Texture";
import { vec3, vec4 } from "gl-matrix";

export interface MaterialProps {
    fragmentShaderSource: string,
    textures: Texture[],
    texturesOffset?: number,            // The offset in binding groups where texture mapping begins. Applicable only if textures are present
    color? : vec3,

    name: string
    ambient: vec3;                      // Ka
    diffuse: vec3;                      // Kd
    specular: vec3;                     // Ks
    shininess: number;                  // Ns
    indexOfRefraction?: number;         // Ni
    transparency?: number;              // d
    illuminationModel: number;          // illum
}

export const defaultProps: MaterialProps = {
    fragmentShaderSource: '',// TODO: Its set to empty string to satisfty typescript, however its better if its required
    // ambient: vec3.fromValues(1.0, 0.15, 0.15),
    ambient: vec3.fromValues(0.15, 0.15, 0.15),
    illuminationModel: 0,
    shininess: 10.0,
    specular: vec3.fromValues(0.9, 0.9, 0.9),
    name: 'n/a',
    diffuse: vec3.fromValues(0.2, 0.45, 0.47),
    textures: []
}

export default abstract class MaterialComponent implements Component {
    public static readonly ID = Symbol('MaterialComponent');
    id: symbol = MaterialComponent.ID;

    protected constructor(public shader: FragmentShader, public properties?: MaterialProps) {
    }


    protected static createBindGroup(group: number, name: string, binding: number, visibility: ShaderType, data: (Float32Array | number[] | vec3 | vec4)[]): FragmentUniformInfo[] {
        return data.map(value => ({ type: 'float32Array', binding, group, name, visibility, value: value as Float32Array }));
    }
}