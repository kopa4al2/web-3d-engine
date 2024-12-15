struct Camera {
    projectionViewMatrix: mat4x4<f32>,  // 64 bytes
    projectionMatrix: mat4x4<f32>,      // 64 bytes
    viewMatrix: mat4x4<f32>,            // 64 bytes
    position: vec4<f32>,                // 16 bytes
    forward: vec4<f32>,                 // 16 bytes
    up: vec4<f32>,                      // 16 bytes
    nearFarFovAspect: vec4<f32>,        // 16 bytes
}

struct InstanceData {
  modelMatrix: mat4x4<f32>,
  modelMatrixInverseTranspose: mat4x4<f32>,
};

struct VertexInput {
    @location(0) position: vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldDirection: vec3<f32>,
};


@group(0) @binding(0) var<uniform> camera: Camera;

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.worldDirection = input.position;
   
   var viewMatrix = camera.viewMatrix;
   viewMatrix[3][0] = 0.0;       // Zero out translation (x)
   viewMatrix[3][1] = 0.0;       // Zero out translation (y)
   viewMatrix[3][2] = 0.0;       // Zero out translation (z)
   output.position = camera.projectionMatrix * viewMatrix * vec4(input.position, 1.0);
   output.position.z = output.position.w - 0.001;
   
   return output;
}
