//@ts-nocheck
import { BufferFormat, BufferId, BufferUsage } from "core/buffer/Buffer";
import { GeometryProperties, InterleavedProps } from "core/components/geometry/GeometryComponent";
import GPUMesh, { StaticGpuUniforms } from "core/components/GPUMesh";
import { MaterialProps } from "core/components/material/MaterialComponent";
import Graphics, { BindGroupId, PipelineId } from "core/Graphics";
import {
    BindGroupBuffers,
    BindGroupLayout,
    FragmentShader,
    FragmentShaderDescription,
    GlobalUniform,
    IndexBuffer,
    ShaderDescription,
    ShaderType, ShaderUniform, ShaderUniformGroup,
    UniformGroup,
    UniformInfo,
    VertexBuffer,
    VertexBufferLayout,
    VertexShader,
    VertexShaderDescription
} from "core/shaders/GPUShader";
import { FragmentShaderName, ShaderName, VertexShaderName } from "core/shaders/ShaderManager";
import Texture from "core/texture/Texture";
import JavaMap from "util/JavaMap";
import log from "util/Logger";
import glFragmentShader from 'webgl/shaders/basic/fragmentShader.frag';
import glVertexShader from 'webgl/shaders/basic/vertexShader.vert';
import glTerrainFragmentShader from 'webgl/shaders/terrain/terrainFragmentShader.frag';
import glTerrainVertexShader from 'webgl/shaders/terrain/terrainVertexShader.vert';
import WebGPUGraphics from "webgpu/graphics/WebGPUGraphics";
import gpuFragmentShader from 'webgpu/shaders/fragmentShader.wgsl';
import gpuTerrainFragmentShader from 'webgpu/shaders/terrain/terrainFragmentShader.wgsl';
import gpuTerrainVertexShader from 'webgpu/shaders/terrain/terrainVertexShader.wgsl';
import gpuVertexShader from 'webgpu/shaders/vertexShader.wgsl';

export interface Renderable {
    uniforms: ShaderUniformGroup[],
    bindGroups: BindGroupId[],
    vertexBuffer: BufferId,
    indexBuffer: BufferId,
    pipeline: PipelineId,
    vertexCount: number,
}

type ShaderDescriptionName = `${VertexShaderName}.${FragmentShaderName}`;
export default class GPUResourceFactory {

    // private shaders: Record<ShaderType, JavaMap<ShaderDescriptionName, ShaderDescription>>;
    private shaders: Partial<Record<ShaderDescriptionName, ShaderDescription>>;


    constructor(private graphics: Graphics) {
        this.shaders = {


        }
        // this.shaders = {
        //     [ShaderType.VERTEX]: new JavaMap(),
        //     [ShaderType.FRAGMENT]: new JavaMap(),
        //     [ShaderType.COMPUTE]: new JavaMap(),
        // }
    }


    createGpuMeshFromDescr(shaderDescription: ShaderDescription) {
        // Create objects needed for graphics API
        // Create buffers
        // Compose a single Mesh object
    }
    createMeshV3(vertexShaderName: ShaderName, geometry: GeometryProperties | InterleavedProps,
                 fragmentShaderName: ShaderName, materialProps: Partial<MaterialProps>) {
        // @ts-ignore
        const vertexShaderDescription = this.shaders[ShaderType.VERTEX].get(vertexShaderName) as VertexShaderDescription;
        // @ts-ignore
        const fragmentShaderDescription = this.shaders[ShaderType.FRAGMENT].get(vertexShaderName) as FragmentShaderDescription;
        // TODO: Maybe validate shader is present, and maybe validate geometry fits into layout
        let vertexData: Float32Array,
            vertexCount: number,
            indices: Uint16Array | Uint32Array = geometry.indices;
        if ((geometry as InterleavedProps).data) {
            vertexData = (geometry as InterleavedProps).data;
            vertexCount = (geometry as InterleavedProps).vertexCount;
        } else {
            const { vertices, normals, texCoords } = geometry as GeometryProperties;
            // TODO: Handle needed data based on buffer layout
            vertexData = new Float32Array();
            // vertexData = interleaveData(vertices, normals, texCoords);
            vertexCount = vertices.length;
        }


        const { layout, uniforms } = vertexShaderDescription;
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
            byteLength: vertexData.byteLength,
            usage: BufferUsage.VERTEX | BufferUsage.COPY_DST
        }, vertexData);

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
        const stride = layout.map(l => l.elementsPerVertex).reduce((prev, curr) => prev + curr, 0) * Float32Array.BYTES_PER_ELEMENT;
        log.infoGroup('STRIDE', stride);
        const vertexBuffers: VertexBuffer[] = [{
            layout: shaderLayout,
            id: vertexBufferId,
            stride,
            vertexCount
        }];

        // TODO: I need to expose those buffers
        for (let uniform of uniforms) {
            this.graphics.createShaderGroup()
            this.graphics.createBuffer({
                name: uniform.shaderUniformGroup.name,
                usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
                byteLength: uniform.shaderUniformGroup.size
            })
        }

        // FRAGMENT SHADER
        for (let uniformStruct of fragmentShaderDescription.uniforms) {
            const { group, binding, visibility, shaderUniformGroup } = uniformStruct;
            const { name, layout, size } = shaderUniformGroup;
            const data = new Float32Array(size);
            let offSet = 0;
            for (let globalUniform of layout) {
                // TODO: May handle padding here
                const element = this.getDataByUniform(globalUniform, materialProps);
                if (!element) {
                    console.error(`${globalUniform} not present in material props but required by shader`, materialProps);
                    continue;
                }
                data.set(element, offSet);
                offSet += element?.length
            }
            // TODO: Save buffer to send it
            this.graphics.createBufferWithData({
                name: `${name}-uniform[${group}][${binding}]`,
                byteLength: size,
                usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
            }, new Float32Array());
        }
        const uniformByGroup = this.groupByGroupNumber(fragmentShaderDescription.uniforms);

        log.infoGroup('UniformByGroupValues', uniformByGroup.values());
        for (let [group, byBinding] of uniformByGroup) {
            const textures: BindGroupBuffers[] = [];
            let joinBuffer: number[] = [];
            let uniformName = byBinding.get(0)![0].shaderUniformGroup.name,
                targetShader = byBinding.get(0)![0].visibility;
            for (let [binding, uniforms] of byBinding) {
                for (let uniformInfo of uniforms) {
                    const { type, name, visibility, value } = uniformInfo;
                    if (type === 'float32Array') {
                        (value as Float32Array).forEach(val => joinBuffer.push(val));
                        console.log('Joining uniform buffer: ', name)
                        uniformName = name;
                        targetShader = visibility;
                    } else if (type === 'texture' && value instanceof Texture) {
                        const textureId = this.graphics.createTexture(value.imageData, value.name);
                        textures.push({ type: 'texture', bindNumber: binding, name: value.name, id: textureId });
                    } else if (type === 'sampler') {
                        const samplerId = this.graphics.createSampler();
                        textures.push({
                            type: 'sampler',
                            bindNumber: binding,
                            name: (value as Texture).name,
                            id: samplerId
                        })
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

    }

    // // private groupByGroupNumber(uniformGroups: UniformGroup[]) {
    // //     const uniformByGroup = new Map<number, Map<number, UniformGroup[]>>();
    // //     for (let uniform of uniformGroups) {
    // //         let bindingMap = uniformByGroup.get(uniform.group);
    // //         if (!bindingMap) {
    // //             bindingMap = new Map();
    // //             uniformByGroup.set(uniform.group, bindingMap);
    // //         }
    // //         let values = bindingMap.get(uniform.binding);
    // //         if (!values) {
    // //             values = [];
    // //             bindingMap.set(uniform.binding, values);
    // //         }
    // //         values.push(uniform);
    // //     }
    // //     return uniformByGroup;
    // }

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
                shaderVisibility: ShaderType.VERTEX,
                buffers: [
                    { type: 'uniform', bindNumber: 0, name: 'World', id: worldUniformsBuffer },
                ]
            },
            {
                groupNumber: 1,
                uniformName: 'Light',
                shaderVisibility: ShaderType.FRAGMENT,
                buffers: [
                    { type: 'uniform', bindNumber: 1, name: 'Light', id: lightUniformsBuffer },
                ]
            },
        ];

        const uniformByGroup = new Map<number, Map<number, UniformInfo[]>>();
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

        log.infoGroup('UniformByGroupValues', uniformByGroup.values());
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
                    } else if (type === 'texture' && value instanceof Texture) {
                        const textureId = this.graphics.createTexture(value.imageData, value.name);
                        textures.push({ type: 'texture', bindNumber: binding, name: value.name, id: textureId });
                    } else if (type === 'sampler') {
                        const samplerId = this.graphics.createSampler();
                        textures.push({
                            type: 'sampler',
                            bindNumber: binding,
                            name: (value as Texture).name,
                            id: samplerId
                        })
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
                    groupNumber: group, uniformName, shaderVisibility: targetShader,
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

        // @ts-ignore
        const pipelineId = this.graphics.initPipeline(shader);

        // @ts-ignore
        return new GPUMesh(shader,
            new StaticGpuUniforms(worldUniformsBuffer, lightUniformsBuffer),
            pipelineId);
    }

    private getDataByUniform(globalUniform: GlobalUniform, materialProps: Partial<MaterialProps>) {
        switch (globalUniform) {
            case GlobalUniform.MVP:
            case GlobalUniform.MODEL_MATRIX:
            case GlobalUniform.VIEW_MATRIX:
            case GlobalUniform.MODEL_INVERSE_TRANSPOSE:
            case GlobalUniform.LIGHT_DIRECTION:
            case GlobalUniform.LIGHT_COLOR:
                console.warn(`Unexpected uniform: ${globalUniform}`);
                break;
            case GlobalUniform.DIFFUSE_LIGHT:
                return materialProps.diffuse;
            case GlobalUniform.SPECULAR_LIGHT:
                return materialProps.specular;
            case GlobalUniform.AMBIENT_LIGHT:
                return materialProps.ambient;
        }
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