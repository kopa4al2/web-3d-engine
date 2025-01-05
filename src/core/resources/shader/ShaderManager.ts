import Graphics, { BindGroupLayoutId, GraphicsAPI, PipelineId } from 'core/Graphics';
import Geometry, { GeometryDescriptor } from 'core/mesh/Geometry';
import Material, { MaterialDescriptor } from 'core/mesh/material/Material';
import { FragmentShaderName, VertexLayoutEntry, VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import {
  CAMERA_STRUCT,
  DEPTH_TEXTURE_ARRAY_SAMPLER_STRUCT,
  DEPTH_TEXTURE_ARRAY_STRUCT,
  GLOBAL_ENV_CUBE_SAMPLER_STRUCT,
  GLOBAL_ENV_CUBE_TEXTURE_STRUCT,
  GLOBAL_TEXTURE_ARRAY_SAMPLER_STRUCT,
  GLOBAL_TEXTURE_ARRAY_STRUCT,
  LIGHT_STRUCT,
  TIME_STRUCT,
  VERTEX_STORAGE_BUFFER_STRUCT
} from 'core/resources/shader/DefaultBindGroupLayouts';
import { BufferFormat } from 'core/resources/gpu/BufferDescription';
import {
  DEFAULT_PIPELINE_OPTIONS,
  PipelineColorAttachment,
  PipelineDepthAttachment,
  PipelineOptions,
  ShaderProgramDescription,
  VertexBufferLayout
} from 'core/resources/gpu/GpuShaderData';
import ResourceManager, { PipelineHash } from 'core/resources/ResourceManager';
import DebugUtil from 'utils/debug/DebugUtil';
import ObjectUtils from 'utils/ObjectUtils';
//
// import WebGPUGraphics from 'webgpu/graphics/WebGPUGraphics';
// import gpuBasicFragment from 'webgpu/shaders/basic/basicFragmentShader.wgsl';
// import basicFragmentShaderInstanced from 'webgpu/shaders/basic/basicFragmentShaderInstanced.wgsl';
// import gpuBasicVertex from 'webgpu/shaders/basic/basicVertexShader.wgsl';
// import gpuBasicVertexInstanced from 'webgpu/shaders/basic/basicVertexShaderInstanced.wgsl';
// import gpuSphereFragmentShader from 'webgpu/shaders/debug/sphereFragmentShader.wgsl';
// import gpuSkyboxFragment from 'webgpu/shaders/skybox-fragment.wgsl';
// import gpuSkyboxVertex from 'webgpu/shaders/skybox-vertex.wgsl';
// import gpuSphereVertexShader from 'webgpu/shaders/debug/sphereVertexShader.wgsl';
// import gpuPBRLightFragmentShader from 'webgpu/shaders/light/pbrFragment.wgsl';
// import gpuPhongLightFragmentShader from 'webgpu/shaders/light/phongFragment.wgsl';
// import gpuLightVertexShader from 'webgpu/shaders/light/vertexShader.wgsl';
// import gpuTerrainFragmentShader from 'webgpu/shaders/terrain/terrainFragmentShader.wgsl';
// import gpuTerrainVertexShader from 'webgpu/shaders/terrain/terrainVertexShader.wgsl';
import Globals from '../../../engine/Globals';
// import glBasicFragmentShader from 'webgl/shaders/basic/basicFragmentShader.frag';
// import glBasicVertexShader from 'webgl/shaders/basic/basicVertexShader.vert';
// import glBasicVertexShaderInstanced from 'webgl/shaders/basic/basicVertexShaderInstanced.vert';
// import glShapeFragmentShader from 'webgl/shaders/debug/outlinedShapeFragmentShader.frag';
// import glShapeVertexShader from 'webgl/shaders/debug/outlinedShapeVertexShader.vert';
// import glPBRLightFragmentShader from 'webgl/shaders/light/pbrFragment.frag';
// import glPhongLightFragmentShader from 'webgl/shaders/light/phongFragment.frag';
// import glLightVertexShader from 'webgl/shaders/light/vertexShader.vert';
// import glSkyboxFragment from 'webgl/shaders/skybox-fragment.frag';
// import glSkyboxVertex from 'webgl/shaders/skybox-vertex.vert';
// import glTerrainFragmentShader from 'webgl/shaders/terrain/terrainFragmentShader.frag';
// import glTerrainVertexShader from 'webgl/shaders/terrain/terrainVertexShader.vert';
export enum ShaderTemplate {
  UNLIT = 'UNLIT',
  PHONG = 'PHONG',
  PBR = 'PBR',
  TERRAIN = 'TERRAIN',
  SKYBOX = 'SKYBOX',
  SHADOW_PASS = 'SHADOW_PASS'
}


export default class ShaderManager {

  private pipelinesCache: Record<PipelineHash, PipelineId> = {};


  // @ts-ignore
  private shaderContents: Record<(VertexShaderName | FragmentShaderName), string> = {};

  public static GLOBAL_BIND_GROUP = {
    label: 'GLOBAL',
    entries: [
      CAMERA_STRUCT,
      LIGHT_STRUCT,
      TIME_STRUCT,
      GLOBAL_TEXTURE_ARRAY_STRUCT,
      GLOBAL_TEXTURE_ARRAY_SAMPLER_STRUCT,
      GLOBAL_ENV_CUBE_TEXTURE_STRUCT,
      GLOBAL_ENV_CUBE_SAMPLER_STRUCT,
      DEPTH_TEXTURE_ARRAY_STRUCT,
      DEPTH_TEXTURE_ARRAY_SAMPLER_STRUCT,
    ]
  };

  public static INSTANCE_BUFFER_GROUP = {
    label: 'VERTEX-INSTANCE',
    entries: [
      VERTEX_STORAGE_BUFFER_STRUCT,
    ]
  };

  constructor(private graphics: Graphics, private resourceManager: ResourceManager) {
    DebugUtil.addToWindowObject('shaderFactory', this);
    if (graphics.graphicsApi() === GraphicsAPI.WEBGL2) {
      this.loadWebGlShaders();
    } else {
      this.loadWebGpuShaders();
    }

  }

  public createShadowPass(staticMeshLayoutIds: BindGroupLayoutId[], skinnedMeshLayoutIds: BindGroupLayoutId[]): [PipelineId, PipelineId] {
    const uniqueId = ShaderTemplate.SHADOW_PASS;
    if (this.pipelinesCache[uniqueId]) {
      return [this.pipelinesCache[uniqueId], this.pipelinesCache[`${uniqueId}_SKINNED`]];
    }

    const properties: PipelineOptions = {
      drawMode: 'triangle-list',
      cullFace: 'front',
      depthAttachment: {
        depthCompare: 'less',
        depthWriteEnabled: true,
        format: Globals.SHADOW_PASS_DEPTH_FN,
      },
      colorAttachment: {
        disabled: true,
        writeMask: 'ALL',
        format: 'bgra8unorm',
      }
    };

    const [staticMeshVertex, skinnedMeshVertex] = this.getShadowPassShaders();
    this.pipelinesCache[uniqueId] = this.graphics.initPipeline({
      label: 'Shadow Pass Static',
      shaderLayoutIds: staticMeshLayoutIds,

      options: properties,

      vertexShaderSource: staticMeshVertex,
      vertexShaderLayout: this.createVertexShaderLayout([3, 2, 3, 4].map(elementsPerVertex => ({
        elementsPerVertex,
        dataType: 'float32'
      }))),
      vertexShaderStride: 48
    });

    this.pipelinesCache[`${uniqueId}_SKINNED`] = this.graphics.initPipeline({
      label: 'Shadow Pass Skinned',
      shaderLayoutIds: skinnedMeshLayoutIds,

      options: properties,

      vertexShaderSource: skinnedMeshVertex,
      vertexShaderLayout: this.createVertexShaderLayout([3, 2, 3, 4, 4, 4].map(elementsPerVertex => ({
        elementsPerVertex,
        dataType: 'float32'
      }))),
      vertexShaderStride: 80
    });

    return [this.pipelinesCache[uniqueId], this.pipelinesCache[`${uniqueId}_SKINNED`]];
  }

  public createPipeline(geometry: Geometry,
                        material: Material,
                        label?: string,
                        layoutId: BindGroupLayoutId = this.resourceManager.getOrCreateLayout(ShaderManager.INSTANCE_BUFFER_GROUP)): PipelineId {

    const materialDescriptor = material.descriptor;
    const geometryDescriptor = geometry.descriptor;
    // const shaderTemplate = this.determineTemplate(geometryDescriptor.vertexShader, materialDescriptor.fragmentShader);
    if (!label) {
      label = geometryDescriptor.vertexShader + '-' + materialDescriptor.fragmentShader;
    }

    const uniqueId = this.generatePipelineHash(geometryDescriptor, materialDescriptor);

    const properties = this.mergeWithDefaultOptions(materialDescriptor.properties);

    const isSkybox = geometryDescriptor.vertexShader === VertexShaderName.SKY_BOX;

    const shaderLayoutIds = isSkybox
                            ? [
        this.resourceManager.getOrCreateLayout(ShaderManager.GLOBAL_BIND_GROUP),
        ...materialDescriptor.bindGroupLayouts.map(l => this.resourceManager.getOrCreateLayout(l)),
      ]
                            : [
        this.resourceManager.getOrCreateLayout(ShaderManager.GLOBAL_BIND_GROUP),
        ...materialDescriptor.bindGroupLayouts.map(l => this.resourceManager.getOrCreateLayout(l)),
        layoutId,
      ];
    if (!this.pipelinesCache[uniqueId]) {
      this.pipelinesCache[uniqueId] = this.graphics.initPipeline({
        label,
        shaderLayoutIds,

        options: properties,
        // options: this.mergeWithDefaultOptions(properties),
        fragmentShaderSource: this.getFragmentSource(materialDescriptor.fragmentShader),

        vertexShaderSource: this.getVertexSource(geometryDescriptor.vertexShader),
        vertexShaderLayout: this.createVertexShaderLayout(geometryDescriptor.vertexLayout.entries),
        vertexShaderStride: geometryDescriptor.vertexLayout.stride,
      } as ShaderProgramDescription);
    }

    return this.pipelinesCache[uniqueId];
  }

  private generatePipelineHash(geometry: GeometryDescriptor,
                               material: MaterialDescriptor) {
    return `${geometry.vertexShader}-${material.fragmentShader}-${JSON.stringify(material.textureSize)}-${JSON.stringify(this.mergeWithDefaultOptions(material.properties))}-${geometry.vertexLayout.entries.map(e => e.elementsPerVertex).join('-')}`;
  }


  private createVertexShaderLayout(layout: VertexLayoutEntry[]) {
    const vertexShaderLayout: VertexBufferLayout[] = [];
    let lastEl = 0, lastOffset = 0;
    for (let i = 0; i < layout.length; i++) {
      const { dataType, elementsPerVertex } = layout[i];
      const format = (elementsPerVertex === 1 ? dataType : `${dataType}x${elementsPerVertex}`) as BufferFormat;

      lastOffset = lastOffset + Float32Array.BYTES_PER_ELEMENT * lastEl;
      vertexShaderLayout.push({
        offset: lastOffset,
        format: format,
        location: i
      });
      lastEl = elementsPerVertex;
    }
    return vertexShaderLayout;
  }

  private mergeWithDefaultOptions(pipelineOptions: Partial<PipelineOptions>): PipelineOptions {
    pipelineOptions.colorAttachment = ObjectUtils.mergePartial(
      pipelineOptions.colorAttachment as Partial<PipelineColorAttachment>,
      DEFAULT_PIPELINE_OPTIONS.colorAttachment);
    pipelineOptions.depthAttachment = ObjectUtils.mergePartial(
      pipelineOptions.depthAttachment as Partial<PipelineDepthAttachment>,
      DEFAULT_PIPELINE_OPTIONS.depthAttachment);
    return ObjectUtils.mergePartial(pipelineOptions, DEFAULT_PIPELINE_OPTIONS);
  }

  private getShadowPassShaders(): [string, string] {
    if (this.graphics.graphicsApi() === GraphicsAPI.WEBGPU) {
      const staticVertexInput = `
                struct VertexInput {
                    @builtin(instance_index) instanceID: u32,
                    @location(0) position: vec3<f32>,
                    @location(1) textureCoord: vec2<f32>,
                    @location(2) normal: vec3<f32>,
                    @location(3) tangent: vec4<f32>,
                };
            `;
      const skinnedVertexInput = `
                struct VertexInput {
                    @builtin(instance_index) instanceID: u32,
                    @location(0) position: vec3<f32>,
                    @location(1) textureCoord: vec2<f32>,
                    @location(2) normal: vec3<f32>,
                    @location(3) tangent: vec4<f32>,
                    @location(4) jointIndices: vec4<f32>,
                    //    @location(4) joints: vec4<u32>,
                    @location(5) jointWeights: vec4<f32>,
                };
            `;
      const vertexOutput = `
                struct VertexOutput {
                    @builtin(position) position: vec4<f32>,
                }
            `;
      return [`
                    ${staticVertexInput}

                    ${vertexOutput}
                    
                    struct Global {
                        lightViewProjectionMatrix : mat4x4<f32>,
                    }
                    
                    @group(0) @binding(0) var<uniform> global : Global;
                    //@group(0) @binding(1) var<uniform> modelMatrix: mat4x4<f32>;
                    @group(1) @binding(0) var<storage, read> modelMatrices: array<mat4x4<f32>>;
                    
                    @vertex
                    fn main(input : VertexInput) -> VertexOutput {
                        var output: VertexOutput;
                        let modelMatrix = modelMatrices[input.instanceID];
                        output.position = global.lightViewProjectionMatrix * modelMatrix * vec4<f32>(input.position, 1.0); 
                        return output;
                    }
            `, `
                    ${skinnedVertexInput}

                    ${vertexOutput}
                    
                    struct Global {
                        lightViewProjectionMatrix : mat4x4<f32>,
                    }
                    
                    @group(0) @binding(0) var<uniform> global : Global;
                    //@group(0) @binding(1) var<uniform> modelMatrix: mat4x4<f32>;
                    @group(1) @binding(0) var<storage, read> modelMatrices: array<mat4x4<f32>>;
                    @group(1) @binding(1) var<uniform> jointMatrices: array<mat4x4<f32>, 160>;
                    
                    @vertex
                    fn main(input : VertexInput) -> VertexOutput {
                        var output: VertexOutput;
                        //let modelMatrix = modelMatrices[input.instanceID];
                        let worldPosition =
                            input.jointWeights.x * (jointMatrices[u32(input.jointIndices.x)] * vec4<f32>(input.position, 1.0)) +
                            input.jointWeights.y * (jointMatrices[u32(input.jointIndices.y)] * vec4<f32>(input.position, 1.0)) +
                            input.jointWeights.z * (jointMatrices[u32(input.jointIndices.z)] * vec4<f32>(input.position, 1.0)) +
                            input.jointWeights.w * (jointMatrices[u32(input.jointIndices.w)] * vec4<f32>(input.position, 1.0));
                        output.position = global.lightViewProjectionMatrix * worldPosition; 
                        return output;
                    }
            `,
      ];
    } else {
      return [
        `#version 300 es

                layout(location = 0) in vec3 aVertexPosition;
                layout(location = 1) in vec2 textureUV;
                layout(location = 2) in vec3 aNormal;
                layout(location = 3) in vec4 aTangent;
                    
                uniform mat4 lightViewProjMatrix;
                uniform mat4 modelMatrix;
                    
                    
                void main() {
                    gl_Position = lightViewProjMatrix * modelMatrix * vec4(aVertexPosition, 1.0);
                }`,
        ``];
    }

    // throw new Error('WEBGL2 Shadow pass shaders are not yet created');
  }

  private getFragmentSource(shaderName: FragmentShaderName) {
    return this.shaderContents[shaderName];
    // if (this.graphics.graphicsApi() === GraphicsAPI.WEBGPU) {
    //   return this.getWebGpuFragmentSource(shaderName);
    // }
    //
    // return this.getWebGlFragmentSource(shaderName);
  }

  private getVertexSource(shaderName: VertexShaderName) {
    return this.shaderContents[shaderName];
    // if (this.graphics.graphicsApi() === GraphicsAPI.WEBGPU) {
    //   return this.getWebGpuVertexSource(shaderName);
    // }
    //
    // return this.getWebGlVertexSource(shaderName);
  }

  // private getWebGpuVertexSource(shaderName: VertexShaderName) {
  //   switch (shaderName) {
  //     case VertexShaderName.SKY_BOX:
  //       return gpuSkyboxVertex;
  //     case VertexShaderName.LIT_TANGENTS_VEC4:
  //       return gpuLightVertexShader;
  //     case VertexShaderName.UNLIT_GEOMETRY:
  //       return gpuSphereVertexShader;
  //     case VertexShaderName.UNUSED_OLD_BASIC_INSTANCED:
  //       return gpuBasicVertexInstanced;
  //     case VertexShaderName.LIT_GEOMETRY:
  //       return gpuLightVertexShader;
  //     case VertexShaderName.TERRAIN:
  //       return gpuTerrainVertexShader;
  //     default: {
  //       logger.warn(`Unknown vertex shader name: ${shaderName}. Defaulting to basic!`);
  //       return gpuBasicVertex;
  //     }
  //   }
  // }
  //
  // private getWebGlVertexSource(shaderName: VertexShaderName) {
  //   switch (shaderName) {
  //     case VertexShaderName.SKY_BOX:
  //       return glSkyboxVertex;
  //     case VertexShaderName.LIT_TANGENTS_VEC4:
  //       return glLightVertexShader;
  //     case VertexShaderName.UNUSED_OLD_BASIC_INSTANCED:
  //       return glBasicVertexShaderInstanced;
  //     case VertexShaderName.UNLIT_GEOMETRY:
  //       return glShapeVertexShader;
  //     case VertexShaderName.LIT_GEOMETRY:
  //       return glLightVertexShader;
  //     case VertexShaderName.TERRAIN:
  //       return glTerrainVertexShader;
  //     default: {
  //       logger.warn(`Unknown vertex shader name: ${shaderName}. Defaulting to basic!`);
  //       return glBasicVertexShader;
  //     }
  //   }
  // }
  //
  // private getWebGpuFragmentSource(shaderName: FragmentShaderName) {
  //   switch (shaderName) {
  //     case FragmentShaderName.SKY_BOX:
  //       return gpuSkyboxFragment;
  //     case FragmentShaderName.BASIC:
  //       return gpuBasicFragment;
  //     case FragmentShaderName.UNLIT:
  //       return gpuSphereFragmentShader;
  //     case FragmentShaderName.BASIC_INSTANCED:
  //       return basicFragmentShaderInstanced;
  //     case FragmentShaderName.PHONG_LIT:
  //       return gpuPhongLightFragmentShader;
  //     case FragmentShaderName.PBR:
  //       return gpuPBRLightFragmentShader;
  //     case FragmentShaderName.TERRAIN:
  //       return gpuTerrainFragmentShader;
  //     default: {
  //       logger.warn(`Unknown fragment shader name: ${shaderName}. Defaulting to basic!`);
  //       return gpuBasicFragment;
  //     }
  //   }
  // }
  //
  // private getWebGlFragmentSource(shaderName: FragmentShaderName) {
  //   switch (shaderName) {
  //     case FragmentShaderName.SKY_BOX:
  //       return glSkyboxFragment;
  //     case FragmentShaderName.BASIC:
  //     case FragmentShaderName.BASIC_INSTANCED:
  //       return glBasicFragmentShader;
  //     case FragmentShaderName.UNLIT:
  //       return glShapeFragmentShader;
  //     case FragmentShaderName.PHONG_LIT:
  //       return glPhongLightFragmentShader;
  //     case FragmentShaderName.PBR:
  //       return glPBRLightFragmentShader;
  //     case FragmentShaderName.TERRAIN:
  //       return glTerrainFragmentShader;
  //     default: {
  //       logger.warn(`Unknown fragment shader name: ${shaderName}. Defaulting to basic!`);
  //       return glBasicFragmentShader;
  //     }
  //   }
  // }

  private determineTemplate(vertexShader: VertexShaderName, fragmentShader: FragmentShaderName): ShaderTemplate {
    if (vertexShader === VertexShaderName.SKY_BOX && fragmentShader === FragmentShaderName.SKY_BOX) {
      return ShaderTemplate.SKYBOX;
    }
    if (vertexShader === VertexShaderName.TERRAIN && fragmentShader === FragmentShaderName.TERRAIN) {
      return ShaderTemplate.TERRAIN;
    }

    if (vertexShader === VertexShaderName.LIT_GEOMETRY && fragmentShader === FragmentShaderName.PBR) {
      return ShaderTemplate.PBR;
    }

    if (vertexShader === VertexShaderName.LIT_GEOMETRY && fragmentShader === FragmentShaderName.PHONG_LIT) {
      return ShaderTemplate.PHONG;
    }

    if (vertexShader === VertexShaderName.LIT_TANGENTS_VEC4 && fragmentShader === FragmentShaderName.PHONG_LIT) {
      return ShaderTemplate.PHONG;
    }

    if (vertexShader === VertexShaderName.LIT_TANGENTS_VEC4 && fragmentShader === FragmentShaderName.PBR) {
      return ShaderTemplate.PBR;
    }

    throw new Error(`Template could not be determined: ${vertexShader} ${fragmentShader}`);
  }

  // private getShaderNames(shaderTemplate: ShaderTemplate): [VertexShaderName, FragmentShaderName] {
  //     switch (shaderTemplate) {
  //         case ShaderTemplate.PBR:
  //             return [VertexShaderName.LIT_GEOMETRY, FragmentShaderName.PBR]
  //         case ShaderTemplate.PHONG:
  //             return [VertexShaderName.LIT_GEOMETRY, FragmentShaderName.PHONG_LIT]
  //         case ShaderTemplate.UNLIT:
  //             return [VertexShaderName.UNLIT_GEOMETRY, FragmentShaderName.UNLIT]
  //         case ShaderTemplate.TERRAIN:
  //             return [VertexShaderName.TERRAIN, FragmentShaderName.TERRAIN]
  //         default:
  //             throw new Error(`Unknown shader template: ${shaderTemplate}`);
  //     }
  // }

  // private getShaderLayout(shader: ShaderTemplate): BindGroupLayout[] {
  //     switch (shader) {
  //         case ShaderTemplate.PBR:
  //             return [
  //                 ShaderManager.GLOBAL_BIND_GROUP,
  //                 {
  //                     label: 'PBRMaterial',
  //                     entries: [
  //                         PBR_MATERIAL_STRUCT,
  //                     ]
  //                 },
  //                 {
  //                     label: 'VERTEX',
  //                     entries: [
  //                         VERTEX_STORAGE_BUFFER_STRUCT,
  //                     ]
  //                 }];
  //         case ShaderTemplate.PHONG:
  //             return [
  //                 ShaderManager.GLOBAL_BIND_GROUP,
  //                 {
  //                     label: 'UNIFORMS',
  //                     entries: [
  //                         PHONG_MATERIAL_STRUCT,
  //                     ]
  //                 },
  //                 {
  //                     label: 'VERTEX',
  //                     entries: [
  //                         VERTEX_STORAGE_BUFFER_STRUCT,
  //                     ]
  //                 }];
  //         default:
  //             throw new Error(`Unknown shader template: ${shader}`);
  //     }
  // }

  private loadWebGlShaders() {
    Promise.all([
      // import ('webgl/shaders/basic/basicFragmentShader.frag').then(module => ({ content: module.default, shader: FragmentShaderName.BASIC })),
      // import ('webgl/shaders/basic/basicVertexShader.vert').then(module => ({ content: module.default, shader: VertexShaderName.UNUSED_OLD_BASIC_INSTANCED })),
      // import ('webgl/shaders/basic/basicVertexShaderInstanced.vert').then(module => ({ content: module.default, shader: VertexShaderName.UNUSED_OLD_BASIC_INSTANCED })),
      import ('webgl/shaders/debug/outlinedShapeFragmentShader.frag').then(module => ({
        content: module.default,
        shader: FragmentShaderName.UNLIT
      })),
      import ('webgl/shaders/debug/outlinedShapeVertexShader.vert').then(module => ({
        content: module.default,
        shader: VertexShaderName.UNLIT_GEOMETRY
      })),
      import ('webgl/shaders/light/pbrFragment.frag').then(module => ({ content: module.default, shader: FragmentShaderName.PBR })),
      import ('webgl/shaders/light/phongFragment.frag').then(module => ({ content: module.default, shader: FragmentShaderName.PHONG_LIT })),
      import ('webgl/shaders/light/vertexShader.vert').then(module => ({
        content: module.default,
        shader: VertexShaderName.LIT_TANGENTS_VEC4
      })),
      import ('webgl/shaders/skybox-fragment.frag').then(module => ({ content: module.default, shader: FragmentShaderName.SKY_BOX })),
      import ('webgl/shaders/skybox-vertex.vert').then(module => ({ content: module.default, shader: VertexShaderName.SKY_BOX })),
      // import ('webgl/shaders/terrain/terrainFragmentShader.frag').then(module => ({ content: module.default, shader: FragmentShaderName.TERRAIN })),
      // import ('webgl/shaders/terrain/terrainVertexShader.vert').then(module => ({ content: module.default, shader: VertexShaderName.TERRAIN })),
    ]).then(res => {
      console.log('Loaded shaders: ', res);
      res.forEach(({ content, shader }) => this.shaderContents[shader] = content);
    });
  }

  private loadWebGpuShaders() {
    Promise.all([
      // import ('webgpu/shaders/basic/basicFragmentShader.wgsl').then(module => ({ content: module.default, shader: FragmentShaderName.BASIC })),
      // import ('webgpu/shaders/basic/basicVertexShader.wgsl').then(module => ({ content: module.default, shader: VertexShaderName.UNUSED_OLD_BASIC_INSTANCED })),
      // import ('webgpu/shaders/basic/basicVertexShaderInstanced.wgsl').then(module => ({ content: module.default, shader: VertexShaderName.UNUSED_OLD_BASIC_INSTANCED })),
      import ('webgpu/shaders/debug/sphereFragmentShader.wgsl').then(module => ({
        content: module.default,
        shader: FragmentShaderName.UNLIT
      })),
      import ('webgpu/shaders/debug/sphereVertexShader.wgsl').then(module => ({
        content: module.default,
        shader: VertexShaderName.UNLIT_GEOMETRY
      })),
      import ('webgpu/shaders/light/pbrFragment.wgsl').then(module => ({ content: module.default, shader: FragmentShaderName.PBR })),
      import ('webgpu/shaders/light/phongFragment.wgsl').then(module => ({
        content: module.default,
        shader: FragmentShaderName.PHONG_LIT
      })),
      import ('webgpu/shaders/light/vertexShader.wgsl').then(module => ({
        content: module.default,
        shader: VertexShaderName.LIT_TANGENTS_VEC4
      })),
      import ('webgpu/shaders/skybox-fragment.wgsl').then(module => ({ content: module.default, shader: FragmentShaderName.SKY_BOX })),
      import ('webgpu/shaders/skybox-vertex.wgsl').then(module => ({ content: module.default, shader: VertexShaderName.SKY_BOX })),
      import ('webgpu/shaders/light/skeletalVertexShader.wgsl').then(module => ({
        content: module.default,
        shader: VertexShaderName.SKINNED_LIT
      })),
      // import ('webgpu/shaders/terrain/terrainFragmentShader.wgsl').then(module => ({ content: module.default, shader: FragmentShaderName.TERRAIN })),
      // import ('webgpu/shaders/terrain/terrainVertexShader.wgsl').then(module => ({ content: module.default, shader: VertexShaderName.TERRAIN })),
    ]).then(res => res.forEach(({ content, shader }) => this.shaderContents[shader] = content));
  }
}

//
// import glBasicFragmentShader from 'webgl/shaders/basic/basicFragmentShader.frag';
// import glBasicVertexShader from 'webgl/shaders/basic/basicVertexShader.vert';
// import glBasicVertexShaderInstanced from 'webgl/shaders/basic/basicVertexShaderInstanced.vert';
// import glShapeFragmentShader from 'webgl/shaders/debug/outlinedShapeFragmentShader.frag';
// import glShapeVertexShader from 'webgl/shaders/debug/outlinedShapeVertexShader.vert';
// import glPBRLightFragmentShader from 'webgl/shaders/light/pbrFragment.frag';
// import glPhongLightFragmentShader from 'webgl/shaders/light/phongFragment.frag';
// import glLightVertexShader from 'webgl/shaders/light/vertexShader.vert';
// import glSkyboxFragment from 'webgl/shaders/skybox-fragment.frag';
// import glSkyboxVertex from 'webgl/shaders/skybox-vertex.vert';
// import glTerrainFragmentShader from 'webgl/shaders/terrain/terrainFragmentShader.frag';
// import glTerrainVertexShader from 'webgl/shaders/terrain/terrainVertexShader.vert';