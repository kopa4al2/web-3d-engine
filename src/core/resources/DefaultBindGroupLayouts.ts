import { defaultTransform } from 'core/components/Transform';
import { VertexLayout, VertexLayoutEntry, VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import { BufferUsage } from 'core/resources/gpu/BufferDescription';
import { UniformVisibility } from 'core/resources/gpu/GpuShaderData';
import {
    BindGroupLayoutCpu,
    BindGroupLayoutEntry,
    UniformsData,
    VertexShaderDescription
} from 'core/resources/GPUResourceManager';
import { ShapeFlags, RenderFlags } from 'core/resources/MeshManager';
import Bitmask from 'util/BitMask';

const visibility = (value: UniformVisibility) => new Bitmask<UniformVisibility>(value);
const usage = (value: BufferUsage) => new Bitmask<BufferUsage>(value);

export const STORAGE_BUFFER_STRUCT: BindGroupLayoutEntry = {
    type: 'storage',
    name: 'InstanceData',
    binding: 1,
    // binding: 0,
    visibilityMask: visibility(UniformVisibility.VERTEX | UniformVisibility.FRAGMENT),
    defaultValue: defaultTransform().createModelMatrix() as Float32Array,
    instanceBufferStride: 64 // TODO: Not working currently
};
export const GLOBAL_STRUCT: BindGroupLayoutEntry = {
    type: 'uniform',
    name: 'Global',
    byteLength: 256,
    binding: 0,
    visibilityMask: visibility(UniformVisibility.VERTEX | UniformVisibility.FRAGMENT)
};

export const FLAGS_STRUCT: BindGroupLayoutEntry = {
    type: 'uniform',
    name: 'Flags',
    byteLength: 8,
    binding: 1,
    visibilityMask: visibility(UniformVisibility.VERTEX | UniformVisibility.FRAGMENT),
    defaultValue: new Uint32Array([RenderFlags.SKIP_FILL | RenderFlags.OUTLINE, ShapeFlags.SPHERE])
};

export const UNLIT_MATERIAL_STRUCT: BindGroupLayoutEntry = {
    type: 'uniform',
    name: 'Material',
    binding: 0,
    byteLength: 64,
    visibilityMask: visibility(UniformVisibility.FRAGMENT),
    defaultValue: new Float32Array([1.0, 0.0, 1.0, 0.2, 1.0, 1.0, 1.0, 1.0]) // Default fill color and line color
};


export const LIT_MATERIAL_STRUCT: BindGroupLayoutEntry = {
    type: 'uniform',
    name: 'Material',
    binding: 0,
    byteLength: 64,
    visibilityMask: visibility(UniformVisibility.FRAGMENT),
    defaultValue: new Float32Array([
        0.2, 0.2, 0.2, 1.0, // ambient
        1.0, 1.0, 1.0, 1.0, // diffuse
        0.3, 0.3, 0.3, 1.0  // specular
    ])
};


export const GLOBAL_BUFFER_LAYOUT: BindGroupLayoutCpu = {
    label: 'GlobalLayout',
    entries: [
        GLOBAL_STRUCT,
        STORAGE_BUFFER_STRUCT,
    ]
}
export const INSTANCE_BUFFER_LAYOUT: BindGroupLayoutCpu = {
    label: 'InstanceOnlyLayout',
    entries: [STORAGE_BUFFER_STRUCT]
};

export const TEXTURED_MATERIAL_LAYOUT: BindGroupLayoutCpu = {
    label: 'TexturedLayout',
    entries: [
        UNLIT_MATERIAL_STRUCT,
        // {
        //     type: 'uniform',
        //     name: 'Material',
        //     byteLength: 64,
        //     binding: 0,
        //     visibilityMask: visibility(UniformVisibility.FRAGMENT)
        // },
        { type: 'texture', name: 'uSampler', binding: 1, visibilityMask: visibility(UniformVisibility.FRAGMENT) },
        { type: 'sampler', name: 'uSampler', binding: 2, visibilityMask: visibility(UniformVisibility.FRAGMENT) },
    ]
};

export const MATERIAL_BUFFER_LAYOUT: BindGroupLayoutCpu = {
    label: 'UnlitMaterialLayout',
    entries: [UNLIT_MATERIAL_STRUCT]
}

export const LIGHTED_VERTEX_SHADER_DESCRIPTION: VertexShaderDescription = {
    layout: [
        { dataType: 'float32', elementsPerVertex: 3 },
        { dataType: 'float32', elementsPerVertex: 2 },
        { dataType: 'float32', elementsPerVertex: 3 },
    ],
    shaderName: VertexShaderName.BASIC_WITH_LIGHT,
    stride: Float32Array.BYTES_PER_ELEMENT * (3 + 3 + 2),
};

export const LIGHTED_SHADER_UNIFORMS_LAYOUT: BindGroupLayoutCpu[] = [
    GLOBAL_BUFFER_LAYOUT,
    TEXTURED_MATERIAL_LAYOUT,
    INSTANCE_BUFFER_LAYOUT
]

export const BASIC_SHADER_VERTEX_DESCRIPTION: VertexShaderDescription = {
    layout: [
        { dataType: 'float32', elementsPerVertex: 3 },
        { dataType: 'float32', elementsPerVertex: 2 },
        { dataType: 'float32', elementsPerVertex: 3 },
    ],
    shaderName: VertexShaderName.BASIC_INSTANCED,
    stride: Float32Array.BYTES_PER_ELEMENT * (3 + 3 + 2),
};

export const BASIC_SHADER_UNIFORM_DESCRIPTION: BindGroupLayoutCpu[] = [
    GLOBAL_BUFFER_LAYOUT,
    MATERIAL_BUFFER_LAYOUT,
    // {
    //     group: 1,
    //     visibility: UniformVisibility.FRAGMENT,
    //     entries: [{ type: 'uniform', name: 'Material', binding: 0, byteLength: 64 }]
    // },
    INSTANCE_BUFFER_LAYOUT
]


export const SPHERE_VERTEX_SHADER_DESCRIPTION: VertexShaderDescription = {
    layout: [
        { dataType: 'float32', elementsPerVertex: 3 },
        { dataType: 'float32', elementsPerVertex: 2 },
        { dataType: 'float32', elementsPerVertex: 3 },
        // { dataType: 'float32', elementsPerVertex: 1 },
        // { dataType: 'float32', elementsPerVertex: 1 },
    ],
    shaderName: VertexShaderName.SPHERE,
    stride: Float32Array.BYTES_PER_ELEMENT * (3 + 2 + 3),
};

export const SPHERE_SHADER_UNIFORM_DESCRIPTION: BindGroupLayoutCpu[] = [
    GLOBAL_BUFFER_LAYOUT,
    MATERIAL_BUFFER_LAYOUT,
    INSTANCE_BUFFER_LAYOUT
]


export function createVertexLayout(shaderName: VertexShaderName, strides: number[]): VertexShaderDescription {
    return {
        shaderName,
        stride: Float32Array.BYTES_PER_ELEMENT * strides.reduce((sum, stride) => sum + stride, 0),
        layout: strides.map(stride => ({
            dataType: 'float32', elementsPerVertex: stride
        })),
    };
}

export function createVertexLayoutWithDataV2(arrays: number[][], strides: number[]): {
    layout: VertexLayout,
    data: Float32Array
} {
    // console.groupCollapsed('Begin layout create')
    // console.log('Arrays: ', arrays);
    // console.log('Strides: ', strides);

    // Validate input lengths
    if (arrays.length !== strides.length) {
        throw new Error("Each array must have a corresponding stride.");
    }

    // Check that each array length is a multiple of its stride
    arrays.forEach((arr, i) => {
        if (arr.length % strides[i] !== 0) {
            throw new Error(`Array at index ${i} has a length that is not a multiple of its stride.`);
        }
    });

    // Determine the number of "items" (groups of elements) based on the first array
    const numItems = arrays[0].length / strides[0];

    // Validate that all arrays have the same number of items
    arrays.forEach((arr, i) => {
        if (arr.length / strides[i] !== numItems) {
            throw new Error("All arrays must represent the same number of items based on their strides.");
        }
    });

    // Calculate the total stride (combined length of each item's data)
    const totalStride = strides.reduce((sum, stride) => sum + stride, 0);

    // Initialize the interleaved array
    const interleaved = new Float32Array(numItems * totalStride);

    // Interleave data
    for (let itemIndex = 0; itemIndex < numItems; itemIndex++) {
        let offset = 0;
        for (let arrayIndex = 0; arrayIndex < arrays.length; arrayIndex++) {
            const stride = strides[arrayIndex];
            const start = itemIndex * stride;
            const end = start + stride;
            interleaved.set(arrays[arrayIndex].slice(start, end), itemIndex * totalStride + offset);
            offset += stride;
        }
    }

    // console.groupEnd()

    const entries: VertexLayoutEntry[] = strides.map(stride => ({
        dataType: 'float32', elementsPerVertex: stride
    }));
    return {
        layout: {
            entries,
            stride: Float32Array.BYTES_PER_ELEMENT * totalStride
        },
        data: interleaved,
    };
}

export function createVertexLayoutWithData(shaderName: VertexShaderName, arrays: number[][], strides: number[]): VertexShaderDescription {
    console.groupCollapsed('Begin layout create')
    console.log('Arrays: ', arrays);
    console.log('Strides: ', strides);

    // Validate input lengths
    if (arrays.length !== strides.length) {
        throw new Error("Each array must have a corresponding stride.");
    }

    // Check that each array length is a multiple of its stride
    arrays.forEach((arr, i) => {
        if (arr.length % strides[i] !== 0) {
            throw new Error(`Array at index ${i} has a length that is not a multiple of its stride.`);
        }
    });

    // Determine the number of "items" (groups of elements) based on the first array
    const numItems = arrays[0].length / strides[0];

    // Validate that all arrays have the same number of items
    arrays.forEach((arr, i) => {
        if (arr.length / strides[i] !== numItems) {
            throw new Error("All arrays must represent the same number of items based on their strides.");
        }
    });

    // Calculate the total stride (combined length of each item's data)
    const totalStride = strides.reduce((sum, stride) => sum + stride, 0);

    // Initialize the interleaved array
    const interleaved = new Float32Array(numItems * totalStride);

    // Interleave data
    for (let itemIndex = 0; itemIndex < numItems; itemIndex++) {
        let offset = 0;
        for (let arrayIndex = 0; arrayIndex < arrays.length; arrayIndex++) {
            const stride = strides[arrayIndex];
            const start = itemIndex * stride;
            const end = start + stride;
            interleaved.set(arrays[arrayIndex].slice(start, end), itemIndex * totalStride + offset);
            offset += stride;
        }
    }

    console.groupEnd()

    const layout: VertexLayoutEntry[] = strides.map(stride => ({
        dataType: 'float32', elementsPerVertex: stride
    }));
    return {
        layout,
        shaderName,
        stride: Float32Array.BYTES_PER_ELEMENT * totalStride,
    };
}

// @ts-ignore
window.vertexLayout = createVertexLayoutWithData
