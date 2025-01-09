import { AnimationProperty, AnimationStep } from 'core/animation/AnimationComponent';
import { GeometryData } from 'core/mesh/Geometry';
import { GLTFJson, GLTFNode } from 'core/parser/gltf/GLTFParser';
import { GLBWorkerRequest, GLBWorkerResponse } from 'core/parser/gltf/workers/GlbImageLoader.worker';
import WorkerPool from 'core/worker/WorkerPool';
import { mat4, quat, vec2, vec3 } from 'gl-matrix';
import { GlbGeometryParseRequest } from 'core/parser/gltf/workers/GlbAccessorParser.worker';
import { GeometryStride } from 'core/factories/GeometryFactory';
import { VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import MathUtil from "utils/MathUtil";

export interface GlbJsonParserRequest {
  binary: ArrayBuffer,
  rootTransform: ArrayBuffer,
  name: string,
  style: string,
}

export interface GlbJsonParserResponse {
  meshes: GlbWorkerMesh[],
  imageBitmaps: GlbWorkerImage[],
  json: GLTFJson,
  nodes: GlbWorkerNode[],
  skins: ArrayBuffer[],
  animations: SerializedAnimation[],
}

export interface GlbWorkerImage {
  imageBitmaps: ImageBitmap,
  name: string
}

export interface GlbWorkerMesh {
  name: string,
  data: ArrayBuffer,
  indices: ArrayBuffer,
  material: number,
  shader: VertexShaderName,
}

export interface GlbWorkerNode {
  name: string,
  parent?: number,
  mesh?: number,
  localTransform: ArrayBuffer,
  worldTransform: ArrayBuffer,
}

export interface SerializedAnimation {
  name: string,
  channels: ArrayBuffer,
  samplers: SerializedSampler[],
}

export interface SerializedSampler {
  interpolation: AnimationStep,
  inputs: ArrayBuffer,
  output: ArrayBuffer,
}

export enum Attribute {
  INDICES   = 0,
  POSITIONS = 1,
  NORMALS   = 2,
  TANGENT   = 3,
  JOINTS    = 4,
  WEIGHTS   = 5,
  UV_0      = 6,
  UV_1      = 7,
  UV_2      = 8,
  SKIN      = 9,
  SAMPLER_INPUT,
  SAMPLER_OUTPUT,
}

interface Accessor {
  data: number[],
  attribute: Attribute,
  mesh: number,
  index?: number,
  // accessor: any,
}

const typeToSize: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT4: 16,
};

function deleteUnneededJsonProperties(json: GLTFJson) {
  // @ts-ignore
  delete json.bufferViews;
  // @ts-ignore
  delete json.accessors;
  // @ts-ignore
  delete json.asset;
  // @ts-ignore
  delete json.meshes;
  // @ts-ignore
  delete json.images;
  // @ts-ignore
  delete json.buffers;
}

function getTransform(node: GLTFNode) {
  if (node.matrix) {
    return mat4.copy(mat4.create(), node.matrix);
  }

  if (node.rotation || node.scale || node.translation) {

    return mat4.fromRotationTranslationScale(mat4.create(),
      node.rotation || quat.create(),
      node.translation || vec3.create(),
      node.scale || vec3.fromValues(1, 1, 1));
  }

  return mat4.create();
}

function parseNodes(json: GLTFJson, buffersToTransfer: Transferable[]) {
  const rootNode = json.scene;
  const nodes: GlbWorkerNode[] = Array(json.nodes.length);

  traverse(rootNode);
  return nodes;

  function traverse(nodeIdx: number, parentTransform?: mat4, parent?: number) {
    const node = json.nodes[nodeIdx];
    let localTransform = getTransform(node);
    const worldTransform = mat4.create();

    const worldTransformBuffer: ArrayBuffer = (worldTransform as Float32Array).buffer as ArrayBuffer;
    const localTransformBuffer: ArrayBuffer = (localTransform as Float32Array).buffer as ArrayBuffer;
    buffersToTransfer.push(worldTransformBuffer, localTransformBuffer);
    if (nodes[nodeIdx]) {
      console.warn('Duplicate node name: ', nodes[nodeIdx].name, node.name, nodeIdx);
    }
    nodes[nodeIdx] = {
      name: node.name,
      parent,
      mesh: node.mesh,
      worldTransform: worldTransformBuffer,
      localTransform: localTransformBuffer
    };
    if (node.children) {
      for (const child of node.children) {
        traverse(child, worldTransform, nodeIdx);
      }
    }
  }

}

self.onmessage = async (event: MessageEvent<GlbJsonParserRequest>) => {
  const fileArrayBuffer = event.data.binary;
  const parsedJson = parseJson(fileArrayBuffer);
  const json = parsedJson.json;
  const binaryChunkOffset = parsedJson.binaryChunkOffset;

  const imageLoadingWorkerPool = new WorkerPool<GLBWorkerRequest, GLBWorkerResponse>();
  const bufferViewWorkerPool = new WorkerPool<GlbGeometryParseRequest, ArrayBuffer[]>();
  const imageResults = [];
  imageLoadingWorkerPool.addWorker(new Worker(new URL('./GlbImageLoader.worker.ts', import.meta.url), { name: 'GLB-Image-Worker-1' }));
  imageLoadingWorkerPool.addWorker(new Worker(new URL('./GlbImageLoader.worker.ts', import.meta.url), { name: 'GLB-Image-Worker-2' }));

  bufferViewWorkerPool.addWorker(new Worker(new URL('./GlbAccessorParser.worker.ts', import.meta.url), { name: 'GLB-Geometry-Worker-1' }));
  bufferViewWorkerPool.addWorker(new Worker(new URL('./GlbAccessorParser.worker.ts', import.meta.url), { name: 'GLB-Geometry-Worker-2' }));

  const buffersToTransfer: Transferable[] = [];

  const bufferViews: Record<number, ArrayBuffer> = {};
  const accessorsByBufferView: Record<number, Accessor[]> = {};

  const usedBuffers = [];
  for (let i = 0; i < json.images.length; i++) {
    const img = json.images[i];
    const bufferView = json.bufferViews[img.bufferView!];
    const byteOffset = bufferView.byteOffset || 0;

    imageResults.push(imageLoadingWorkerPool
      .submit({
        buffer: fileArrayBuffer.slice(binaryChunkOffset + byteOffset, binaryChunkOffset + byteOffset + bufferView.byteLength),
        mimeType: img.mimeType!
      })
      .then(res => {
        buffersToTransfer.push(res.imageBitmap);
        return { imageBitmaps: res.imageBitmap, name: bufferView.name };
      }));

    usedBuffers.push(img.bufferView);
  }

  for (let i = 0; i < json.bufferViews.length; i++) {
    if (usedBuffers.includes(i)) {
      continue;
    }
    const bufferView = json.bufferViews[i];
    const byteOffset = bufferView.byteOffset || 0;


    bufferViews[i] = fileArrayBuffer.slice(binaryChunkOffset + byteOffset, binaryChunkOffset + byteOffset + bufferView.byteLength);
    accessorsByBufferView[i] = [];
  }

  function groupAccessor(accessorIndex: number | undefined, mesh: number, attribute: Attribute, index?: number) {
    if (accessorIndex === undefined) {
      return;
    }

    const accessor = json.accessors[accessorIndex];
    if (accessor.bufferView === undefined) {
      return;
    }
    const bufferView =
            json.bufferViews[accessor.bufferView];


    const data = [
      accessor.byteOffset || 0, // start
      accessor.componentType,
      accessor.count,
      typeToSize[accessor.type],  // elements per vertex
      bufferView.byteStride || 0  // stride
    ];

    accessorsByBufferView[accessor.bufferView].push({
      data,
      mesh,
      attribute,
      index
      // accessor: { accessor, bufferView }
    });
  }

  for (let i = 0; i < json.meshes.length; i++) {
    const mesh = json.meshes[i];
    for (const primitive of mesh.primitives) {
      groupAccessor(primitive.indices, i, Attribute.INDICES);
      groupAccessor(primitive.attributes.POSITION, i, Attribute.POSITIONS);
      groupAccessor(primitive.attributes.NORMAL, i, Attribute.NORMALS);
      groupAccessor(primitive.attributes.TANGENT, i, Attribute.TANGENT);
      groupAccessor(primitive.attributes.JOINTS_0, i, Attribute.JOINTS);
      groupAccessor(primitive.attributes.WEIGHTS_0, i, Attribute.WEIGHTS);
      if (primitive.attributes.TEXCOORD_0 && primitive.attributes.TEXCOORD_1 && primitive.attributes.TEXCOORD_1 !== primitive.attributes.TEXCOORD_0) {
        groupAccessor(primitive.attributes.TEXCOORD_2, i, Attribute.UV_0);
      } else {
        groupAccessor(primitive.attributes.TEXCOORD_0, i, Attribute.UV_0);
      }
    }
  }

  if (json.skins) {
    for (let i = 0; i < json.skins.length; i++) {
      const skin = json.skins[i];
      groupAccessor(skin.inverseBindMatrices, i, Attribute.SKIN);
    }
  }

  const animations: SerializedAnimation[] = [];
  const membersPerAnimationChannel = 3; // NODE PATH SAMPLER

  if (json.animations) {
    for (let i = 0; i < json.animations.length; i++) {
      const animation = json.animations[i];
      const name = animation.name;

      const uint16Array = new Uint16Array(animation.channels.length * membersPerAnimationChannel);
      const samplers = new Array(animation.samplers.length);
      for (let j = 0; j < animation.samplers.length; j++) {
        groupAccessor(animation.samplers[j].input, j, Attribute.SAMPLER_INPUT, i);
        groupAccessor(animation.samplers[j].output, j, Attribute.SAMPLER_OUTPUT, i);

        samplers[j] = { interpolation: AnimationStep[animation.samplers[j].interpolation] };
      }

      for (let j = 0; j < animation.channels.length; j++) {
        uint16Array[j * membersPerAnimationChannel] = animation.channels[j].target.node;
        uint16Array[(j * membersPerAnimationChannel) + 1] = AnimationProperty[animation.channels[j].target.path];
        uint16Array[(j * membersPerAnimationChannel) + 2] = animation.channels[j].sampler;
      }

      buffersToTransfer.push(uint16Array.buffer);
      animations.push({
        name,
        channels: uint16Array.buffer,
        samplers
      });
    }
  }

  const meshes: Record<number, Record<string, ArrayBuffer>> = {};
  const workerResults = [];
  for (const [index, data] of Object.entries(accessorsByBufferView)) {
    const elementsPerView = 5; // start, componentType, count, elementsPerVertex, stride
    const bufferInfo = new Uint32Array(data.length * elementsPerView);
    for (let j = 0; j < data.length; j++) {
      bufferInfo.set(data[j].data, j * elementsPerView);
    }
    workerResults.push(bufferViewWorkerPool.submit({
      bufferInfo: bufferInfo.buffer,
      buffer: bufferViews[Number(index)]
    }, [bufferViews[Number(index)], bufferInfo.buffer])
      .then(parsedBuffers => {
        for (let j = 0; j < data.length; j++) {
          if (data[j].attribute === Attribute.SAMPLER_INPUT) {
            const samplerIndex = data[j].mesh;
            animations[data[j].index!].samplers[samplerIndex].inputs = parsedBuffers[j];
            buffersToTransfer.push(parsedBuffers[j]);
            continue;
          }
          if (data[j].attribute === Attribute.SAMPLER_OUTPUT) {
            const samplerIndex = data[j].mesh;
            animations[data[j].index!].samplers[samplerIndex].output = parsedBuffers[j];
            buffersToTransfer.push(parsedBuffers[j]);
            continue;
          }

          if (!meshes[data[j].mesh]) {
            meshes[data[j].mesh] = {
              [data[j].attribute]: parsedBuffers[j],
            };
          } else {
            meshes[data[j].mesh][data[j].attribute] = parsedBuffers[j];
          }
        }
      }));
  }

  const nodes = parseNodes(json, buffersToTransfer);

  const imageBitmaps = await Promise.all(imageResults).then(img => {
    imageLoadingWorkerPool.shutdown();
    return img;
  });

  Promise.all(workerResults)
    .then((_) => {
      const meshGeometries = new Array(json.meshes.length);
      const skins: ArrayBuffer[] = [];
      for (let i = 0; i < json.meshes.length; i++) {
        const data = meshes[i];
        if (data[Attribute.SKIN]) {
          skins.push(data[Attribute.SKIN]);
          buffersToTransfer.push(data[Attribute.SKIN]);
        }

        let geometryData: GeometryData = {
          indices: new Uint16Array(data[Attribute.INDICES]),
          vertices: new Float32Array(data[Attribute.POSITIONS]),
          normals: new Float32Array(data[Attribute.NORMALS]),
          texCoords: new Float32Array(data[Attribute.UV_0]),
        };

        if (!data[Attribute.TANGENT]) {
          geometryData = calculateTangentsVec4(geometryData);
        } else {
          geometryData.tangents = new Float32Array(data[Attribute.TANGENT]);
        }

        if (data[Attribute.WEIGHTS]) {
          geometryData.weights = new Float32Array(data[Attribute.WEIGHTS]);
        }

        if (data[Attribute.JOINTS]) {
          geometryData.joints = new Uint16Array(data[Attribute.JOINTS]);
        }

        const isSkinned = (!!geometryData.joints && !!geometryData.weights);
        const stride: GeometryStride = isSkinned
          ? [['vertices', 3], ['texCoords', 2], ['normals', 3], ['tangents', 4], ['joints', 4], ['weights', 4]]
          : [['vertices', 3], ['texCoords', 2], ['normals', 3], ['tangents', 4]];

        const interleavedData = interleaveData(geometryData, stride);
        meshGeometries[i] = {
          name: json.meshes[i].name,
          data: interleavedData,
          indices: data[Attribute.INDICES],
          material: json.meshes[i].primitives[0].material,
          shader: isSkinned ? VertexShaderName.SKINNED_LIT : VertexShaderName.LIT_TANGENTS_VEC4
        };
        buffersToTransfer.push(interleavedData);
        buffersToTransfer.push(data[Attribute.INDICES]);
      }


      // deleteUnneededJsonProperties(json);
      bufferViewWorkerPool.shutdown();
      self.postMessage({
        meshes: meshGeometries,
        imageBitmaps,
        json,
        nodes,
        skins,
        animations,
      }, { transfer: buffersToTransfer });
    });

  function interleaveData(geometry: GeometryData, strides: GeometryStride): ArrayBuffer {
    strides.forEach(([geometryKey, stride]) => {
      if (!geometry[geometryKey]) {
        console.error('Strides: ', strides, ' Data: ', geometry);
        throw new Error(`Geometry data is missing: ${geometryKey} property.`);
      }

      if (geometry[geometryKey].length % stride !== 0) {
        console.error('Strides: ', strides, ' Data: ', geometry);
        throw new Error(`${geometryKey} has a length that is not a multiple of its stride. Expected: ${stride} Modulo: ${geometry[geometryKey].length % stride}.`);
      }
    });

    const numItems = geometry[strides[0][0]]!.length / strides[0][1];

    const missingKeys: any[] = [];
    strides.forEach(([geometryKey, stride]) => {
      const geometryElement = geometry[geometryKey]!;
      if (geometryElement.length / stride !== numItems) {
        console.warn(`${geometryKey} is not the same size as vertices. Will try to default`);
        console.groupCollapsed('Warning debug');
        console.log(`geometryElement.length / stride: ${geometryElement.length / stride} !== numItems ${numItems}`);
        console.log('Geometry: ', geometry, 'Strides: ', strides);
        console.groupEnd();
        missingKeys.push(geometryKey);
      }
    });

    const totalStride = strides.reduce((sum, stride) => sum + stride[1], 0);

    const interleavedBuffer = new ArrayBuffer(numItems * totalStride * 4);
    // const interleavedBuffer = new ArrayBuffer(numItems * totalStride * 4);
    // const interleaved = new DataView(interleavedBuffer);
    const interleaved = new Float32Array(interleavedBuffer);
    for (let itemIndex = 0; itemIndex < numItems; itemIndex++) {
      let offset = 0;
      for (let arrayIndex = 0; arrayIndex < strides.length; arrayIndex++) {
        const [geometryKey, stride] = strides[arrayIndex];
        const start = itemIndex * stride;
        const end = start + stride;
        // try to guess any missing geometry properties (normals / uvs)
        if (missingKeys.includes(geometryKey)) {
          console.warn(`Missing geometry key: ${geometryKey}. Will default`);
          const key = missingKeys.find(key => key === geometryKey);
          if (key === 'normals') {
            interleaved.set([0, 0, 1], itemIndex * totalStride + offset);
          } else if (key === 'texCoords') {
            interleaved.set([0, 0], itemIndex * totalStride + offset);
          } else if (key === 'tangents') {
            interleaved.set([0, 0, 0], itemIndex * totalStride + offset);
          } else if (key === 'bitangents') {
            interleaved.set([0, 0, 0], itemIndex * totalStride + offset);
          }
        } else {
          let currentOffset = itemIndex * totalStride + offset;
          for (let i = start; i < end; i++) {
            interleaved[currentOffset++] = geometry[geometryKey]![i];
          }
        }

        offset += stride;
      }
    }

    return interleavedBuffer;
  }

  function calculateTangentsVec4(geometryData: GeometryData): GeometryData {
    const vertices  = geometryData.vertices,
          normals   = geometryData.normals,
          texCoords = geometryData.texCoords,
          indices   = geometryData.indices;
    const tangents = new Float32Array(vertices.length * 4 / 3);
    const bitangents = new Float32Array(vertices.length);
    const p0           = vec3.create(),
          p1           = vec3.create(),
          p2           = vec3.create(),
          uv0          = vec2.create(),
          uv1          = vec2.create(),
          uv2          = vec2.create(),
          deltaPos1    = vec3.create(),
          deltaPos2    = vec3.create(),
          deltaUV1     = vec2.create(),
          deltaUV2     = vec2.create(),
          tangent      = vec3.create(),
          tangentTmp   = vec3.create(),
          bitangent    = vec3.create(),
          bitangentTmp = vec3.create(),
          t            = vec3.create(),
          b            = vec3.create(),
          n            = vec3.create(),
          crossTB      = vec3.create();
    for (let i = 0; i < indices.length; i += 3) {
      // Positions
      p0[0] = vertices[indices[i] * 3];
      p0[1] = vertices[indices[i] * 3 + 1];
      p0[2] = vertices[indices[i] * 3 + 2];

      p1[0] = vertices[indices[i + 1] * 3];
      p1[1] = vertices[indices[i + 1] * 3 + 1];
      p1[2] = vertices[indices[i + 1] * 3 + 2];

      p2[0] = vertices[indices[i + 2] * 3];
      p2[1] = vertices[indices[i + 2] * 3 + 1];
      p2[2] = vertices[indices[i + 2] * 3 + 2];

      // UVs
      uv0[0] = texCoords[indices[i] * 2];
      uv0[1] = texCoords[indices[i] * 2 + 1];
      uv1[0] = texCoords[indices[i + 1] * 2];
      uv1[1] = texCoords[indices[i + 1] * 2 + 1];
      uv2[0] = texCoords[indices[i + 2] * 2];
      uv2[1] = texCoords[indices[i + 2] * 2 + 1];

      vec3.subtract(deltaPos1, p1, p0);
      vec3.subtract(deltaPos2, p2, p0);

      vec2.subtract(deltaUV1, uv1, uv0);
      vec2.subtract(deltaUV2, uv2, uv0);

      const r = 1.0 / (deltaUV1[0] * deltaUV2[1] - deltaUV1[1] * deltaUV2[0]);

      vec3.scale(
        tangent,
        vec3.subtract(
          tangentTmp,
          vec3.scale(vec3.create(), deltaPos1, deltaUV2[1]),
          vec3.scale(vec3.create(), deltaPos2, deltaUV1[1])
        ),
        r
      );

      vec3.scale(
        bitangent,
        vec3.subtract(
          bitangentTmp,
          vec3.scale(vec3.create(), deltaPos2, deltaUV1[0]),
          vec3.scale(vec3.create(), deltaPos1, deltaUV2[0])
        ),
        r
      );

      // Accumulate tangents and bitangents
      for (const idx of [indices[i], indices[i + 1], indices[i + 2]]) {
        tangents[idx * 4] += tangent[0];
        tangents[idx * 4 + 1] += tangent[1];
        tangents[idx * 4 + 2] += tangent[2];

        bitangents[idx * 3] += bitangent[0];
        bitangents[idx * 3 + 1] += bitangent[1];
        bitangents[idx * 3 + 2] += bitangent[2];
      }
    }

    for (let i = 0; i < vertices.length / 3; i++) {

      vec3.set(t, tangents[i * 4], tangents[i * 4 + 1], tangents[i * 4 + 2]);
      vec3.set(b, bitangents[i * 3], bitangents[i * 3 + 1], bitangents[i * 3 + 2]);
      vec3.set(n, normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);

      vec3.normalize(t, t);
      vec3.cross(crossTB, t, b);

      tangents[i * 4] = t[0];
      tangents[i * 4 + 1] = t[1];
      tangents[i * 4 + 2] = t[2];
      tangents[i * 4 + 3] = vec3.dot(crossTB, n) < 0.0 ? -1.0 : 1.0; // Append w
    }

    geometryData.tangents = tangents;
    return geometryData;
  }

  function parseJson(fileArrayBuffer: ArrayBuffer) {
    const dataView = new DataView(fileArrayBuffer);

    // read headers
    const magic = dataView.getUint32(0, true);
    if (magic !== 0x46546C67) { // "glTF"
      console.error(`Invalid GLB file: ${magic}`);
      // throw new Error('Invalid GLB file: ' + magic);
    }

    const version = dataView.getUint32(4, true);
    if (version !== 2) {
      throw new Error('Unsupported GLB version: ' + version);
    }

    const length = dataView.getUint32(8, true);

    // Read JSON chunk
    const jsonChunkLength = dataView.getUint32(12, true);
    const jsonChunkType = dataView.getUint32(16, true);
    if (jsonChunkType !== 0x4E4F534A) { // "JSON"
      throw new Error('Expected JSON chunk in GLB');
    }
    const jsonChunk = new Uint8Array(fileArrayBuffer, 20, jsonChunkLength);
    const json: GLTFJson = JSON.parse(new TextDecoder().decode(jsonChunk));

    // Read binary chunk
    let binaryChunkOffset = 20 + jsonChunkLength;
    const binaryChunkType = dataView.getUint32(binaryChunkOffset + 4, true);
    if (binaryChunkType !== 0x004E4942) { // "BIN"
      throw new Error('Expected BIN chunk in GLB ' + binaryChunkType);
    }

    binaryChunkOffset += 8;
    return { json, binaryChunkOffset };
  }

};