import { FragmentShaderName, VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import { BindGroupLayoutCpu } from 'core/resources/GPUResourceManager';

const data: Record<string, any> = {};
export default class PipelineBuilder {


    private constructor() {
    }

    public static newBuilder(): PipelineBuilder {
        return new PipelineBuilder();
    }

    public fragmentShader(name: FragmentShaderName) {
        data.fragmentShader = name;
    }

    public vertexShader(name: VertexShaderName) {
        data.vertexShader = name;
    }

    public vertexLayout(strides: number[]) {
        data.vertexLayout = {
            layout: strides.map(stride => ({
                dataType: 'float32', elementsPerVertex: stride
            })),
            shaderName: VertexShaderName.BASIC,
            stride: Float32Array.BYTES_PER_ELEMENT * strides.reduce((sum, stride) => sum + stride, 0),
        };
    }

    public withBindGroupLayout(bindGroupLayout: BindGroupLayoutCpu) {
        data.bindGroupLayout = bindGroupLayout;
    }
}
