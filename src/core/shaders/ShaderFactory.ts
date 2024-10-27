import { ShaderType } from "core/shaders/GPUShader";
import ShaderStruct, { ShaderVariable, ShaderVariableType } from "core/shaders/ShaderStruct";

export interface ShaderLayout {
    input?: ShaderVariable[],
    output?: ShaderVariable[],
    uniforms?: ShaderStruct[],
    textures?: ShaderStruct[],
    shaderType: ShaderType,
    code: string,
}

export default abstract class ShaderFactory {

    // public createAllShaders(shaderLayout: ShaderLayout): [string, string] {
    //     return [this.createVertexShader(shaderLayout), this.createFragmentShader(shaderLayout)]
    // }

    public abstract createShader(shaderLayout: ShaderLayout): string;

};

export class WebGL2ShaderFactory extends ShaderFactory {
    public createShader(shaderLayout: ShaderLayout): string {
        return `${shaderLayout.uniforms?.map(struct => this.structToCode(struct)).join('\n')}`
            + '\n'
            + `${this.textures(shaderLayout.textures)}`
            + '\n'
            + `${this.shaderInput(shaderLayout.input)}`
            + '\n'
            + `${this.shaderOutputToCode(shaderLayout.output)}`
            + '\nvoid main() {'
            + `\n${shaderLayout.code}`
            + `\n}`

    }

    shaderInput(variables?: ShaderVariable[]) {
        if (!variables || variables.length === 0) {
            return '';
        }

        return `${variables.map(
                (vari) => this.shaderInputToCode(vari))
                .join('\n')}`
            + '\n';
    }

    private shaderInputToCode(vari: ShaderVariable) {
        return `in ${this.variableToCode(vari)};`;
    }

    private shaderOutputToCode(variables?: ShaderVariable[]) {
        if (!variables || variables.length === 0) {
            return '';
        }

        return `${variables.map(
                (vari) => `out ${this.variableToCode(vari)};`)
                .join('\n')}`
            + '\n';
    }

    private structToCode(struct: ShaderStruct): string {
        return `layout(std140) uniform ${struct.name} {\n  `
            + `${struct.elements.map(el => this.variableToCode(el)).join(';\n  ')}`
            + '\n};\n'
    }


    private variableToCode(variable: ShaderVariable): string {
        return `${this.variableTypeToCode(variable.type)} ${variable.name}`
    }

    private textures(textures?: ShaderStruct[]) {
        if (!textures || textures.length === 0) {
            return '';
        }

        return textures.map(tex => tex.elements)
            .flat()
            .flatMap(texture => texture.type === ShaderVariableType.SAMPLER ? '' : `uniform sampler2D ${texture.name}\n`);
    }

    private variableTypeToCode(variableType: ShaderVariableType): string {
        switch (variableType) {
            case ShaderVariableType.VEC2:
                return 'vec2'
            case ShaderVariableType.VEC3:
                return 'vec3'
            case ShaderVariableType.VEC4:
                return 'vec4'
            case ShaderVariableType.MAT3:
                return 'mat3'
            case ShaderVariableType.MAT4:
                return 'mat4'
            case ShaderVariableType.TEXTURE:
            case ShaderVariableType.SAMPLER:
                return 'sampler2D'
            default:
                throw `unmapped variable type: ${variableType}`

        }
    }
}


export class WebGpuShaderFactory extends ShaderFactory {
    groupCounter: number = 0;
    public createShader(shaderLayout: ShaderLayout): string {
        return `${shaderLayout.uniforms?.map(struct => this.structToCode(struct)).join('\n')}`
            + '\n'
            + `${this.shaderInputToCode(shaderLayout.shaderType, shaderLayout.input)}`
            + '\n'
            + `${this.shaderOutputToCode(shaderLayout.shaderType, shaderLayout.output)}`
            + '\n'
            + `${this.textures(this.groupCounter++, shaderLayout.textures)}`
            + '\n'
            + `${this.variables(this.groupCounter++, shaderLayout.uniforms)}`
            + `\n${shaderLayout.shaderType === ShaderType.VERTEX ? '@vertex' : '@fragment'}`
            + '\nfn main(input: ) {'
            + `\n${shaderLayout.code}`
            + `\n}`
    }

    shaderInputToCode(shaderType: ShaderType, variables?: ShaderVariable[]) {
        if (!variables || variables.length === 0) {
            return '';
        }

        const inputStructName = shaderType === ShaderType.VERTEX ? 'VertexInput' : 'FragmentInput';

        return `struct ${inputStructName} {\n`
            + `${variables.map(
                (vari, index) => `  @location(${index}) ${vari.name} ${this.variableTypeToCode(vari.type)}`)
                .join(',\n')}`
            + '\n};';
    }

    shaderOutputToCode(shaderType: ShaderType, variables?: ShaderVariable[]) {
        if (!variables || variables.length === 0) {
            return '';
        }

        const outputStructName = shaderType === ShaderType.VERTEX ? 'VertexOutput' : 'FragmentOutput';
        return `struct ${outputStructName} {`
            + '\n'
            + `  @builtin(position) position: vec4<f32>,\n`
            + `${variables.map(
                (vari, index) => `  @location(${index}) ${vari.name} ${this.variableTypeToCode(vari.type)})`)
                .join(',\n')}`
            + '\n};';
    }

    private structToCode(struct: ShaderStruct): string {
        return `struct ${struct.name} {\n  `
            + `${struct.elements.map(el => this.variableToCode(el)).join(',\n  ')}`
            + '\n};\n'
    }


    private textures(group: number, textures?: ShaderStruct[]) {
        if (!textures || textures.length === 0) {
            return '';
        }

        return textures
            .map(textureGroup => textureGroup.elements)
            .flat()
            .flatMap((texture, binding) => `@group(${group}) @binding(${binding}) var ${texture.name}: ${texture.type === ShaderVariableType.TEXTURE ? 'texture_2d<f32>' : 'sampler'}`)
            .join();
    }

    private variables(group: number, uniforms?: ShaderStruct[]) {
        if (!uniforms || uniforms.length === 0) {
            return '';
        }

        return uniforms
            .map((uniform, binding) => `@group(${group}) @binding(${binding}) var<uniform> ${uniform.name.toLowerCase()}:${uniform.name};\n`)
            .join();
    }

    private variableToCode(variable: ShaderVariable): string {
        return `${variable.name}:${this.variableTypeToCode(variable.type)}`
    }

    private variableTypeToCode(variableType: ShaderVariableType): string {
        switch (variableType) {
            case ShaderVariableType.VEC2:
                return 'vec2<f32>'
            case ShaderVariableType.VEC3:
                return 'vec3<f32>'
            case ShaderVariableType.VEC4:
                return 'vec4<f32>'
            case ShaderVariableType.MAT3:
                return 'mat3x3<f32>'
            case ShaderVariableType.MAT4:
                return 'mat4x4<f32>'
            default:
                throw `unmapped variable type: ${variableType}`

        }
    }
}