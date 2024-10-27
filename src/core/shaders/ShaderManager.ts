// @ts-nocheck
import { GPUShader, ShaderDescription, ShaderType, UniformInfo, VertexLayout } from "core/shaders/GPUShader";
import Texture from "core/texture/Texture";

export type ShaderId = symbol;
export type VertexShaderName = 'default' | 'terrain' | 'debugLight';
export type FragmentShaderName = 'default' | 'terrain' | 'debugLight';
export type ShaderName = VertexShaderName | FragmentShaderName;

class ShaderManager {

    private shaders: Record<ShaderId, string> = {};
    // private shaders: Map<ShaderId, string> = new Map();
    private shadersByName: Partial<Record<ShaderName, ShaderId>> = {};

    async loadShader(shaderUrl: string, name: ShaderName): Promise<ShaderId> {
        const shaderSource = await fetch(shaderUrl)
            .then(response => response.text());

        return this.registerShader(shaderSource, name);
    }

    registerShader(shaderSource: string, name: ShaderName) {
        const id = Symbol(`shader-${name}`);
        this.shaders[id] = shaderSource;
        // this.shaders.set(id, shaderSource);
        return id;
    }

    getShaderByName(name: ShaderName) {
        const shaderId = this.shadersByName[name]!;
        return this.shaders[shaderId];
    }

    getShaderSource(id: ShaderId): string {
        return this.shaders[id];
    }

    removeShader(id: ShaderId) {
        delete this.shaders[id];
    }
}

function isName(type: ShaderId | ShaderName): type is ShaderName {
    return typeof type === 'string';
}

export default new ShaderManager();

interface ShaderDescription {

}

function basicGeometryShader() {
    const shaderSource: ShaderName = 'defaultVertex';
    const layout: VertexLayout[] = [
        { dataType: 'float32', elementsPerVertex: 3 },
        { dataType: 'float32', elementsPerVertex: 3 },
        { dataType: 'float32', elementsPerVertex: 2 }];

    const stride = layout.map(l => l.elementsPerVertex).reduce((prev, current) => prev + current, 0) * Float32Array.BYTES_PER_ELEMENT;

    const uniformsNeeded = [
        {
            name: 'World', group: 0, binding: 0,
            values: [{
                name: 'MVP',
                size: 64
            }, {
                name: 'ModelMatrix',
                size: 64,
            }, {
                name: 'ModelInverseTranspose',
                size: 64,
            }]
        }
    ]
}


function basicFragmentShader() {
    const shaderSource: ShaderName = 'defaultFragment';

    const uniformsNeeded = [{
        name: 'Material',
        group: 1,
        binding: 0,
        values: [
            {
                name: 'ambientLight',
                size: 16
            },
            {
                name: 'diffuseLight',
                size: 16
            },
            {
                name: 'specularLight',
                size: 16
            },
        ]
    }, {
        name: 'Light',
        group: 1,
        binding: 1,
        values: [
            {
                name: 'direction',
                size: 16
            },
            {
                name: 'color',
                size: 16
            },
            {
                name: 'viewPosition',
                size: 16
            },
        ]
    }];

    const texturesNeeded = [{
        group: 1,
        binding: 2,
    }]

    const samplersNeeded = [{
        group: 1,
        binding: 3,
    }]
}