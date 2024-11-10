struct Global {
    projectionView: mat4x4<f32>,
};


struct InstanceData {
  modelMatrix: mat4x4<f32>,
  inverseModel: mat4x4<f32>
};

struct VertexInput {
    @builtin(instance_index) instanceID: u32,
    @location(0) position: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) normal: vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
};

@group(2) @binding(0) var<storage, read> instanceData: array<InstanceData>;
@group(0) @binding(0) var<uniform> global: Global;

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let modelMatrix = instanceData[input.instanceID].modelMatrix;
//    let color = instanceData[input.instanceID].color;

    output.position = global.projectionView * modelMatrix * vec4<f32>(input.position, 1);
//    output.color = vec4<f32>(1.0, 0.0, 0.0, 1.0);
    output.color = vec4<f32>(modelMatrix[0][0], modelMatrix[1][1], modelMatrix[2][2], 1.0);

    return output;
}