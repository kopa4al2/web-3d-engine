struct Camera {
    projectionViewMatrix: mat4x4<f32>,  // 64 bytes
    viewMatrix: mat4x4<f32>,            // 64 bytes
    cameraPosition: vec4<f32>,          // 16 bytes
    cameraForward: vec4<f32>,           // 16 bytes
    cameraRight: vec4<f32>,             // 16 bytes
    cameraUp: vec4<f32>,                // 16 bytes
    nearFarPlanes: vec2<f32>,           // 8 bytes, aligned to 16 bytes
}

struct InstanceData {
  modelMatrix: mat4x4<f32>,
  modelMatrixInverseTranspose: mat4x4<f32>,
};

struct VertexInput {
    @builtin(instance_index) instanceID: u32,
    @location(0) position: vec3<f32>,
    @location(1) textureCoord: vec2<f32>,
    @location(2) normal: vec3<f32>,
    @location(3) tangent: vec4<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) pixelPosition: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) textureCoord: vec2<f32>,
    @location(3) tangent: vec3<f32>,
    @location(4) bitangent: vec3<f32>,
    @interpolate(flat) @location(5) instanceID: u32,
};


@group(0) @binding(0) var<uniform> global: Camera;

@group(2) @binding(0) var<storage, read> instanceData: array<InstanceData>;

@vertex
fn main(input: VertexInput) -> VertexOutput {
    let modelMatrix = instanceData[input.instanceID].modelMatrix;
    let inverseModel = instanceData[input.instanceID].modelMatrixInverseTranspose;

    var output: VertexOutput;
    output.textureCoord = input.textureCoord;
    output.instanceID = input.instanceID;

    output.position = global.projectionViewMatrix * modelMatrix * vec4<f32>(input.position, 1);

//    output.normal = extract_mat3_from_mat4(inverseModel) * input.normal;
    output.pixelPosition = (modelMatrix * vec4<f32>(input.position, 1.0)).xyz;


    let normal = normalize(extract_mat3_from_mat4(inverseModel) * input.normal);
    let tangent = normalize(modelMatrix * input.tangent).xyz;
//    let tangent = normalize(extract_mat3_from_mat4(modelMatrix) * input.tangent.xyz);
    let bitangent = cross(normal, tangent) * input.tangent.w;

    output.tangent = tangent;
    output.normal = normal;
    output.bitangent = normalize(bitangent);

    return output;
}



fn extract_mat3_from_mat4(m: mat4x4<f32>) -> mat3x3<f32> {
    return mat3x3<f32>(m[0].xyz, m[1].xyz, m[2].xyz);
}
//fn extract_mat3_from_mat4(m: mat4x4<f32>) -> mat3x3<f32> {
//    return mat3x3<f32>(
//        vec3<f32>(m[0].x, m[0].y, m[0].z),
//        vec3<f32>(m[1].x, m[1].y, m[1].z),
//        vec3<f32>(m[2].x, m[2].y, m[2].z)
//    );
//}
