import Component from "core/components/Component";
import { PipelineId } from "core/Graphics";
import { VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import Texture from "core/texture/Texture";
import { vec3 } from "gl-matrix";

export interface MaterialProps {
    shaderName: VertexShaderName,
    textures: Texture[],
    texturesOffset?: number,            // The offset in binding groups where texture mapping begins. Applicable only if textures are present
    color?: vec3,

    label: string,

    ambient: vec3;                      // Ka
    diffuse: vec3;                      // Kd
    specular: vec3;                     // Ks
    shininess: number;                  // Ns
    indexOfRefraction?: number;         // Ni
    transparency?: number;              // d
    illuminationModel: number;          // illum
}

export const defaultMaterialProps: MaterialProps = {
    shaderName: VertexShaderName.LIT_GEOMETRY,
    // ambient: vec3.fromValues(1.0, 0.15, 0.15),
    ambient: vec3.fromValues(0.15, 0.15, 0.15),
    illuminationModel: 0,
    shininess: 10.0,
    specular: vec3.fromValues(0.9, 0.9, 0.9),
    label: 'n/a',
    diffuse: vec3.fromValues(0.2, 0.45, 0.47),
    textures: []
}

export default class MaterialComponent implements Component {
    public static readonly ID = Symbol('MaterialComponent');
    id: symbol = MaterialComponent.ID;

    constructor(public shader: PipelineId) {
    }
}
