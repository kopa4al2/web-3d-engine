struct Global {
    projectionViewMatrix: mat4x4<f32>
}
struct VertexInput {
    @location(0) position: vec3<f32>,
};

@group(0) @binding(0) var<uniform> global: Global;

@vertex
fn main(input: VertexInput) -> @builtin(position) vec4<f32> {
    var clipPosition = vec4<f32>(input.position, 1.0);// * global.projectionViewMatrix;
    clipPosition.z = clipPosition.z * 0.5 + 0.5;
    return clipPosition;
}
