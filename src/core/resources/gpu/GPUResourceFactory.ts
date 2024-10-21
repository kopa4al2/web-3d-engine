import { BufferFormat, BufferUsage } from "core/buffer/Buffer";
import LightSource from "core/components/camera/LightSource";
import GPUMesh, { StaticGpuUniforms } from "core/components/GPUMesh";
import Graphics from "core/Graphics";
import PropertiesManager from "core/PropertiesManager";
import {
    BindGroupBuffers,
    BindGroupLayout,
    FragmentShader,
    FragmentUniformInfo,
    IndexBuffer,
    ShaderType,
    VertexBuffer,
    VertexBufferLayout,
    VertexShader
} from "core/shaders/Shader";
import Texture from "core/texture/Texture";
import { vec3 } from "gl-matrix";
import log from "util/Logger";
import glFragmentShader from 'webgl/shaders/basic/fragmentShader.frag';
import glVertexShader from 'webgl/shaders/basic/vertexShader.vert';
import WebGPUGraphics from "webgpu/graphics/WebGPUGraphics";
import gpuFragmentShader from 'webgpu/shaders/fragmentShader.wgsl';
import gpuVertexShader from 'webgpu/shaders/vertexShader.wgsl';
import gpuTerrainVertexShader from 'webgpu/shaders/terrain/terrainVertexShader.wgsl';
import glTerrainVertexShader from 'webgl/shaders/terrain/terrainVertexShader.vert';
import gpuTerrainFragmentShader from 'webgpu/shaders/terrain/terrainFragmentShader.wgsl';
import glTerrainFragmentShader from 'webgl/shaders/terrain/terrainFragmentShader.frag';
import Engine from "../../../Engine";

export default class GPUResourceFactory {

    constructor(private graphics: Graphics) {
    }

    getMaterialShader() {
        if (this.graphics instanceof WebGPUGraphics) {
            return gpuFragmentShader;
        } else {
            return glFragmentShader
        }
    }

    getGeometryShader() {
        if (this.graphics instanceof WebGPUGraphics) {
            return gpuVertexShader;
        } else {
            return glVertexShader;
        }
    }

    getTerrainGeometryShader() {
        if (this.graphics instanceof WebGPUGraphics) {
            return gpuTerrainVertexShader;
        } else {
            return glTerrainVertexShader;
        }
    }

    getTerrainFragmentShader() {
        if (this.graphics instanceof WebGPUGraphics) {
            return gpuTerrainFragmentShader;
        } else {
            return glTerrainFragmentShader;
        }
    }

    createMesh(vertexShader: VertexShader, fragmentShader: FragmentShader): GPUMesh {
        const { layout, vertices, indices, stride, vertexCount, } = vertexShader;
        let indexBuffer: IndexBuffer | undefined;
        if (indices) {
            const id = this.graphics.createBufferWithData({
                name: 'index',
                byteLength: indices.byteLength,
                usage: BufferUsage.INDEX | BufferUsage.COPY_DST
            }, indices);

            indexBuffer = { id, indices: indices.length }
        }

        const vertexBufferId = this.graphics.createBufferWithData({
            name: 'vertex',
            byteLength: vertices.byteLength,
            usage: BufferUsage.VERTEX | BufferUsage.COPY_DST
        }, vertices);

        const shaderLayout: VertexBufferLayout[] = [];
        let lastEl = 0, lastOffset = 0;
        for (let i = 0; i < layout.length; i++) {
            const { dataType, elementsPerVertex } = layout[i];
            const format = `${dataType}x${elementsPerVertex}` as BufferFormat;

            lastOffset = lastOffset + Float32Array.BYTES_PER_ELEMENT * lastEl;
            shaderLayout.push({
                offset: lastOffset,
                format: format,
                location: i
            });
            lastEl = elementsPerVertex;
        }

        const vertexBuffers: VertexBuffer[] = [{
            layout: shaderLayout,
            id: vertexBufferId,
            stride,
            vertexCount
        }];

        const worldUniformsBuffer = this.graphics.createBuffer({
            name: 'World',
            usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
            byteLength: 192  // MVP + model matrix + inverse transpose
        });

        const lightUniformsBuffer = this.graphics.createBuffer({
            name: 'Light',
            usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
            byteLength: 48 // light direction + light color + eye of the camera
        });

        const bindGroups: BindGroupLayout[] = [
            {
                groupNumber: 0,
                uniformName: 'World',
                targetShader: ShaderType.VERTEX,
                buffers: [
                    { type: 'uniform', bindNumber: 0, name: 'World', id: worldUniformsBuffer },
                ]
            },
            {
                groupNumber: 1,
                uniformName: 'Light',
                targetShader: ShaderType.FRAGMENT,
                buffers: [
                    { type: 'uniform', bindNumber: 1, name: 'Light', id: lightUniformsBuffer },
                ]
            },
        ];

        const uniformByGroup = new Map<number, Map<number, FragmentUniformInfo[]>>();
        for (let uniform of fragmentShader.uniforms) {
            let bindingMap = uniformByGroup.get(uniform.group);
            if (!bindingMap) {
                bindingMap = new Map();
                uniformByGroup.set(uniform.group, bindingMap);
            }
            let values = bindingMap.get(uniform.binding);
            if (!values) {
                values = [];
                bindingMap.set(uniform.binding, values);
            }
            values.push(uniform);
        }

        log.infoGroup('UniformByGroupValues' , uniformByGroup.values());
        for (let [group, byBinding] of uniformByGroup) {
            const textures: BindGroupBuffers[] = [];
            let joinBuffer: number[] = [];
            let uniformName = byBinding.get(0)![0].name,
                targetShader = byBinding.get(0)![0].visibility;
            for (let [binding, uniforms] of byBinding) {
                for (let uniformInfo of uniforms) {
                    const { type, name, visibility, value } = uniformInfo;
                    if (type === 'float32Array') {
                        (value as Float32Array).forEach(val => joinBuffer.push(val));
                        console.log('Joining uniform buffer: ', name)
                        uniformName = name;
                        targetShader = visibility;
                    }
                     else if (type === 'texture' && value instanceof Texture) {
                        const textureId = this.graphics.createTexture(value.imageData, value.name);
                        textures.push({ type: 'texture', bindNumber: binding, name: value.name, id: textureId });
                    }
                    else if (type === 'sampler') {
                        const samplerId = this.graphics.createSampler();
                        textures.push({ type: 'sampler', bindNumber: binding, name: (value as Texture).name, id: samplerId })
                    } else {
                        debugger
                    }
                }


                if (joinBuffer.length > 0) {
                    const joinBufferFloat = new Float32Array(joinBuffer);
                    const bufferId = this.graphics.createBufferWithData({
                        name: `joined-group-${group}-binding-${binding}`,
                        byteLength: joinBufferFloat.byteLength,
                        usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
                    }, joinBufferFloat);
                    textures.push({ type: 'uniform', id: bufferId, bindNumber: binding, name: uniformName });
                    joinBuffer = [];
                }
            }

            const currentGroup = bindGroups.find(grp => grp.groupNumber === group);
            if (!currentGroup) {
                bindGroups.push({
                    groupNumber: group, uniformName, targetShader,
                    buffers: textures,
                });
            } else {
                currentGroup.buffers = [...currentGroup.buffers, ...textures];
            }
        }

        const shader = {
            fragmentShaderSource: fragmentShader.shaderSource,
            vertexShaderSource: vertexShader.shaderSource,
            bindGroups,
            indexBuffer,
            vertexBuffers
        }

        const pipelineId = this.graphics.initPipeline(shader);

        return new GPUMesh(shader,
            new StaticGpuUniforms(worldUniformsBuffer, lightUniformsBuffer),
            pipelineId);
    }
}

function groupBy<T, K, V>(values: T[], consumer: (t: T) => K): Map<K, T[]> {
    return values.reduce((acc, obj) => {
        const key = consumer(obj);
        if (!acc.has(key)) {
            acc.set(key, []);
        }
        acc.get(key).push(obj);
        return acc;
    }, new Map());
}