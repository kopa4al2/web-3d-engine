import TerrainGeometry from 'core/components/geometry/TerrainGeometry';
import { BindGroupEntryType } from 'core/resources/BindGroup';
import { UniformVisibility } from 'core/resources/gpu/GpuShaderData';
import { ShaderStruct, TextureStruct } from 'core/resources/shader/ShaderStruct';
import Bitmask from 'util/BitMask';

export function createStruct(name: string, type: BindGroupEntryType, binding: number, visibilities: UniformVisibility, byteLength?: number): ShaderStruct {
    return { name, type, binding, visibilityMask: visibility(visibilities), byteLength } as ShaderStruct
}

const visibility = (value: UniformVisibility) => new Bitmask<UniformVisibility>(value);

export const VERTEX_STORAGE_BUFFER_STRUCT: ShaderStruct = {
    type: 'storage',
    name: 'InstanceData',
    binding: 0,
    visibilityMask: visibility(UniformVisibility.VERTEX | UniformVisibility.FRAGMENT),
    // defaultValue: defaultTransform().createModelMatrix() as Float32Array<any>,
};

export const TEXTURE_ARRAY_STRUCT: ShaderStruct = {
    type: 'texture-array',
    name: 'TexturesArray',
    binding: 1,
    visibilityMask: visibility(UniformVisibility.VERTEX | UniformVisibility.FRAGMENT)
};
export const SAMPLER_STRUCT: ShaderStruct = {
    type: 'sampler',
    name: 'Sampler',
    binding: 2,
    visibilityMask: visibility(UniformVisibility.VERTEX | UniformVisibility.FRAGMENT)
};

export const UNLIT_MATERIAL_STRUCT: ShaderStruct = {
    type: 'uniform',
    name: 'Material',
    binding: 0,
    byteLength: 256,
    visibilityMask: visibility(UniformVisibility.FRAGMENT),
    dynamicOffset: {
        size: 256,
    },
    defaultValue: new Float32Array([1.0, 0.0, 1.0, 0.2, 1.0, 1.0, 1.0, 1.0]) // Default fill color and line color
};

export const PHONG_MATERIAL_STRUCT: ShaderStruct = {
    type: 'uniform',
    name: 'PhongMaterial',
    binding: 0,
    byteLength: 256,
    // dynamicOffset: {
    //     size: 256
    // },
    visibilityMask: visibility(UniformVisibility.FRAGMENT),
    // defaultValue: new Float32Array([
    //     0.2, 0.2, 0.2, 1.0, // ambient
    //     1.0, 1.0, 1.0, 1.0, // diffuse
    //     0.3, 0.3, 0.3, 1.0  // specular
    // ])
};

export const PBR_MATERIAL_STRUCT: ShaderStruct = {
    type: 'uniform',
    name: 'PBRMaterial',
    binding: 0,
    byteLength: 72,
    visibilityMask: visibility(UniformVisibility.FRAGMENT),
};

export const TERRAIN_MATERIAL_STRUCT: ShaderStruct = {
    type: 'uniform',
    name: 'Material',
    binding: 0,
    byteLength: 256,
    // dynamicOffset: {
    //     size: 256,
    // },
    visibilityMask: visibility(UniformVisibility.FRAGMENT),
    defaultValue: new Float32Array([
        0.2, 0.2, 0.2, 1.0, // ambient
        1.0, 1.0, 1.0, 1.0, // diffuse
        0.3, 0.3, 0.3, 1.0,  // specular,
        10.0, // shininess
        TerrainGeometry.HEIGHT, // max height
        TerrainGeometry.MIN_HEIGHT, // min height
        TerrainGeometry.SEA_LEVEL,
    ])
};


// Projection, View (position)
export const CAMERA_STRUCT: ShaderStruct = {
    binding: 0,
    byteLength: 80, // (mat4x4 + vec4) * 4
    name: 'Camera',
    type: 'uniform',
    visibilityMask: visibility(UniformVisibility.FRAGMENT | UniformVisibility.VERTEX),
}

// Will contain array of directional / pointed lights. Currently only support directional. One directional is 16bytes
export const LIGHT_STRUCT: ShaderStruct = {
    binding: 1,
    byteLength: 464,
    // byteLength: 16,
    name: 'Light',
    type: 'uniform',
    visibilityMask: visibility(UniformVisibility.FRAGMENT),
}

// TODO: Figure out what to pass as time
export const TIME_STRUCT: ShaderStruct = {
    binding: 2,
    byteLength: 16,
    name: 'Time',
    type: 'uniform',
    visibilityMask: visibility(UniformVisibility.FRAGMENT),
}

export const GLOBAL_TEXTURE_ARRAY_STRUCT: ShaderStruct = {
    type: 'texture-array',
    name: 'TexturesArray',
    binding: 3,
    visibilityMask: visibility(UniformVisibility.FRAGMENT)
};
export const GLOBAL_TEXTURE_ARRAY_SAMPLER_STRUCT: ShaderStruct = {
    type: 'sampler',
    name: 'Sampler',
    binding: 4,
    visibilityMask: visibility(UniformVisibility.FRAGMENT)
};

export const GLOBAL_ENV_CUBE_TEXTURE_STRUCT: ShaderStruct = {
    type: 'cube-texture',
    name: 'EnvCubeMap',
    binding: 5,
    visibilityMask: visibility(UniformVisibility.FRAGMENT)
};
export const GLOBAL_ENV_CUBE_SAMPLER_STRUCT: ShaderStruct = {
    type: 'sampler',
    name: 'EnvSampler',
    binding: 6,
    visibilityMask: visibility(UniformVisibility.FRAGMENT)
};

export const DEPTH_TEXTURE_ARRAY_STRUCT: ShaderStruct = {
    type: 'texture-array',
    name: 'ShadowMap',
    sampleType: 'depth',
    binding: 7,
    visibilityMask: visibility(UniformVisibility.FRAGMENT)
};
export const DEPTH_TEXTURE_ARRAY_SAMPLER_STRUCT: ShaderStruct = {
    type: 'sampler',
    name: 'ShadowMapSampler',
    samplerType: 'comparison',
    binding: 8,
    visibilityMask: visibility(UniformVisibility.FRAGMENT)
};
