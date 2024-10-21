struct World {
    modelViewProjectionMatrix: mat4x4<f32>,
    uModelMatrix: mat4x4<f32>,
    uModelMatrixInverse: mat4x4<f32>,
};

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) textureCoord: vec2<f32>,
    @location(2) normal: vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) pixelPosition: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) textureCoord: vec2<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: World;

@vertex
fn main(input: VertexInput) -> VertexOutput {

    var output: VertexOutput;
    output.textureCoord = input.textureCoord;
    output.position = uniforms.modelViewProjectionMatrix * vec4<f32>(input.position, 1);
    output.normal = extract_mat3_from_mat4(uniforms.uModelMatrixInverse) * input.normal;
    output.pixelPosition = (uniforms.uModelMatrix * vec4(input.position, 1)).xyx;

    return output;
}

fn extract_mat3_from_mat4(m: mat4x4<f32>) -> mat3x3<f32> {
    return mat3x3<f32>(
        vec3<f32>(m[0].x, m[0].y, m[0].z),
        vec3<f32>(m[1].x, m[1].y, m[1].z),
        vec3<f32>(m[2].x, m[2].y, m[2].z)
    );
}
