// import GeometryComponent from 'core/components/geometry/GeometryComponent';
// import GPUMesh, { GPUMeshAny, GPUMeshGroup, StaticGpuUniforms } from "core/components/GPUMesh";
// import LightedMaterial from 'core/components/material/LightedMaterial';
// import MaterialComponent from 'core/components/material/MaterialComponent';
// import { EntityName } from 'core/EntityManager';
// import Graphics, { BindGroupId, PipelineId, ShaderGroupId, VertexBufferId } from "core/Graphics";
// import { ObjFile } from 'core/parser/ObjParser';
// import {
//     FragmentShader,
//     FragmentUniformInfo,
//     ShaderName,
//     ShaderProgramName, ShaderStage,
//     VertexShader
// } from "core/resources/cpu/CpuShaderData";
// import { BufferFormat, BufferUsage } from "core/resources/gpu/BufferDescription";
// import {
//     BindGroupVariable,
//     BindGroupLayout,
//     IndexBuffer,
//     Shader,
//     ShaderType,
//     VertexBuffer,
//     VertexBufferLayout
// } from "core/resources/gpu/GpuShaderData";
// import Texture from "core/texture/Texture";
// import JavaMap from 'util/JavaMap';
// import logger from 'util/Logger';
// import glBasicFragmentShader from 'webgl/shaders/basic/basicFragmentShader.frag';
// import glBasicVertexShader from 'webgl/shaders/basic/basicVertexShader.vert';
// import glLightFragmentShader from 'webgl/shaders/light/fragmentShader.frag';
// import glLightVertexShader from 'webgl/shaders/light/vertexShader.vert';
// import glTerrainFragmentShader from 'webgl/shaders/terrain/terrainFragmentShader.frag';
// import glTerrainVertexShader from 'webgl/shaders/terrain/terrainVertexShader.vert';
// import WebGPUGraphics from "webgpu/graphics/WebGPUGraphics";
// import gpuBasicFragment from 'webgpu/shaders/basic/basicFragmentShader.wgsl';
// import gpuBasicVertex from 'webgpu/shaders/basic/basicVertexShader.wgsl';
// import gpuLightFragmentShader from 'webgpu/shaders/fragmentShader.wgsl';
// import gpuTerrainFragmentShader from 'webgpu/shaders/terrain/terrainFragmentShader.wgsl';
// import gpuTerrainVertexShader from 'webgpu/shaders/terrain/terrainVertexShader.wgsl';
// import gpuLightVertexShader from 'webgpu/shaders/vertexShader.wgsl';
//
//
// export type GPUMeshName = EntityName
// // TODO: Add later to create dynamic entities | string;
//
// export default class GPUResourceManagerOld {
//
//     private shadersCache = new JavaMap<ShaderProgramName, ShaderCacheEntry>();
//     private meshes: Record<GPUMeshName | string, GeometryGpuMesh | ObjGpuMesh> = {};
//
//     constructor(private graphics: Graphics) {
//     }
//
//     clearCache() {
//         this.shadersCache.clear();
//     }
//
//     createMesh(meshName: GPUMeshName, geometry: GeometryComponent, material: MaterialComponent): GPUMesh {
//         const mesh = this._createMesh(geometry.vertexData, material.fragmentData);
//         this.meshes[meshName] = { gpuMesh: mesh, geometry: geometry, material: material };
//
//         return mesh;
//     }
//
//     createMeshFromWavefront(meshName: GPUMeshName, wavefrontFile: ObjFile): GPUMeshGroup {
//         const meshGroup = new GPUMeshGroup(wavefrontFile.meshes
//             .map(({ material, ...geometry }) => this._createMesh(
//                 new GeometryComponent(geometry).vertexData, new LightedMaterial({
//                     ...material,
//                     textures: [new Texture('noop', new ImageData(new Uint8ClampedArray([1.0, 0.0, 1.0, 0.0]), 1))]
//                 })
//                     .fragmentData)));
//
//         this.meshes[meshName] = { gpuMesh: meshGroup, objFile: wavefrontFile };
//
//         return meshGroup
//     }
//
//     getMesh(meshName: GPUMeshName): GPUMeshAny {
//         return this.meshes[meshName].gpuMesh;
//     }
//
//     removeMesh(meshName: GPUMeshName): void {
//         const mesh = this.meshes[meshName];
//         this.releaseResources(mesh.gpuMesh);
//         delete this.meshes[meshName];
//     }
//
//     // reloadAll() {
//     //     Object.keys(this.meshes).forEach(name => this.reloadMesh(name))
//     // Object.values(this.meshes).forEach(({ gpuMesh }) => this.reloadMesh(gpuMesh))
//     // }
//
//     reloadMesh(mesh: GPUMeshName): GPUMeshAny {
//         const meshData = this.meshes[mesh];
//         this.releaseResources(meshData.gpuMesh);
//         if ((<ObjGpuMesh>meshData).objFile) {
//             const wavefrontFile = (<ObjGpuMesh>meshData).objFile;
//             const reloaded = new GPUMeshGroup(wavefrontFile.meshes
//                 .map(({ material, ...geometry }) => this._createMesh(
//                     new GeometryComponent(geometry).vertexData, new LightedMaterial({
//                         ...material,
//                         textures: [new Texture('noop', new ImageData(new Uint8ClampedArray([1.0, 0.0, 1.0, 0.0]), 1))]
//                     }).fragmentData)));
//             this.meshes[mesh] = { ...meshData, gpuMesh: reloaded }
//         } else {
//             const reloaded = this._createMesh((<GeometryGpuMesh>meshData).geometry.vertexData, (<GeometryGpuMesh>meshData).material.fragmentData);
//             this.meshes[mesh] = { ...meshData, gpuMesh: reloaded }
//         }
//
//         return this.meshes[mesh as GPUMeshName].gpuMesh;
//     }
//
//     private _createMesh(vertexShader: VertexShader, fragmentShader: FragmentShader): GPUMesh {
//         const shaderProgramName: ShaderProgramName = `${vertexShader.shaderName}_${fragmentShader.shaderName}`;
//
//         const { indexBuffer, vertexShaderSource, vertexBufferIds } = this.createVertexShader(vertexShader);
//         const dynamicBindGroups: BindGroupLayout[] = this.createDynamicBindGroups(fragmentShader.shaderName);
//         const staticBindGroups: BindGroupLayout[] = this.createStaticBindGroups(fragmentShader);
//         const instanceCount = 1000; // Example instance count
//         const floatsPerInstance = 20; // Example number of floats per instance (e.g., 16 for a 4x4 matrix + 4 for color)
//         const instanceBufferSize = instanceCount * floatsPerInstance * Float32Array.BYTES_PER_ELEMENT;
//         // console.log('Instance buffer size for 1000 instances: ', instanceBufferSize, ' my estimate: ', 1024 * 1024)
//         const instancedBindGroup: BindGroupLayout = {
//             groupNumber: 2,
//             targetShader: ShaderType.VERTEX,
//             variables: [{
//                 type: 'storage',
//                 name: 'InstancedBuffer',
//                 bindNumber: 0,
//                 id: this.graphics.createBuffer({
//                     byteLength: 64 * 100,
//                     usage: BufferUsage.STORAGE | BufferUsage.COPY_DST,
//                 })
//             }]
//         }
//         const sortedBindGroups: BindGroupLayout[] = [
//             ...dynamicBindGroups,
//             ...staticBindGroups,
//             instancedBindGroup]
//             .sort((gr1, gr2) => gr1.groupNumber - gr2.groupNumber);
//
//         if (this.shadersCache.has(shaderProgramName)) {
//             const { pipeline, shaderLayoutIds } = this.shadersCache.get(shaderProgramName);
//             const bindGroupIds = this.createBindGroups(shaderLayoutIds, sortedBindGroups);
//             const staticGpuUniforms = new StaticGpuUniforms(sortedBindGroups
//                 .flatMap(grp => grp.variables)
//                 .reduce((prev, buffer) => ({
//                     ...prev,
//                     [buffer.name.toUpperCase()]: buffer.id
//                 }), {}));
//
//             return new GPUMesh(shaderProgramName,
//                 staticGpuUniforms,
//                 bindGroupIds,
//                 pipeline,
//                 vertexBufferIds,
//                 indexBuffer);
//         }
//
//         const shaderLayoutIds = this.createShaderLayouts(sortedBindGroups);
//         const shader: Shader = {
//             label: this.createLabel(shaderProgramName),
//
//             indexBuffer,
//             vertexBufferIds,
//             vertexShaderSource,
//
//             shaderLayoutIds,
//             fragmentShaderSource: this.getFragmentSource(fragmentShader.shaderName),
//         }
//
//         const pipeline = Symbol('TODO') // this.graphics.initPipeline(shader);
//         const bindGroupIds = this.createBindGroups(shaderLayoutIds, sortedBindGroups);
//
//         this.shadersCache.set(shaderProgramName, { pipeline, shaderLayoutIds });
//
//         const staticGpuUniforms = new StaticGpuUniforms(sortedBindGroups
//             .flatMap(grp => grp.variables)
//             .reduce((prev, buffer) => ({
//                 ...prev,
//                 [buffer.name.toUpperCase()]: buffer.id
//             }), {}));
//
//         return new GPUMesh(shaderProgramName,
//             staticGpuUniforms,
//             bindGroupIds,
//             pipeline,
//             vertexBufferIds,
//             indexBuffer);
//     }
//
//     private createShaderLayouts(bindGroups: BindGroupLayout[]): ShaderGroupId[] {
//         return bindGroups.map(shaderLayout => this.graphics.createShaderLayout(shaderLayout));
//     }
//
//     private createBindGroups(shaderLayoutIds: ShaderGroupId[], bindGroups: BindGroupLayout[]): BindGroupId[] {
//         return shaderLayoutIds
//             .map((layoutId, index) => this.graphics.createBindGroup(layoutId, bindGroups[index].variables));
//     }
//
//     private createDynamicBindGroups(shaderName: ShaderName): BindGroupLayout[] {
//         const bindGroups: BindGroupLayout[] = [
//             {
//                 groupNumber: 0,
//                 // uniformName: `Dynamic`,
//                 targetShader: ShaderType.VERTEX | ShaderType.FRAGMENT,
//                 variables: []
//             },
//         ];
//
//         if (shaderName >= ShaderName.BASIC) {
//             const worldUniformsBuffer = this.graphics.createBuffer({
//                 name: `World`,
//                 usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
//                 byteLength: 192  // MVP + model matrix + inverse transpose
//             });
//
//             bindGroups[0].variables.push({ type: 'uniform', bindNumber: 0, name: 'World', id: worldUniformsBuffer })
//         }
//
//         if (shaderName >= ShaderName.BASIC_WITH_LIGHT) {
//             const lightUniformsBuffer = this.graphics.createBuffer({
//                 name: `Light`,
//                 usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
//                 byteLength: 48 // light direction + light color + eye of the camera
//             });
//             bindGroups[0].variables.push({ type: 'uniform', bindNumber: 1, name: 'Light', id: lightUniformsBuffer })
//         }
//
//         return bindGroups;
//     }
//
//     private createStaticBindGroups(fragmentShader: FragmentShader): BindGroupLayout[] {
//         const bindGroups: BindGroupLayout[] = [];
//         const uniformByGroup = new Map<number, Map<number, FragmentUniformInfo[]>>();
//         for (let uniform of fragmentShader.uniforms) {
//             let bindingMap = uniformByGroup.get(uniform.group);
//             if (!bindingMap) {
//                 bindingMap = new Map();
//                 uniformByGroup.set(uniform.group, bindingMap);
//             }
//             let values = bindingMap.get(uniform.binding);
//             if (!values) {
//                 values = [];
//                 bindingMap.set(uniform.binding, values);
//             }
//             values.push(uniform);
//         }
//
//         for (let [group, byBinding] of uniformByGroup) {
//             const textures: BindGroupVariable[] = [];
//             let joinBuffer: number[] = [];
//             const firstElement = byBinding.values().next().value;
//             let uniformName = firstElement.name,
//                 targetShader = firstElement.visibility;
//             for (let [binding, uniforms] of byBinding) {
//                 for (let uniformInfo of uniforms) {
//                     const { type, name, visibility, value } = uniformInfo;
//                     if (type === 'float32Array') {
//                         (value as Float32Array).forEach(val => joinBuffer.push(val));
//                         // console.log('Joining uniform buffer: ', name)
//                         uniformName = name;
//                         targetShader = visibility;
//                     } else if (type === 'texture' && value instanceof Texture) {
//                         const textureId = this.graphics.createTexture(value.imageData, value.name);
//                         textures.push({ type: 'texture', bindNumber: binding, name: value.name, id: textureId });
//                     } else if (type === 'sampler') {
//                         const samplerId = this.graphics.createSampler();
//                         textures.push({
//                             type: 'sampler',
//                             bindNumber: binding,
//                             name: (value as Texture).name,
//                             id: samplerId
//                         })
//                     } else {
//                         throw 'Unexpected type: ' + type
//                     }
//                 }
//
//
//                 if (joinBuffer.length > 0) {
//                     const joinBufferFloat = new Float32Array(joinBuffer);
//                     const bufferId = this.graphics.createBufferWithData({
//                         name: `joined-group-${group}-binding-${binding}`,
//                         byteLength: joinBufferFloat.byteLength,
//                         usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
//                     }, joinBufferFloat);
//                     textures.push({ type: 'uniform', id: bufferId, bindNumber: binding, name: uniformName });
//                     joinBuffer = [];
//                 }
//             }
//
//             const currentGroup = bindGroups.find(grp => grp.groupNumber === group);
//             if (!currentGroup) {
//                 bindGroups.push({
//                     groupNumber: group,
//                     // uniformName,
//                     targetShader,
//                     variables: textures,
//                 });
//             } else {
//                 currentGroup.variables = [...currentGroup.variables, ...textures];
//             }
//         }
//
//         return bindGroups;
//     }
//
//     private createVertexShader(vertexShader: VertexShader): {
//         vertexShaderSource: string;
//         vertexBufferIds: VertexBufferId[];
//         indexBuffer: undefined | IndexBuffer;
//     } {
//         const { layout, vertices, indices, stride, vertexCount, } = vertexShader;
//
//         let indexBuffer: IndexBuffer | undefined = undefined;
//         if (indices) {
//             indexBuffer = {
//                 id: this.graphics.createBufferWithData({
//                     name: 'index',
//                     byteLength: indices.byteLength,
//                     usage: BufferUsage.INDEX | BufferUsage.COPY_DST
//                 }, indices),
//                 indices: indices.length,
//             }
//         }
//
//         const vertexBufferId = this.graphics.createBufferWithData({
//             name: 'vertex',
//             byteLength: vertices.byteLength,
//             usage: BufferUsage.VERTEX | BufferUsage.COPY_DST
//         }, vertices);
//
//         const shaderLayout: VertexBufferLayout[] = [];
//         let lastEl = 0, lastOffset = 0;
//         for (let i = 0; i < layout.length; i++) {
//             const { dataType, elementsPerVertex } = layout[i];
//             const format = `${dataType}x${elementsPerVertex}` as BufferFormat;
//
//             lastOffset = lastOffset + Float32Array.BYTES_PER_ELEMENT * lastEl;
//             shaderLayout.push({
//                 offset: lastOffset,
//                 format: format,
//                 location: i
//             });
//             lastEl = elementsPerVertex;
//         }
//
//         const vertexBuffers: VertexBuffer[] = [{
//             layout: shaderLayout,
//             id: vertexBufferId,
//             stride,
//             vertexCount
//         }];
//
//         // @ts-ignore
//         return { vertexBufferIds: vertexBuffers.map(vBuffer => this.graphics.createVertexBuffer(vBuffer)),
//             indexBuffer,
//             vertexShaderSource: this.getVertexSource(vertexShader.shaderName),
//         }
//     }
//
//     private getFragmentSource(shaderName: ShaderName) {
//         if (this.graphics instanceof WebGPUGraphics) {
//             return this.getWebGpuFragmentSource(shaderName);
//         }
//
//         return this.getWebGlFragmentSource(shaderName);
//     }
//
//     private getVertexSource(shaderName: ShaderName) {
//         if (this.graphics instanceof WebGPUGraphics) {
//             return this.getWebGpuVertexSource(shaderName);
//         }
//
//         return this.getWebGlVertexSource(shaderName);
//     }
//
//     private getWebGpuVertexSource(shaderName: ShaderName) {
//         switch (shaderName) {
//             case ShaderName.BASIC:
//                 return gpuBasicVertex
//             case ShaderName.BASIC_WITH_LIGHT:
//                 return gpuLightVertexShader;
//             case ShaderName.TERRAIN:
//                 return gpuTerrainVertexShader
//             default: {
//                 logger.warn(`Unknown vertex shader name: ${shaderName}. Defaulting to basic!`);
//                 return gpuBasicVertex;
//             }
//         }
//     }
//
//     private getWebGlVertexSource(shaderName: ShaderName) {
//         switch (shaderName) {
//             case ShaderName.BASIC:
//                 return glBasicVertexShader
//             case ShaderName.BASIC_WITH_LIGHT:
//                 return glLightVertexShader;
//             case ShaderName.TERRAIN:
//                 return glTerrainVertexShader
//             default: {
//                 logger.warn(`Unknown vertex shader name: ${shaderName}. Defaulting to basic!`);
//                 return glBasicVertexShader;
//             }
//         }
//     }
//
//     private getWebGpuFragmentSource(shaderName: ShaderName) {
//         switch (shaderName) {
//             case ShaderName.BASIC:
//                 return gpuBasicFragment
//             case ShaderName.BASIC_WITH_LIGHT:
//                 return gpuLightFragmentShader
//             case ShaderName.TERRAIN:
//                 return gpuTerrainFragmentShader;
//             default: {
//                 logger.warn(`Unknown fragment shader name: ${shaderName}. Defaulting to basic!`);
//                 return gpuBasicFragment;
//             }
//         }
//     }
//
//     private getWebGlFragmentSource(shaderName: ShaderName) {
//         switch (shaderName) {
//             case ShaderName.BASIC:
//                 return glBasicFragmentShader;
//             case ShaderName.BASIC_WITH_LIGHT:
//                 return glLightFragmentShader;
//             case ShaderName.TERRAIN:
//                 return glTerrainFragmentShader;
//             default: {
//                 logger.warn(`Unknown fragment shader name: ${shaderName}. Defaulting to basic!`);
//                 return glBasicFragmentShader;
//             }
//         }
//     }
//
//     private createUniformBuffers(shaderName: ShaderName) {
//         switch (shaderName) {
//             case ShaderName.BASIC:
//                 return [this.graphics.createBuffer({
//                     name: 'World',
//                     usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
//                     byteLength: 64  // MVP
//                 })
//                 ]
//             case ShaderName.TERRAIN:
//             case ShaderName.BASIC_WITH_LIGHT:
//                 return [this.graphics.createBuffer({
//                     name: 'World',
//                     usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
//                     byteLength: 192  // MVP + model matrix + inverse transpose
//                 })]
//             default:
//                 return [];
//         }
//     }
//
//     private createLabel(shaderProgramName: ShaderProgramName) {
//         const mappings = {
//             0: 'BASIC',
//             1: 'BASIC_WITH_LIGHT',
//             2: 'TERRAIN'
//         }
//         const [vertexShader, fragmentShader] = shaderProgramName.split('_');
//         // @ts-ignore
//         return `[V: ${mappings[vertexShader]} F: ${mappings[fragmentShader]}]`;
//     }
//
//     /**
//      * TODO: Needed for wireframe hack, remove as this should not have knowledge of graphics api implementations
//      * @returns {boolean}
//      */
//     public isWebGpu() {
//         return this.graphics instanceof WebGPUGraphics;
//     }
//
//     private releaseResources(gpuMesh: GPUMeshAny) {
//         // TODO: Delete buffers
//     }
// }
//
// class Meshes {
//
//     public readonly DRAGON_MESH: GPUMeshName = 'DRAGON';
//
//     // private readonly cache: Record<GPUMeshName, >
//     // get dragon() {
//
//     // }
// }
//
// export const MeshRepository = new Meshes();
//
//
// // INTERFACES FOR PRIVATE DATA LAYOUT
// interface ShaderCacheEntry {
//     // shader: Shader, // TODO: Consider removing this from the cache
//     pipeline: PipelineId,
//     shaderLayoutIds: ShaderGroupId[],
// }
//
// interface GeometryGpuMesh {
//     gpuMesh: GPUMeshAny,
//     geometry: GeometryComponent,
//     material: MaterialComponent,
// }
//
// interface ObjGpuMesh {
//     gpuMesh: GPUMeshAny,
//     objFile: ObjFile,
// }