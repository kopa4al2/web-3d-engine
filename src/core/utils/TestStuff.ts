/*
// @ts-nocheck
import LightSource from 'core/components/camera/LightSource';
import ProjectionMatrix from 'core/components/camera/ProjectionMatrix';
import LightedMaterial from 'core/components/material/LightedMaterial';
import MaterialComponent from 'core/components/material/MaterialComponent';
import { defaultTransform } from 'core/components/Transform';
import TextureLoader from 'core/loader/TextureLoader';
import PropertiesManager, { PartialProperties, Property, PropertyValue } from 'core/PropertiesManager';
import { FragmentShaderName, VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import { BufferUsage } from 'core/resources/gpu/BufferDescription';
import { UniformVisibility } from 'core/resources/gpu/GpuShaderData';
import GPUResourceManager, {
    ShaderId,
    PipelineInstance,
    BindGroupLayoutCpu,
    BindGroupLayoutEntry
} from 'core/resources/GPUResourceManager';
import { mat4, vec2, vec3 } from 'gl-matrix';
import WebGPUGraphics from 'webgpu/graphics/WebGPUGraphics';

import Canvas from '../../Canvas';

export const isEnabled = false;


export async function testStuff() {
    await Promise.all([
        await TextureLoader.loadTexture('noop', "assets/1x1texture.png"),
        await TextureLoader.loadTexture('texture2', "assets/texture.png", 'uSampler'),
        await TextureLoader.loadTexture('texture1', "assets/texture-2.jpg", 'uSampler'),
        await TextureLoader.loadTexture('texture', "assets/DALL·E-tex-1.webp", 'uSampler'),
    ]);
    let props = webGpuProps();
    const canvas = new Canvas(document.getElementById('webgpu-canvas') as HTMLElement,
        props,
        'webgpu');
    canvas.addToDOM();

    // const graphics = new WebGLGraphics(canvas, props);
    const graphics = await WebGPUGraphics.initWebGPU(canvas, props);

    const gpuResource = new GPUResourceManager(graphics);
    const light = new LightSource(props);

    const texture = gpuResource.createTexture('BASIC', TextureLoader.textures['texture']);
    const sampler = gpuResource.createSampler();


    const lightShaderLayout: PipelineInstance = createLightShaderLayout(gpuResource);
    const cubeLighted = createCubeLighted(gpuResource, lightShaderLayout, new LightedMaterial(), texture, sampler)
    // const dragon = createDragon(gpuResource, lightShaderLayout, )
    const basicShaderLayout = createBasicShaderLayout(gpuResource);
    const cubeBasic = createCubeBasic(gpuResource, basicShaderLayout);

    const projectionMatrix = new ProjectionMatrix(props);

    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, [-1, 3, -2], [0, 0, 0], [0, 1, 0])

    const mvpMatrix = mat4.create();
    mat4.multiply(mvpMatrix, projectionMatrix.get(), viewMatrix);

    let lastFrame = 0;
    const modelMatrices = [1, 2, 3, 4, 5].map(num => defaultTransform()
        .translate(vec3.fromValues(num * 0.1, 1 + -0.2 - num * 0.8, num * -0.2))
        .rotate(vec3.fromValues(1.5, 0.2, 0))
        .scaleBy(0.2)
    );

    const instanceCounter = 3;
    render(0);
    function render(now: number) {
        const deltaTime = (now - lastFrame) / 1000;
        const pass = graphics.beginRenderPass();
        // pass.usePipeline(basicShaderLayout.pipeline);
        // pass.setVertexBuffer(0, cubeBasic.vertexBuffer);
        pass.usePipeline(lightShaderLayout.pipeline);
        pass.setVertexBuffer(0, cubeLighted.vertexBuffer);
        cubeLighted.uniformGroups.forEach(bindGroup => {
        // cubeBasic.uniformGroups.forEach(bindGroup => {
            pass.setBindGroup(bindGroup.group, bindGroup.id);
            if (bindGroup.buffers['InstanceData']) {
                for (let i = 0; i < instanceCounter; i++) {
                    const currentModelMatrix = (modelMatrices[i].rotate(vec3.fromValues(deltaTime * i, deltaTime * 2, deltaTime)).createModelMatrix()) as Float32Array;
                    graphics.writeToBuffer(bindGroup.buffers['InstanceData'],
                        currentModelMatrix,
                        i * (64));
                        // graphics.writeToBuffer(bindGroup.buffers['InstanceData'],
                        //     vec4.fromValues(1.0, i % 2 === 0 ? 1.0 : 0.0, 0.0, 1.0) as Float32Array,
                        //     i * (64 + 16) + 64);
                }
            }
            if (bindGroup.buffers['World']) {
                // graphics.writeToBuffer(bindGroup.buffers['World'],
                //     mvpMatrix as Float32Array);

                const modelInverseTranspose = mat4.create();
                mat4.invert(modelInverseTranspose, defaultTransform().createModelMatrix());
                mat4.transpose(modelInverseTranspose, modelInverseTranspose);
                graphics.writeToBuffer(bindGroup.buffers['World'], mvpMatrix as Float32Array);
                graphics.writeToBuffer(bindGroup.buffers['World'], defaultTransform().createModelMatrix() as Float32Array, 64, 0);
                graphics.writeToBuffer(bindGroup.buffers['World'], modelInverseTranspose as Float32Array, 128, 0);
            }

            if (bindGroup.buffers['Light']) {
                graphics.writeToBuffer(bindGroup.buffers['Light'], light.getLightData(), 0, 0, 4);
                graphics.writeToBuffer(bindGroup.buffers['Light'], light.getLightData(), 16, 4, 4);
                graphics.writeToBuffer(bindGroup.buffers['Light'], new Float32Array([-1, 3, -2]), 32, 0);
            }
        });
        pass.drawInstanced(cubeLighted.indexBuffer.id, cubeLighted.indexBuffer.indices, instanceCounter);
        // pass.drawInstanced(cubeBasic.indexBuffer.id, cubeBasic.indexBuffer.indices, 3);

        pass.submit();
        lastFrame = now;

        requestAnimationFrame(render)
    }
}

function createBasicShaderLayout(gpuResource: GPUResourceManager) {
    return gpuResource.newPipelineFromLayout(ShaderId.BASIC, {
            layout: [
                {
                    dataType: 'float32',
                    elementsPerVertex: 3

                }],
            shaderName: VertexShaderName.UNUSED_OLD_BASIC_INSTANCED,
            stride: 12,
        },
        {
            shaderName: FragmentShaderName.BASIC_INSTANCED,
        }, createBasicShaderUniforms());
}

function interleaveMaterial(material: MaterialComponent): number[] {
    return [...material.properties.ambient, 1, ...material.properties.diffuse, 1, ...material.properties.specular, 1]
}

function createCubeLighted(gpuResource: GPUResourceManager, shader: PipelineInstance, material: MaterialComponent, texture: symbol, sampler: symbol) {
    const { pipeline, layoutGroups } = shader;
    return gpuResource.createBindGroupForPipeline(pipeline, cubeLightedVertices, cubeIndices, [
        {
            shaderLayout: layoutGroups[0],
            group: 0,
            uniforms: [{
                type: 'uniform',
                binding: 0,
                name: 'World',
                usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
                byteLength: 192,
                data: mat4.create() as Float32Array
            }, {
                type: 'uniform',
                binding: 1,
                name: 'Light',
                usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
                byteLength: 64,
                data: mat4.create() as Float32Array
            }]
        },
        {
            shaderLayout: layoutGroups[1],
            group: 1,
            uniforms: [{
                type: 'uniform',
                binding: 0,
                name: 'Material',
                usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
                byteLength: 64,
                data: new Float32Array(interleaveMaterial(material))
            }, {
                type: 'texture',
                binding: 1,
                name: 'uSampler',
                usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
                byteLength: 0,
                data: texture
            }, {
                type: 'sampler',
                binding: 2,
                name: 'uSampler',
                usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
                byteLength: 0,
                data: sampler
            }]
        },
        {
            shaderLayout: layoutGroups[2],
            group: 2,
            uniforms: [{
                type: 'storage',
                binding: 0,
                name: 'InstanceData',
                usage: BufferUsage.STORAGE | BufferUsage.COPY_DST,
                byteLength: 1024,
            }]
        }
    ]);
}

function createCubeBasic(gpuResource: GPUResourceManager, shaderDescription: PipelineInstance) {
    const { pipeline, layoutGroups } = shaderDescription;
    return gpuResource.createBindGroupForPipeline(pipeline, cubeVertices, cubeIndices, [
        {
            shaderLayout: layoutGroups[0],
            group: 0,
            uniforms: [{
                type: 'uniform',
                binding: 0,
                name: 'World',
                usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
                byteLength: 64,
                data: mat4.create() as Float32Array
            }]
        },
        {
            shaderLayout: layoutGroups[1],
            group: 1,
            uniforms: [{
                type: 'uniform',
                binding: 0,
                name: 'Material',
                usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
                byteLength: 16,
                data: new Float32Array([1.0, 0.0, 0.5, 1.0])
            }]
        },
        {
            shaderLayout: layoutGroups[2],
            group: 2,
            uniforms: [{
                type: 'storage',
                binding: 0,
                name: 'InstanceData',
                usage: BufferUsage.STORAGE | BufferUsage.COPY_DST,
                byteLength: 1024,
            }]
        }
    ]);
}

function createLightShaderLayout(gpuResource: GPUResourceManager) {
    return gpuResource.newPipelineFromLayout(ShaderId.LIGHTED, {
            layout: [
                { dataType: 'float32', elementsPerVertex: 3 },
                { dataType: 'float32', elementsPerVertex: 2 },
                { dataType: 'float32', elementsPerVertex: 3 },
            ],
            shaderName: VertexShaderName.LIT_GEOMETRY,
            stride: Float32Array.BYTES_PER_ELEMENT * (3 + 3 + 2),
        },
        {
            shaderName: FragmentShaderName.PHONG_LIT,
        }, createLightShaderUniforms());
}


function createLightShaderUniforms(): BindGroupLayoutCpu[] {
    return [
        {
            group: 0,
            visibility: UniformVisibility.VERTEX | UniformVisibility.FRAGMENT,
            entries: [
                { type: 'float32Array', name: 'World', binding: 0 },
                { type: 'float32Array', name: 'Light', binding: 1 }
            ]
        },
        {
            group: 1,
            visibility: UniformVisibility.FRAGMENT,
            entries: [
                { type: 'float32Array', name: 'Material', binding: 0 },
                { type: 'texture', name: 'uSampler', binding: 1 },
                { type: 'sampler', name: 'uSampler', binding: 2 },
            ]
        },
        {
            group: 2,
            visibility: UniformVisibility.VERTEX,
            entries: [
                { type: 'storage', name: 'instanceData', binding: 0 }
            ]
        }
    ]
}

function createBasicShaderUniforms(): BindGroupLayoutCpu[] {
    return [
        {
            group: 0,
            visibility: UniformVisibility.VERTEX,
            entries: createWorldGroup()
        },
        {
            group: 1,
            visibility: UniformVisibility.FRAGMENT,
            entries: createColorEntries()
        },
        {
            group: 3,
            visibility: UniformVisibility.VERTEX | UniformVisibility.FRAGMENT,
            entries: createInstancedBuffer()
        }
    ]

}

function createColorEntries(): BindGroupLayoutEntry[] {
    return [{ type: 'float32Array', name: 'Material', binding: 0 },];
}

function createWorldGroup(): BindGroupLayoutEntry[] {
    return [
        { type: 'float32Array', name: 'MVP', binding: 0 },
    ]
}

function createInstancedBuffer(): BindGroupLayoutEntry[] {
    return [
        { type: 'storage', name: 'instanceData', binding: 0 }
    ]
}

const webGpuProps = () => createProperties({
    fieldOfView: Math.PI / 4,
    zNear: 0.01,
    zFar: 1000,
}, {
    input: {
        inputFlags: {},
        mousePos: vec2.create(),
        mouseDelta: vec2.create(),
        deltaWheel: vec3.create(),
        wheel: vec3.create(),
    },
    wireframe: false,
    fieldOfView: Math.PI / 4,
    zNear: 0.01,
    zFar: 100,
    splitScreen: false,
    gpuApi: 'webgpu',
    window: {
        width: window.innerWidth,
        height: window.innerHeight,
        leftOffset: 0,
        topOffset: 0,
        hide: false,
    },
    light: {
        sourceX: 0,
        sourceY: 0,
        sourceZ: 0
    }
}, 'webgpu');

function createProperties(sharedProperties: PartialProperties, currentProperties: Record<Property, PropertyValue>, name: string = 'engine') {
    return new PropertiesManager(currentProperties, sharedProperties, name)
}

const cubeVertices = new Float32Array([
    0.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    1.0, 1.0, 0.0,
    0.0, 0.0, 0.0,
    1.0, 1.0, 0.0,
    1.0, 0.0, 0.0,
// EAST
    1.0, 0.0, 0.0,
    1.0, 1.0, 0.0,
    1.0, 1.0, 1.0,
    1.0, 0.0, 0.0,
    1.0, 1.0, 1.0,
    1.0, 0.0, 1.0,
// NORTH
    1.0, 0.0, 1.0,
    1.0, 1.0, 1.0,
    0.0, 1.0, 1.0,
    1.0, 0.0, 1.0,
    0.0, 1.0, 1.0,
    0.0, 0.0, 1.0,
// WEST
    0.0, 0.0, 1.0,
    0.0, 1.0, 1.0,
    0.0, 1.0, 0.0,
    0.0, 0.0, 1.0,
    0.0, 1.0, 0.0,
    0.0, 0.0, 0.0,
// TOP
    0.0, 1.0, 0.0,
    0.0, 1.0, 1.0,
    1.0, 1.0, 1.0,
    0.0, 1.0, 0.0,
    1.0, 1.0, 1.0,
    1.0, 1.0, 0.0,
// BOTTOM
    1.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 0.0,
    1.0, 0.0, 1.0,
    0.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
]);


const cubeIndices = new Uint32Array([
    0, 1, 2, 3, 4, 5,   // Front face
    6, 7, 8, 9, 10, 11,  // East face
    12, 13, 14, 15, 16, 17, // North face
    18, 19, 20, 21, 22, 23, // West face
    24, 25, 26, 27, 28, 29, // Top face
    30, 31, 32, 33, 34, 35  // Bottom face
]);


const cubeLightedVertices = new Float32Array([
    // FRONT FACE  NORMAL    UV
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -1.0,
    0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, -1.0,
    1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0, -1.0,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -1.0,
    1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, -1.0,
    1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, -1.0,

    // EAST
    1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0,
    1.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 0.0,
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0,
    1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0,
    1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0,
    1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0,

    // NORTH
    1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
    1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 1.0,
    0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 1.0,
    1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
    0.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 1.0,
    0.0, 0.0, 1.0, 1.0, 1.0, 0.0, 0.0, 1.0,

    // WEST
    0.0, 0.0, 1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
    0.0, 1.0, 1.0, 1.0, 0.0, -1.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 1.0, 1.0, -1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 1.0, 0.0, -1.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 1.0, 1.0, -1.0, 0.0, 0.0,

    // TOP
    0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0,
    0.0, 1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0,
    1.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 0.0,
    0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0,
    1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0,
    1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0,

    // BOTTOM
    1.0, 0.0, 1.0, 0.0, 0.0, 0.0, -1.0, 0.0,
    0.0, 0.0, 1.0, 1.0, 0.0, 0.0, -1.0, 0.0,
    0.0, 0.0, 0.0, 1.0, 1.0, 0.0, -1.0, 0.0,
    1.0, 0.0, 1.0, 0.0, 0.0, 0.0, -1.0, 0.0,
    0.0, 0.0, 0.0, 1.0, 0.0, 0.0, -1.0, 0.0,
    1.0, 0.0, 0.0, 1.0, 1.0, 0.0, -1.0, 0.0,
]);
*/
