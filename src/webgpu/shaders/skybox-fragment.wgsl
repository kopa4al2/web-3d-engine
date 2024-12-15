struct Camera {
    projectionViewMatrix: mat4x4<f32>,  // 64 bytes
    projectionMatrix: mat4x4<f32>,      // 64 bytes
    viewMatrix: mat4x4<f32>,            // 64 bytes
    position: vec4<f32>,                // 16 bytes
    forward: vec4<f32>,                 // 16 bytes
    up: vec4<f32>,                      // 16 bytes
    nearFarFovAspect: vec4<f32>,        // 16 bytes
}

struct DirectionalLight {
    direction: vec4<f32>,
    color: vec4<f32>,
    intensity: f32,
};

struct FragmentInput {
    @location(0) worldDirection: vec3<f32>,
}

@group(0) @binding(5) var envMap: texture_cube<f32>;
@group(0) @binding(6) var envSampler: sampler;

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
      return textureSample(envMap, envSampler, normalize(input.worldDirection));
//      return textureSample(envMap, envSampler, vec3(1.0, 0.0, 0.0));
}
