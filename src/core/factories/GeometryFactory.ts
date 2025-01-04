import Geometry, { GeometryData, GeometryDescriptor } from 'core/mesh/Geometry';
import { VertexLayout, VertexLayoutEntry, VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import { BufferData, BufferUsage } from 'core/resources/gpu/BufferDescription';
import ResourceManager from 'core/resources/ResourceManager';
import JavaMap from 'util/JavaMap';

export type GeometryStride = [keyof GeometryData, number][];


const SHADER_GEOMETRIES = new JavaMap<VertexShaderName, GeometryStride>();
SHADER_GEOMETRIES.set(VertexShaderName.SKY_BOX, [['vertices', 3]])
SHADER_GEOMETRIES.set(VertexShaderName.UNLIT_GEOMETRY, [['vertices', 3], ['texCoords', 2], ['normals', 3]])
// SHADER_GEOMETRIES.set(VertexShaderName.LIT_GEOMETRY, [['vertices', 3], ['texCoords', 2], ['normals', 3], ['tangents', 4]])
SHADER_GEOMETRIES.set(VertexShaderName.LIT_GEOMETRY, [['vertices', 3], ['texCoords', 2], ['normals', 3], ['tangents', 3], ['bitangents', 3]])
SHADER_GEOMETRIES.set(VertexShaderName.TERRAIN, [['vertices', 3], ['texCoords', 2], ['normals', 3]])
SHADER_GEOMETRIES.set(VertexShaderName.LIT_TANGENTS_VEC4, [['vertices', 3], ['texCoords', 2], ['normals', 3], ['tangents', 4]])

export default class GeometryFactory {

    constructor(private resourceManager: ResourceManager) {
    }

    public getDescriptor(vertexShader: VertexShaderName): GeometryDescriptor {
        const strides = SHADER_GEOMETRIES.computeIfAbsent(vertexShader, () => {
            throw new Error(`Stride for shader: ${ vertexShader } is not present.`);
        });

        const totalStride = strides.reduce((sum, stride) => sum + stride[1], 0);
        return {
            vertexShader,
            vertexLayout: {
                stride: Float32Array.BYTES_PER_ELEMENT * totalStride,
                entries: strides.map(([_, stride]) => ({
                    dataType: 'float32', elementsPerVertex: stride
                }))
            }
        }
    }

    public createFrustumDescriptor(vertexShader: VertexShaderName): Geometry {
        const vertexBuffer = this.resourceManager.createBuffer({
            label: `basic-vertex`,
            byteLength: 8 * 3 * Float32Array.BYTES_PER_ELEMENT,
            usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
            vertexLayout: {
                stride: 3 * Float32Array.BYTES_PER_ELEMENT,
                entries: [{ elementsPerVertex: 3, dataType: 'float32' }]
            },
        });

        const indices = new Uint32Array([
            // Near plane
            0, 1, 1, 2, 2, 3, 3, 0,

            // Far plane
            4, 5, 5, 6, 6, 7, 7, 4,

            // Connecting edges
            0, 4, 1, 5, 2, 6, 3, 7
        ]);
        const indexBuffer = this.resourceManager.createBuffer({
            label: 'basic-index',
            byteLength: indices.byteLength,
            usage: BufferUsage.INDEX | BufferUsage.COPY_DST
        }, indices)

        return new Geometry(vertexBuffer, indexBuffer, indices.length, {
            vertexShader,
            vertexLayout: {
                stride: 3 * Float32Array.BYTES_PER_ELEMENT,
                entries: [{ elementsPerVertex: 3, dataType: 'float32' }]
            }
        });
    }

    public createGeometryFromInterleaved(label: string,
                                         vertexShader: VertexShaderName,
                                         vertexData: BufferData,
                                         indices: BufferData): Geometry {
        const vertexLayout = this.createVertexLayoutFromShader(vertexShader)

        const indexBuffer = this.resourceManager.createBuffer({
            label: `${ label }-index`,
            byteLength: indices.byteLength,
            usage: BufferUsage.INDEX | BufferUsage.COPY_DST
        }, indices);

        const vertexBuffer = this.resourceManager.createBuffer({
            label: `${ label }-vertex`,
            byteLength: vertexData.byteLength,
            usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
            vertexLayout: vertexLayout,
        }, vertexData);

        return new Geometry(
            vertexBuffer,
            indexBuffer,
            indices.length,
            { vertexShader, vertexLayout });
    }

    public createGeometry(label: string, vertexShader: VertexShaderName, geometry: GeometryData): Geometry {
        const strides = SHADER_GEOMETRIES.computeIfAbsent(vertexShader, () => {
            throw new Error(`Stride for shader: ${ vertexShader } is not present.`);
        }) as GeometryStride;

        const { vertexLayout, data } = this.createVertexLayout(geometry, strides);
        const indices = new Uint32Array(geometry.indices);

        const indexBuffer = this.resourceManager.createBuffer({
            label: `${ label }-index`,
            byteLength: indices.byteLength,
            usage: BufferUsage.INDEX | BufferUsage.COPY_DST
        }, indices);

        const vertexBuffer = this.resourceManager.createBuffer({
            label: `${ label }-vertex`,
            byteLength: data.byteLength,
            usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
            vertexLayout: vertexLayout,
        }, data);

        return new Geometry(vertexBuffer, indexBuffer, geometry.indices.length, { vertexShader, vertexLayout, data: geometry });
    }

    private createVertexLayoutFromShader(vertexShader: VertexShaderName): VertexLayout {
        const strides = SHADER_GEOMETRIES.get(vertexShader);
        const totalStride = strides.reduce((sum, stride) => sum + stride[1], 0);
        const entries: VertexLayoutEntry[] = strides
            .map(([_, stride]) => ({
                dataType: 'float32', elementsPerVertex: stride
            }));
        return { entries, stride: Float32Array.BYTES_PER_ELEMENT * totalStride };
    }

    private createVertexLayout(geometry: GeometryData, strides: GeometryStride): {
        vertexLayout: VertexLayout;
        data: Float32Array<any>
    } {
        strides.forEach(([geometryKey, stride]) => {
            if (!geometry[geometryKey]) {
                console.error('Strides: ', strides, ' Data: ', geometry)
                throw new Error(`Geometry data is missing: ${ geometryKey } property.`);
            }

            if (geometry[geometryKey].length % stride !== 0) {
                console.error('Strides: ', strides, ' Data: ', geometry)
                throw new Error(`${ geometryKey } has a length that is not a multiple of its stride. Expected: ${ stride } Modulo: ${ geometry[geometryKey].length % stride }.`);
            }
        });

        const numItems = geometry[strides[0][0]]!.length / strides[0][1];
        const missingKeys: (keyof GeometryData)[] = [];
        strides.forEach(([geometryKey, stride]) => {
            const geometryElement = geometry[geometryKey]!;
            if (geometryElement.length / stride !== numItems) {
                console.warn(`${ geometryKey } is not the same size as vertices. Will try to default`);
                console.groupCollapsed('Warning debug');
                console.log(`geometryElement.length / stride: ${ geometryElement.length / stride } !== numItems ${ numItems }`);
                console.log('Geometry: ', geometry, 'Strides: ', strides);
                console.groupEnd()
                missingKeys.push(geometryKey);
                // throw new Error("All arrays must represent the same number of items based on their strides");
            }
        })

        const totalStride = strides.reduce((sum, stride) => sum + stride[1], 0);

        const interleaved = new Float32Array(numItems * totalStride);

        for (let itemIndex = 0; itemIndex < numItems; itemIndex++) {
            let offset = 0;
            for (let arrayIndex = 0; arrayIndex < strides.length; arrayIndex++) {
                const [geometryKey, stride] = strides[arrayIndex];
                const start = itemIndex * stride;
                const end = start + stride;
                // try to guess any missing geometry properties (normals / uvs)
                if (missingKeys.includes(geometryKey)) {
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
                    interleaved.set(geometry[geometryKey]!.slice(start, end), itemIndex * totalStride + offset);
                }

                offset += stride;
            }
        }

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
