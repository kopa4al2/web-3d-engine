struct Global {
    uMVPMatrix: mat4x4<f32>,
};

struct VertexInput {
    @location(0) position: vec3<f32>,
};

@group(0) @binding(0) var<uniform> global: Global;
@group(0) @binding(1) var<uniform> flags: u32;

@vertex
fn main(input: VertexInput) -> @builtin(position) vec4<f32> {
    return global.uMVPMatrix * vec4<f32>(input.position, 1);
}