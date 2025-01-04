import Mesh from 'core/components/Mesh';
import Transform, { defaultTransform } from 'core/components/Transform';
import EntityManager, { EntityId } from 'core/EntityManager';
import GeometryFactory from 'core/factories/GeometryFactory';
import MaterialFactory from 'core/factories/MaterialFactory';
import Geometry from 'core/mesh/Geometry';
import { PBRMaterialProperties } from 'core/mesh/material/MaterialProperties';
import Skeleton from 'core/mesh/Skeleton';
import {
  GlbJsonParserRequest,
  GlbJsonParserResponse,
  GlbWorkerImage,
  GlbWorkerMesh,
  GlbWorkerNode
} from 'core/parser/gltf/workers/GlbLoader.worker';
import { GLTFWorkerRequest, GLTFWorkerResponse } from 'core/parser/gltf/workers/GLTFWorker';
import { BindGroupHelper, ShaderStructV2 } from 'core/rendering/Helpers';
import { BlendPresets } from 'core/resources/gpu/Blend';
import { PipelineColorAttachment, UniformVisibility } from 'core/resources/gpu/GpuShaderData';
import ResourceManager from 'core/resources/ResourceManager';
import ShaderManager from 'core/resources/shader/ShaderManager';
import TextureManager from 'core/resources/TextureManager';
import Texture from 'core/texture/Texture';
import WorkerPool from 'core/worker/WorkerPool';
import { mat4, quat, vec2, vec3 } from 'gl-matrix';
import DebugUtil from '../../../utils/debug/DebugUtil';
import JavaMap from '../../../utils/JavaMap';


// const glbWorkerPool = new WorkerPool<GlbJsonParserRequest, GlbJsonParserResponse>(
//     () => new Worker(new URL('./workers/GlbLoader.worker.ts', import.meta.url), { name: 'GLB-Parser-Worker' }),
//     1
// );
export default class GLTFParser {
  private static readonly gltfWorkerPool = new WorkerPool<GLTFWorkerRequest, GLTFWorkerResponse>();
  public static readonly glbWorkerPool = new WorkerPool<GlbJsonParserRequest, GlbJsonParserResponse>(
    () => new Worker(new URL('./workers/GlbLoader.worker.ts', import.meta.url), { name: 'GLB-Parser-Worker' }),
    2
  );

  public buffers: ArrayBuffer[] = [];

  constructor(public json: GLTFJson,
              public imageBitmaps: GlbWorkerImage[],
              public meshes: GlbWorkerMesh[],
              public nodes: GlbWorkerNode[],
              public skins: ArrayBuffer[]) {
    DebugUtil.addToWindowObject('gltf', this);
    console.log('GLTF JSON', json);
  }

  public createMeshes(shaderManager: ShaderManager,
                      geometryFactory: GeometryFactory,
                      materialFactory: MaterialFactory,
                      resourceManager: ResourceManager,
                      entityManager: EntityManager,
                      rootTransform?: Transform): EntityId[] {
    const textureManager: TextureManager = resourceManager.textureManager;

    const bgHelper = new BindGroupHelper(resourceManager, 'VERTEX-INSTANCE', [{
      type: 'storage',
      byteLength: 4096,
      name: 'InstanceData',
      visibility: UniformVisibility.VERTEX | UniformVisibility.FRAGMENT
    }]);

    const skinBindGroupHelpers: BindGroupHelper[] = [];
    const skeletons = [];
    if (this.json.skins) {
      for (let i = 0; i < this.json.skins.length; i++) {
        const skin = this.json.skins[i];
        const rootJoint = this.json.nodes[skin.skeleton];
        const arrayBuffer = this.skins[i];
        skinBindGroupHelpers.push(new BindGroupHelper(resourceManager, 'SKINNED',
          [
            {
              type: 'storage',
              byteLength: 4096,
              name: 'InstanceData',
              visibility: UniformVisibility.VERTEX
            },
            {
              type: 'uniform',
              data: arrayBuffer,
              name: 'inverseJoinBindMatrix',
              visibility: UniformVisibility.VERTEX
            }
          ]));

        const skeleton = new Skeleton(rootJoint.name, new Array(skin.joints.length), arrayBuffer);

        skeletons.push(skeleton);
      }

    }


    // const usedSkeletons = new JavaMap<number, Skeleton>();
    // const nodesToEntity = new JavaMap<number, EntityId>();
    const usedMaterials = new JavaMap<string, Mesh>();
    // key is the skin index, value is list of nodes that reference it
    const nodesWithSkin: Record<number, EntityId[]> = {};

    const entities: EntityId[] = new Array(this.nodes.length);
    const transforms: Transform[] = new Array(this.nodes.length);
    for (let nodeIndex = 0; nodeIndex < this.nodes.length; nodeIndex++) {
      const node = this.nodes[nodeIndex];
      if (this.json.nodes[nodeIndex].name !== node.name || node.mesh !== this.json.nodes[nodeIndex].mesh) {
        console.log(`node ${nodeIndex} original`, this.json.nodes[nodeIndex], `now: `, node);
        console.error('Node name changed', this.json.nodes[nodeIndex].name, node.name, this.json.nodes[nodeIndex].mesh, node.mesh);
      }
      const transform = Transform.fromMat4(new Float32Array(node.localTransform));
      transform.worldTransform.mat4 = new Float32Array(node.worldTransform);

      transform.label = node.name;
      // transform.needsCalculate = false;
      const entity = entityManager.createEntity(node.name);

      entities[nodeIndex] = entity;
      transforms[nodeIndex] = transform;
      // entityManager.addComponents(entity, [transform]);

      if (nodeIndex === 0 && rootTransform) {
        transform.parent = rootTransform;
        transform.multiply(transform.worldTransform, rootTransform.worldTransform.mat4, transform.localTransform.mat4);
        rootTransform.children.push(transform);
      } else if (typeof node.parent === 'number') {
        const parentT = transforms[node.parent];
        transform.parent = parentT;
        parentT.children.push(transform);
      }

      if (this.json.nodes[nodeIndex].skin !== undefined) {
        entityManager.addComponents(entity, [skeletons[this.json.nodes[nodeIndex].skin!]]);
      }

      if (typeof node.mesh === 'number') {
        const mesh = this.meshes[node.mesh];

        const geometry: Geometry = geometryFactory.createGeometryFromInterleaved(mesh.name,
          mesh.shader,
          // VertexShaderName.LIT_TANGENTS_VEC4,
          new Float32Array(mesh.data),
          new Uint32Array(mesh.indices));

        const gltfMaterial = this.json.materials[mesh.material];
        const matName = gltfMaterial.name || `unnamed-mat-${Math.random()}`;
        if (usedMaterials.get(matName)) {
          const usedMesh = usedMaterials.get(matName)!;
          entityManager.addComponents(entity, [
            new Mesh(usedMesh.pipelineId, geometry,
              usedMesh.material, usedMesh.instanceBuffers, usedMesh.label)
          ]);
        } else {
          const pbr = gltfMaterial.pbrMetallicRoughness || {};
          const baseColorFactor = pbr.baseColorFactor || [1.0, 1.0, 1.0, 1.0];
          const metallicFactor = pbr.metallicFactor ?? 1.0;
          const roughnessFactor = pbr.roughnessFactor ?? 1.0;

          let normal = gltfMaterial.normalTexture
            ? this.getTextureAtIndex(gltfMaterial.normalTexture.index, textureManager)
            : textureManager.getTexture(Texture.DEFAULT_NORMAL_MAP);
          const albedo = pbr.baseColorTexture
            ? this.getTextureAtIndex(pbr.baseColorTexture.index, textureManager)
            : textureManager.getTexture(Texture.DEFAULT_ALBEDO_MAP);
          const metallicRoughness = pbr.metallicRoughnessTexture
            ? this.getTextureAtIndex(pbr.metallicRoughnessTexture.index, textureManager)
            : textureManager.getTexture(Texture.DEFAULT_METALLIC_ROUGHNESS_MAP);
          const metallicRoughnessFactor = vec2.fromValues(metallicFactor, roughnessFactor);

          const blendMode = gltfMaterial.alphaMode === 'BLEND' ? BlendPresets.TRANSPARENT : undefined;
          const pbrMaterialProperties = new PBRMaterialProperties(
            albedo, normal, metallicRoughness, new Float32Array(baseColorFactor), metallicRoughnessFactor);

          const material = materialFactory.pbrMaterial(gltfMaterial.name,
            pbrMaterialProperties,
            {
              colorAttachment: { blendMode } as PipelineColorAttachment,
              // cullFace: 'back'
              cullFace: gltfMaterial.doubleSided ? 'none' : 'back'
            });

          const bindGroupHelper = this.json.nodes[nodeIndex].skin !== undefined
            ? skinBindGroupHelpers[this.json.nodes[nodeIndex].skin!]
            : bgHelper;
          console.log(this.json.nodes[nodeIndex].skin, bindGroupHelper);
          const gpuMesh = new Mesh(
            shaderManager.createPipeline(geometry, material, mesh.name, bindGroupHelper.bindGroupLayoutId),
            geometry, material, [{
              bindGroupId: bindGroupHelper.bindGroupId,
              bufferId: bindGroupHelper.bufferId
            }], mesh.name);
          entityManager.addComponents(entity, [gpuMesh]);
          usedMaterials.set(matName, gpuMesh);
        }
      }
    }

    // console.log(new Float32Array(this.skins[0]), JSON.stringify(new Float32Array(this.skins[0])));
    /*    if (this.json.skins) {
          for (let i = 0; i < this.json.skins.length; i++){
            const skin = this.json.skins[i];
            const rootJoint = this.json.nodes[skin.skeleton];
            const skeleton = new Skeleton(rootJoint.name, [], this.skins[i]);
            for (let j = 0; j < skin.joints.length; j++){
              const joint = skin.joints[j];
              skeleton.joints.push(entities[joint]);
              // const transform = transforms[joint];
              // const inverseBindMatrix  = mat4.copy(mat4.create(), new Float32Array(this.skins[i], j * 16 * 4, 16));
              // transform.multiply(transform.worldTransform, transform.worldTransform.mat4, inverseBindMatrix);
            }
            nodesWithSkin[i]
          }
        }*/

    for (let s = 0; s < skeletons.length; s++) {
      for (let i = 0; i < skeletons[s].joints.length; i++) {
        skeletons[s].joints[i] = entities[i];
      }
    }

    for (let i = 0; i < transforms.length; i++) {
      const t = transforms[i];
      t.localTransform.position = mat4.getTranslation(t.localTransform.position, t.localTransform.mat4);
      t.localTransform.rotation = mat4.getRotation(t.localTransform.rotation, t.localTransform.mat4);
      t.localTransform.scale = mat4.getScaling(t.localTransform.scale, t.localTransform.mat4);

      t.worldTransform.position = mat4.getTranslation(t.worldTransform.position, t.worldTransform.mat4);
      t.worldTransform.rotation = mat4.getRotation(t.worldTransform.rotation, t.worldTransform.mat4);
      t.worldTransform.scale = mat4.getScaling(t.worldTransform.scale, t.worldTransform.mat4);

      t.copy(t.targetTransform, t.localTransform);
      entityManager.addComponents(entities[i], [t]);
    }

    return entities;
    /*const buildNode = (array: EntityId[], nodeIndex: number, parentTransform?: Transform): EntityId[] => {
      const node = this.json.nodes[nodeIndex];
      const entity = entityManager.createEntity(node.name);
      nodesToEntity.set(nodeIndex, entity);
      array.push(entity);
      const transform = this.parseTransform(node);

      transform.label = node.name;
      if (parentTransform) {
        transform.parent = parentTransform;
        parentTransform.children.push(transform);
      }

      if (typeof node.mesh === 'number') {
        const mesh = this.meshes[node.mesh];

        const geometry: Geometry = geometryFactory.createGeometryFromInterleaved(mesh.name,
          VertexShaderName.LIT_TANGENTS_VEC4,
          new Float32Array(mesh.data),
          new Uint32Array(mesh.indices));

        const gltfMaterial = this.json.materials[mesh.material];
        const matName = gltfMaterial.name || `unnamed-mat-${Math.random()}`;
        if (usedMaterials.get(matName)) {
          const usedMesh = usedMaterials.get(matName)!;
          entityManager.addComponents(entity, [
            new Mesh(usedMesh.pipelineId, geometry,
              usedMesh.material, usedMesh.instanceBuffers, usedMesh.label)
          ]);
        } else {
          const pbr = gltfMaterial.pbrMetallicRoughness || {};
          const baseColorFactor = pbr.baseColorFactor || [1.0, 1.0, 1.0, 1.0];
          const metallicFactor = pbr.metallicFactor ?? 1.0;
          const roughnessFactor = pbr.roughnessFactor ?? 1.0;

          let normal = gltfMaterial.normalTexture
            ? this.getTextureAtIndex(gltfMaterial.normalTexture.index, textureManager)
            : textureManager.getTexture(Texture.DEFAULT_NORMAL_MAP);
          const albedo = pbr.baseColorTexture
            ? this.getTextureAtIndex(pbr.baseColorTexture.index, textureManager)
            : textureManager.getTexture(Texture.DEFAULT_ALBEDO_MAP);
          const metallicRoughness = pbr.metallicRoughnessTexture
            ? this.getTextureAtIndex(pbr.metallicRoughnessTexture.index, textureManager)
            : textureManager.getTexture(Texture.DEFAULT_METALLIC_ROUGHNESS_MAP);
          const metallicRoughnessFactor = vec2.fromValues(metallicFactor, roughnessFactor);

          const blendMode = gltfMaterial.alphaMode === 'BLEND' ? BlendPresets.TRANSPARENT : undefined;
          const pbrMaterialProperties = new PBRMaterialProperties(
            albedo, normal, metallicRoughness, new Float32Array(baseColorFactor), metallicRoughnessFactor);

          const material = materialFactory.pbrMaterial(gltfMaterial.name,
            pbrMaterialProperties,
            {
              colorAttachment: { blendMode } as PipelineColorAttachment,
              // cullFace: 'back'
              cullFace: gltfMaterial.doubleSided ? 'none' : 'back'
            });

          const gpuMesh = new Mesh(
            shaderManager.createPipeline(geometry, material),
            geometry, material, [{
              bindGroupId: bgHelper.bindGroupId,
              bufferId: bgHelper.bufferId
            }], mesh.name);
          entityManager.addComponents(entity, [gpuMesh]);
          usedMaterials.set(matName, gpuMesh);
        }
      }
      // }

      if (typeof node.skin === 'number') {
        // if (!usedSkeletons.has(node.skin)) {
        //     const skeleton = this.parseSkin(node.name, this.json.skins[node.skin]);
        //     usedSkeletons.set(node.skin, skeleton);
        //     entityManager.addComponents(entity, [skeleton]);
        // }
      }

      entityManager.addComponents(entity, [transform]);

      if (node.children) {
        for (const childIndex of node.children) {
          buildNode(array, childIndex, transform);
        }
      }

      return array;
    };

    const startOffset = 0;

    const arr: EntityId[] = [];
    if (!this.json.scenes) {
      console.warn('No scenes present, creating meshes from the nodes');
      return buildNode([], startOffset);
    }

    for (const sceneNode of this.json.scenes[this.json.scene].nodes) {
      buildNode(arr, sceneNode, rootTransform);
    }

    return arr;*/
  }

  private getTextureAtIndex(texture: number, textureManager: TextureManager) {
    const img = this.imageBitmaps[this.json.textures[texture].source];
    return textureManager.addPreloadedToGlobalTexture(img.name, img.imageBitmaps);
  }

  private parseTransform(node: GLTFNode) {
    if (node.matrix) {
      return Transform.fromMat4(node.matrix);
    }


    if (node.rotation || node.scale || node.translation) {
      if (node.scale && node.scale[0] > 10) {
        // console.warn('Large scale detected', JSON.stringify(node), node);
        node.scale = [0.01, 0.01, 0.01];
      }
      if (node.translation && node.translation[0] > 100) {
        // console.warn('Large transaltion detected', JSON.stringify(node));
        // node.translation = [0, 0, 0];
      }
      return new Transform(
        node.translation || vec3.fromValues(0, 0, 0),
        node.rotation || quat.create(),
        node.scale || vec3.fromValues(1, 1, 1));
    }

    return defaultTransform();
  }

  static styles = [
    'background: #12aabb; color: #223344',
    'background: #647796; color: #223344',
    'background: #FFFF00; color: #223344',
  ];
  static index = 0;

  public static async parseGlb(rootDir: string, relativePath: string, textureManager: TextureManager): Promise<GLTFParser> {
    const style = this.styles[this.index++ % 3];
    // console.log(`%c BEGIN LOADING ${rootDir + relativePath} GLB`, style);
    return fetch(rootDir + relativePath, { cache: 'force-cache' })
      .then(res => res.arrayBuffer())
      .then(buffer => {
        // console.log(`%c LOADED ${rootDir + relativePath} ABOUT TO CALL WORKER`, style);
        return this.glbWorkerPool.submit({ binary: buffer, name: rootDir + relativePath, style }, [buffer]);
      })
      .then(resp => {
        // console.log(`%c WORKER FINISHED ${rootDir + relativePath}`, style, resp);
        return new GLTFParser(resp.json, resp.imageBitmaps, resp.meshes, resp.nodes, resp.skins);
      });
  }
}

export interface GLTFJson {
  animations: GLTFAnimation[],
  accessors: GLTFAccessor[]
  asset: {
    version: string;
    generator?: string;
  }
  bufferViews: GLTFBufferView[],
  buffers: GLTFBuffer[],
  images: GLTFImage[],
  materials: GLTFMaterial[],
  meshes: GLTFMesh[]
  nodes: GLTFNode[]
  samplers: GLTFSampler[]
  scene: number
  scenes: GLTFScene[]
  textures: [{ sampler: number, source: number }]
  skins: GltfSkin[],
}

type AccessorType = 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT4';

type AccessorComponentType = 5120 | 5121 | 5122 | 5123 | 5125 | 5126;

export interface GLTFAccessor {
  bufferView: number,
  byteOffset: number,
  componentType: AccessorComponentType,
  count: number,
  max: number[],
  min: number[]
  type: AccessorType,
}

export interface GLTFMesh {
  name: string,
  primitives: GLTFMeshPrimitive[]
}

export interface GLTFPrimitiveAttribute {
  NORMAL: number,
  POSITION: number,
  TANGENT: number,
  TEXCOORD_0: number,
  TEXCOORD_1: number,
  TEXCOORD_2: number,
  TEXCOORD_3: number,
  WEIGHTS_0?: number,
  JOINTS_0?: number,
};

export interface GLTFMeshPrimitive {
  attributes: GLTFPrimitiveAttribute,
  indices: number,
  material: number,
  mode: number
}

export interface GLTFScene {
  nodes: number[];
}

export interface GLTFNode {
  name: string,
  matrix?: mat4,
  mesh?: number;
  skin?: number;
  children: number[];
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
}

export interface GLTFBuffer {
  uri: string;
  byteLength: number;
}

export interface GLTFBufferView {
  buffer: number;
  byteLength: number;
  byteOffset: number;
  byteStride: number;
  name: string;
  target: GLTFBufferViewTarget;
}

export enum GLTFBufferViewTarget {
  ARRAY_BUFFER         = 34962, // The buffer view contains vertex data (e.g., positions, normals, UVs).
  ELEMENT_ARRAY_BUFFER = 34963 // The buffer view contains index data for drawing elements.
}

export interface GLTFMaterial {
  name: string;
  alphaMode?: 'MASK' | 'BLEND',
  alphaCutoff?: number,
  doubleSided?: boolean,
  normalTexture?: GLTFTextureRef,
  emissiveFactor?: number,
  pbrMetallicRoughness: {
    baseColorFactor: number[],
    baseColorTexture: GLTFTextureRef,
    metallicRoughnessTexture: GLTFTextureRef,
    metallicFactor?: number,
    roughnessFactor?: number,
  }
}

export interface GLTFTextureRef {
  index: number,
  texCoord?: number,
}

export interface GLTFImage {
  uri?: string;
  bufferView?: number;
  mimeType?: string;
}


export interface GLTFSampler {
  magFilter?: GLTFSamplerFilter,
  minFilter?: GLTFSamplerFilter,
  wrapS?: GLTFSamplerFilter,
  wrapT?: GLTFSamplerFilter,
}

export enum GLTFSamplerFilter {
  LINEAR          = 9729,
  MIP_MAP_LINEAR  = 9987,
  REPEAT_WRAPPING = 10497
}

export interface GltfSkin {
  joints: number[]; // Indices of nodes representing bones
  inverseBindMatrices: number; // Bind pose matrices
  skeleton: number; // Root bone index (if available)
}

export interface GLTFAnimation {
  channels: GLTFAnimationChannel[],
  name: string,
  samplers: GLTFAnimationSampler[],
}

export interface GLTFAnimationChannel {
  sampler: number,
  target: { node: number, path: 'translation' | 'rotation' | 'scale' }
}

export interface GLTFAnimationSampler {
  input: number,
  interpolation: 'LINEAR' | 'STEP' | 'CUBICSPLINE',
  output: number,
}

export interface AnimationChannel {
  targetNode: number; // Node index affected by this animation
  targetPath: 'translation' | 'rotation' | 'scale'; // Type of transformation
  samplerIndex: number; // Index of the associated sampler
}

export interface AnimationSampler {
  keyframes: number[]; // Array of keyframe times
  values: (quat[] | vec3[]); // Corresponding transformation values
  interpolation: 'LINEAR' | 'STEP' | 'CUBICSPLINE'; // Interpolation type
}


const GLTFRenderMode = {
  POINTS: 0,
  LINE: 1,
  LINE_LOOP: 2,
  LINE_STRIP: 3,
  TRIANGLES: 4,
  TRIANGLE_STRIP: 5,
  // Note: fans are not supported in WebGPU, use should be
  // an error or converted into a list/strip
  TRIANGLE_FAN: 6,
};

const GLTFComponentType = {
  BYTE: 5120,
  UNSIGNED_BYTE: 5121,
  SHORT: 5122,
  UNSIGNED_SHORT: 5123,
  INT: 5124,
  UNSIGNED_INT: 5125,
  FLOAT: 5126,
  DOUBLE: 5130,
};

const GLTFTextureFilter = {
  NEAREST: 9728,
  LINEAR: 9729,
  NEAREST_MIPMAP_NEAREST: 9984,
  LINEAR_MIPMAP_NEAREST: 9985,
  NEAREST_MIPMAP_LINEAR: 9986,
  LINEAR_MIPMAP_LINEAR: 9987,
};

const GLTFTextureWrap = {
  REPEAT: 10497,
  CLAMP_TO_EDGE: 33071,
  MIRRORED_REPEAT: 33648,
};


// parseAnimations(): Animation[] {
//     const animations = this.json.animations || [];
//     const parsedAnimations: Animation[] = [];
//
//     for (const anim of animations) {
//         const channels: AnimationChannel[] = [];
//         const samplers: AnimationSampler[] = [];
//
//         // Parse samplers
//         for (const sampler of anim.samplers) {
//             const inputAccessor = this.json.accessors[sampler.input];
//             const outputAccessor = this.json.accessors[sampler.output];
//
//             // Decode input (keyframe times)
//             const inputBufferView = this.json.bufferViews[inputAccessor.bufferView];
//             const inputBuffer = this.json.buffers[inputBufferView.buffer];
//             const inputOffset = (inputBufferView.byteOffset || 0) + (inputAccessor.byteOffset || 0);
//             const inputTimes = new Float32Array(inputBuffer, inputOffset, inputAccessor.count);
//
//             // Decode output (transform values)
//             const outputBufferView = this.json.bufferViews[outputAccessor.bufferView];
//             const outputBuffer = this.json.buffers[outputBufferView.buffer];
//             const outputOffset = (outputBufferView.byteOffset || 0) + (outputAccessor.byteOffset || 0);
//             let outputValues: any;
//             if (outputAccessor.type === 'VEC3') {
//                 outputValues = new Float32Array(outputBuffer, outputOffset, outputAccessor.count * 3);
//             } else if (outputAccessor.type === 'VEC4') {
//                 outputValues = new Float32Array(outputBuffer, outputOffset, outputAccessor.count * 4);
//             }
//
//             // Normalize values for each keyframe
//             const parsedOutput: vec3[] | quat[] = [];
//             for (let i = 0; i < outputAccessor.count; i++) {
//                 if (outputAccessor.type === 'VEC3') {
//                     parsedOutput.push(vec3.fromValues(
//                         outputValues[i * 3],
//                         outputValues[i * 3 + 1],
//                         outputValues[i * 3 + 2]
//                     ));
//                 } else if (outputAccessor.type === 'VEC4') {
//                     parsedOutput.push(quat.fromValues(
//                         outputValues[i * 4],
//                         outputValues[i * 4 + 1],
//                         outputValues[i * 4 + 2],
//                         outputValues[i * 4 + 3]
//                     ));
//                 }
//             }
//
//             samplers.push({
//                 input: Array.from(inputTimes),
//                 output: parsedOutput,
//                 interpolation: sampler.interpolation,
//             });
//         }
//
//         // Parse channels
//         for (const channel of anim.channels) {
//             channels.push({
//                 targetNode: channel.target.node,
//                 targetPath: channel.target.path as 'translation' | 'rotation' | 'scale',
//                 samplerIndex: channel.sampler,
//             });
//         }
//
//         parsedAnimations.push({ channels, samplers });
//     }
//
//     return parsedAnimations;
// }


/*

public parseSkeletons(shaderManager: ShaderManager,
    geometryFactory: GeometryFactory,
    materialFactory: MaterialFactory,
    resourceManager: ResourceManager,
    entityManager: EntityManager): Skeleton[] {
    const skeletons: Skeleton[] = [];

    for (const skin of this.json.skins) {
        const joints = skin.joints; // Array of node indices
        const inverseBindMatricesAccessor = skin.inverseBindMatrices;

        // Decode inverse bind matrices
        const inverseBindMatrices: mat4[] = [];
        if (inverseBindMatricesAccessor !== undefined) {
            const accessor = this.json.accessors[inverseBindMatricesAccessor];
            const bufferView = this.json.bufferViews[accessor.bufferView];
            const buffer = this.buffers[bufferView.buffer];
            const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
            const byteLength = accessor.count * 16 * Float32Array.BYTES_PER_ELEMENT; // 16 floats per mat4
            const rawData = new Float32Array(buffer, byteOffset, accessor.count * 16);
            console.log(accessor, bufferView, buffer)

            for (let i = 0; i < accessor.count; i++) {
                const matrix = rawData.slice(i * 16, (i + 1) * 16) as mat4;
                inverseBindMatrices.push(matrix);
            }
        }

        // for (let i = 0; i < joints.length; i++) {
        //     const jointIndex = joints[i];
        //     const node = this.json.nodes[jointIndex];
        //
        //     // Use animation transform if available, otherwise use node's base transform
        //     const localTransform = animationTransforms[jointIndex] || mat4.create();
        //     if (!animationTransforms[jointIndex]) {
        //         mat4.fromTranslation(localTransform, node.translation || [0, 0, 0]);
        //         mat4.rotate(localTransform, localTransform, node.rotation || [0, 0, 0, 1]);
        //         mat4.scale(localTransform, localTransform, node.scale || [1, 1, 1]);
        //     }
        //
        //     // Combine with parent's global transform
        //     const parentIndex = node.parent; // Get parent node index
        //     const globalTransform = mat4.create();
        //     if (parentIndex !== undefined && globalTransforms[parentIndex]) {
        //         mat4.multiply(globalTransform, globalTransforms[parentIndex], localTransform);
        //     } else {
        //         mat4.copy(globalTransform, localTransform);
        //     }
        //     globalTransforms.push(globalTransform);
        //
        //     // Combine global transform with inverse bind matrix
        //     const jointMatrix = mat4.create();
        //     mat4.multiply(jointMatrix, globalTransform, skeleton.inverseBindMatrices[i]);
        //     jointMatrices.push(jointMatrix);
        // }

        const rootNode = this.json.nodes[skin.skeleton]
        // @ts-ignore
        skeletons.push(new Skeleton(rootNode.name, joints, inverseBindMatrices));
        console.log('Parsed skeletons: ', skeletons);
        console.log(joints.length, inverseBindMatrices.length)
        console.log('Root node is: ', skin.skeleton, this.json.nodes[skin.skeleton]);
    }

    return skeletons;
}
*/
