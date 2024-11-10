import Geometry, { GeometryData, GeometryDescriptor } from 'core/mesh/Geometry';
import { VertexLayout, VertexLayoutEntry, VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import { createVertexLayoutWithDataV2 } from 'core/resources/DefaultBindGroupLayouts';
import { BufferUsage } from 'core/resources/gpu/BufferDescription';
import GPUResourceManager from 'core/resources/GPUResourceManager';
import JavaMap from 'util/JavaMap';

export type GeometryStride = [keyof GeometryData, number][];


const SHADER_GEOMETRIES = new JavaMap<VertexShaderName, GeometryStride>();
SHADER_GEOMETRIES.set(VertexShaderName.SPHERE, [['vertices', 3], ['texCoords', 2], ['normals', 3]])
SHADER_GEOMETRIES.set(VertexShaderName.BASIC_WITH_LIGHT, [['vertices', 3], ['texCoords', 2], ['normals', 3]])

export default class GeometryFactory {

    constructor(private gpuResourceManager: GPUResourceManager) {
    }

    public createDescriptor(label: string, vertexShader: VertexShaderName, geometry: GeometryData): Geometry {
        const strides = SHADER_GEOMETRIES.computeIfAbsent(vertexShader, () => {
            throw new Error(`Stride for shader: ${vertexShader} is not present.`);
        });
        const { vertexLayout, data } = this.createVertexLayout(geometry, strides);
        const indices = new Uint32Array(geometry.indices);

        const indexBuffer = this.gpuResourceManager.createBuffer(`${label}-indexBuffer`, {
            label: `${label}-index`,
            byteLength: indices.byteLength,
            usage: BufferUsage.INDEX | BufferUsage.COPY_DST
        }, indices);

        const vertexBuffer = this.gpuResourceManager.createBuffer(`${label}-vertexBuffer`, {
            label: `${label}-vertex`,
            byteLength: data.byteLength,
            usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
            vertexLayout: vertexLayout,
        }, data);

        return new Geometry(vertexBuffer, indexBuffer, geometry.indices.length, { vertexShader, vertexLayout });
    }

    private createVertexLayout(geometry: GeometryData, strides: GeometryStride): {
        vertexLayout: VertexLayout;
        data: Float32Array
    } {
        // console.groupCollapsed('Begin layout create')
        // console.log('Arrays: ', arrays);
        // console.log('Strides: ', strides);

        // Validate input lengths
        strides.forEach(([geometryKey, stride]) => {
            // const geometryKey = stride[0];
            // const stride = stride[1];
            if (!geometry[geometryKey]) {
                console.error('Strides: ', strides, ' Data: ', geometry)
                throw new Error(`Geometry data is missing: ${geometryKey} property.`);
            }

            if (geometry[geometryKey].length % stride !== 0) {
                console.error('Strides: ', strides, ' Data: ', geometry)
                throw new Error(`${geometry[geometryKey]} has a length that is not a multiple of its stride: ${stride}.`);
            }
        });

        // Determine the number of "items" (groups of elements) based on the first array
        const numItems = geometry[strides[0][0]].length / strides[0][1];

        strides.forEach(([geometryKey, stride]) => {
            if (geometry[geometryKey].length / stride !== numItems) {
                console.error(`${geometryKey} is not the same size as vertices`, strides, geometry);
                throw new Error("All arrays must represent the same number of items based on their strides");
            }
        })

        // Calculate the total stride (combined length of each item's data)
        const totalStride = strides.reduce((sum, stride) => sum + stride[1], 0);

        // Initialize the interleaved array
        const interleaved = new Float32Array(numItems * totalStride);

        // Interleave data
        for (let itemIndex = 0; itemIndex < numItems; itemIndex++) {
            let offset = 0;
            for (let arrayIndex = 0; arrayIndex < strides.length; arrayIndex++) {
                const [geometryKey, stride] = strides[arrayIndex];
                const start = itemIndex * stride;
                const end = start + stride;
                interleaved.set(geometry[geometryKey].slice(start, end), itemIndex * totalStride + offset);
                offset += stride;
            }
        }

        // console.groupEnd()

        const entries: VertexLayoutEntry[] = strides.map(([_, stride]) => ({
            dataType: 'float32', elementsPerVertex: stride
        }));
        return {
            vertexLayout: {
                entries,
                stride: Float32Array.BYTES_PER_ELEMENT * totalStride
            },
            data: interleaved,
        };
    }
}
