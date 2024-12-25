//@vertex
//fn vertex_main(@location(0) position: vec3<f32>,
//               @builtin(model_matrix) modelMatrix: mat4x4<f32>,
//               @group(0) @binding(0) lightViewProjectionMatrix: mat4x4<f32>) -> @builtin(position) vec4<f32> {
//    var worldPosition = modelMatrix * vec4<f32>(position, 1.0);
//    return lightViewProjectionMatrix * worldPosition;
//}


struct Global {
    lightViewProjectionMatrix : mat4x4<f32>,
}
struct Model {
    modelMatrix : mat4x4<f32>,
};

@binding(0) @group(0) var<uniform> global : Global;
@binding(1) @group(0) var<uniform> model : Model;

@vertex
fn main(@location(0) position : vec3<f32>) -> @builtin(position) vec4<f32> {
    return global.lightViewProjectionMatrix * model.modelMatrix * vec4<f32>(position, 1.0);
}