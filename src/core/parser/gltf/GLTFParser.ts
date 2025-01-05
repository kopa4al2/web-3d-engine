import AnimationComponent, { Animation, AnimationProperty, AnimationTrack } from 'core/animation/AnimationComponent';
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
  GlbWorkerNode,
  SerializedAnimation
} from 'core/parser/gltf/workers/GlbLoader.worker';
import { GLTFWorkerRequest, GLTFWorkerResponse } from 'core/parser/gltf/workers/GLTFWorker';
import { BindGroupHelper } from 'core/rendering/Helpers';
import { BlendPresets } from 'core/resources/gpu/Blend';
import { PipelineColorAttachment, UniformVisibility } from 'core/resources/gpu/GpuShaderData';
import ResourceManager from 'core/resources/ResourceManager';
import ShaderManager from 'core/resources/shader/ShaderManager';
import TextureManager from 'core/resources/TextureManager';
import Texture from 'core/texture/Texture';
import WorkerPool from 'core/worker/WorkerPool';
import { mat4, quat, vec2, vec3 } from 'gl-matrix';
import log from 'utils/Logger';
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
              public skins: ArrayBuffer[],
              public animations: SerializedAnimation[]) {
    DebugUtil.addToWindowObject('gltf', this);
    console.log('ANIMATIONS: ', animations);
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
      byteLength: 8096,
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
        const skeletonBindGroup = new BindGroupHelper(resourceManager, 'SKINNED',
          [
            {
              type: 'storage',
              byteLength: 8096,
              name: 'InstanceData',
              visibility: UniformVisibility.VERTEX
            },
            {
              type: 'uniform',
              byteLength: arrayBuffer.byteLength,
              name: 'inverseJoinBindMatrix',
              visibility: UniformVisibility.VERTEX
            }
          ]);
        skinBindGroupHelpers.push(skeletonBindGroup);

        const skeleton = new Skeleton(rootJoint.name, new Array(skin.joints.length), arrayBuffer, skeletonBindGroup);

        skeletons.push(skeleton);
      }

    }

    const usedMaterials = new JavaMap<string, Mesh>();
    const entities: EntityId[] = new Array(this.nodes.length);
    const transforms: Transform[] = new Array(this.nodes.length);
    for (let nodeIndex = 0; nodeIndex < this.nodes.length; nodeIndex++) {
      const node = this.nodes[nodeIndex];
      const transform = Transform.fromMat4(new Float32Array(node.localTransform));
      transform.fromMat4(transform.worldTransform, new Float32Array(node.worldTransform));
      // transform.needsCalculate = false;
      transform.label = node.name;
      const entity = entityManager.createEntity(node.name);

      entities[nodeIndex] = entity;
      transforms[nodeIndex] = transform;

      if (nodeIndex === 0) {
        transform.scaleBy(0.01);
      }
      if (typeof node.parent !== 'number' && rootTransform) {
        transform.parent = rootTransform;
        transform.multiply(transform.worldTransform, rootTransform.worldTransform.mat4, transform.localTransform.mat4);
        rootTransform.children.push(transform);
      } else if (typeof node.parent === 'number') {
        const parentT = transforms[node.parent];
        transform.parent = parentT;
        parentT.children.push(transform);
        // transform.multiply(transform.worldTransform, parentT.worldTransform.mat4, transform.localTransform.mat4);
      } else {
        console.warn('Edge case', node);
      }

      if (this.json.nodes[nodeIndex].skin !== undefined) {
        entityManager.addComponents(entity, [skeletons[this.json.nodes[nodeIndex].skin!]]);
      }

      if (typeof node.mesh === 'number') {
        const mesh = this.meshes[node.mesh];

        const geometry: Geometry = geometryFactory.createGeometryFromInterleaved(mesh.name,
          mesh.shader,
          new Float32Array(mesh.data),
          new Uint32Array(mesh.indices));

        const gltfMaterial = this.json.materials[mesh.material];
        const matName = gltfMaterial.name || `unnamed-mat-${Math.random()}`;
        if (usedMaterials.get(matName)) {
          console.warn('Duplicate material', matName);
          const usedMesh = usedMaterials.get(matName)!;
          entityManager.addComponents(entity, [
            new Mesh(usedMesh.pipelineId, geometry,
              usedMesh.material, usedMesh.instanceBuffers, usedMesh.label)
          ]);
        } else {
          const material = this.parseMaterial(gltfMaterial, textureManager, materialFactory);

          const bindGroupHelper = this.json.nodes[nodeIndex].skin !== undefined
                                  ? skinBindGroupHelpers[this.json.nodes[nodeIndex].skin!]
                                  : bgHelper;

          const gpuMesh = new Mesh(
            shaderManager.createPipeline(geometry, material, mesh.name, bindGroupHelper.bindGroupLayoutId),
            geometry, material, [{
              bindGroupId: bindGroupHelper.bindGroupId,
              bufferId: bindGroupHelper.getBuffer(0)
            }], mesh.name);
          entityManager.addComponents(entity, [gpuMesh]);
          usedMaterials.set(matName, gpuMesh);
        }
      }
    }

    for (let s = 0; s < skeletons.length; s++) {
      for (let i = 0; i < skeletons[s].joints.length; i++) {
        const entityIndex = this.json.skins[s].joints[i];
        skeletons[s].joints[i] = entities[entityIndex];
      }
    }

    for (let i = 0; i < transforms.length; i++) {
      const t = transforms[i];
      t.localTransform.position = mat4.getTranslation(t.localTransform.position, t.localTransform.mat4);
      t.localTransform.rotation = mat4.getRotation(t.localTransform.rotation, t.localTransform.mat4);
      t.localTransform.scale = mat4.getScaling(t.localTransform.scale, t.localTransform.mat4);

      // t.worldTransform.position = mat4.getTranslation(t.worldTransform.position, t.worldTransform.mat4);
      // t.worldTransform.rotation = mat4.getRotation(t.worldTransform.rotation, t.worldTransform.mat4);
      // t.worldTransform.scale = mat4.getScaling(t.worldTransform.scale, t.worldTransform.mat4);

      t.copy(t.targetTransform, t.localTransform);
      entityManager.addComponents(entities[i], [t]);
    }

    if (this.animations) {
      const animations: Record<string, Animation> = {};
      for (let i = 0; i < this.animations.length; i++) {
        const animation: Animation = {
          duration: 0,
          tracks: [],
        };

        const gltfAnimation = this.animations[i];
        const channelsView = new Uint16Array(gltfAnimation.channels);

        for (let j = 0; j < channelsView.length; j += 3) {
          const targetNode = channelsView[j];
          const animProperty = AnimationProperty[channelsView[j + 1]] as keyof typeof AnimationProperty;
          const samplerIndex = channelsView[j + 2];

          const sampler = gltfAnimation.samplers[samplerIndex];
          const interpolation = sampler.interpolation;
          const inputsView = new Float32Array(sampler.inputs),
            outputsView = new Float32Array(sampler.output);

          const valueSize = outputsView.length / inputsView.length;

          const animationTrack: AnimationTrack = {
            targetEntity: entities[targetNode],
            property: AnimationProperty[animProperty],
            keyframes: [],
          };
          animation.tracks.push(animationTrack);
          for (let k = 0; k < inputsView.length; k++) {
            // const value = outputsView.slice(k * valueSize, (k + 1) * valueSize);
            const index = k * valueSize;
            const value = valueSize === 4
                          ? quat.fromValues(outputsView[index], outputsView[index + 1], outputsView[index + 2], outputsView[index + 3])
                          : vec3.fromValues(outputsView[index], outputsView[index + 1], outputsView[index + 2]);
            animationTrack.keyframes.push({
              time: inputsView[k], // Keyframe time
              value,          // Transformation value (vec3 or quat)
              interpolation,  // Interpolation method
            });
          }

          animation.duration = Math.max(...animation.tracks.flatMap(track => track.keyframes.map(kf => kf.time)));
          animations[gltfAnimation.name] = animation;
        }
      }
      const animationComponent = new AnimationComponent(animations, Object.keys(animations)[0], 0, 1.0, true);
      // const animationComponent = new AnimationComponent(animations, Object.keys(animations)[1], 0, 1.0, true);
      const animEntity = entityManager.createEntity('animations');
      entityManager.addComponents(animEntity, [animationComponent]);
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

  private parseMaterial(gltfMaterial: GLTFMaterial, textureManager: TextureManager, materialFactory: MaterialFactory) {
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

    return materialFactory.pbrMaterial(gltfMaterial.name,
      pbrMaterialProperties,
      {
        colorAttachment: { blendMode } as PipelineColorAttachment,
        cullFace: gltfMaterial.doubleSided ? 'none' : 'back'
      });
  }

  private getTextureAtIndex(texture: number, textureManager: TextureManager) {
    const img = this.imageBitmaps[this.json.textures[texture].source];
    return textureManager.addPreloadedToGlobalTexture(img.name, img.imageBitmaps);
  }

  static styles = [
    'background: #12aabb; color: #223344',
    'background: #647796; color: #223344',
    'background: #FFFF00; color: #223344',
  ];
  static index = 0;

  public static async parseGlb(rootDir: string, relativePath: string, rootTransform = mat4.create()): Promise<GLTFParser> {
    const style = this.styles[this.index++ % 3];
    // console.log(`%c BEGIN LOADING ${rootDir + relativePath} GLB`, style);
    const rootBuffer = (rootTransform as Float32Array).buffer as ArrayBuffer;
    return fetch(rootDir + relativePath, { cache: 'force-cache' })
      .then(res => res.arrayBuffer())
      .then(buffer => {
        // console.log(`%c LOADED ${rootDir + relativePath} ABOUT TO CALL WORKER`, style);
        return this.glbWorkerPool.submit({ binary: buffer, name: rootDir + relativePath, style, rootTransform: rootBuffer }, [buffer, rootBuffer]);
      })
      .then(resp => {
        // console.log(`%c WORKER FINISHED ${rootDir + relativePath}`, style, resp);
        return new GLTFParser(resp.json, resp.imageBitmaps, resp.meshes, resp.nodes, resp.skins, resp.animations);
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
  ARRAY_BUFFER = 34962, // The buffer view contains vertex data (e.g., positions, normals, UVs).
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
  LINEAR = 9729,
  MIP_MAP_LINEAR = 9987,
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