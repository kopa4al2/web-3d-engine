struct Global {
    projectionViewMatrix: mat4x4<f32>
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
    @location(3) tangent: vec3<f32>,
    @location(4) bitangent: vec3<f32>,
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


@group(0) @binding(0) var<uniform> global: Global;

@group(2) @binding(0) var<storage, read> instanceData: array<InstanceData>;

@vertex
fn main(input: VertexInput) -> VertexOutput {
    let modelMatrix = instanceData[input.instanceID].modelMatrix;
    let inverseModel = instanceData[input.instanceID].modelMatrixInverseTranspose;

    var output: VertexOutput;
    output.textureCoord = input.textureCoord;
    output.instanceID = input.instanceID;

    output.position = global.projectionViewMatrix * modelMatrix * vec4<f32>(input.position, 1);

    output.pixelPosition = (modelMatrix * vec4<f32>(input.position, 1.0)).xyz;

    let inverseNormal = extract_mat3_from_mat4(inverseModel) * input.normal;
    output.tangent = normalize(inverseNormal * input.tangent);
    output.bitangent = normalize(inverseNormal * input.bitangent);
    output.normal = normalize(inverseNormal * input.normal);

//    NO INVERSE TRANSPOSE
//    output.tangent = normalize(modelMatrix * vec4<f32>(input.tangent, 0.0)).xyz;
//    output.bitangent = normalize(modelMatrix * vec4<f32>(input.bitangent, 0.0)).xyz;
//    output.normal = normalize(modelMatrix * vec4<f32>(input.normal, 0.0)).xyz;

    return output;
}

fn extract_mat3_from_mat4(m: mat4x4<f32>) -> mat3x3<f32> {
    return mat3x3<f32>(m[0].xyz, m[1].xyz, m[2].xyz);
}

//fn transformTBN(
//    T: vec3<f32>,
//    B: vec3<f32>,
//    N: vec3<f32>,
//    inverseTranspose: mat4x4<f32>
//) -> mat3x3<f32> {
//    // Compute the inverse transpose of the upper-left 3x3 matrix
//    let normalMatrix = transpose(inverse(mat3x3<f32>(
//        modelMatrix[0].xyz,
//        modelMatrix[1].xyz,
//        modelMatrix[2].xyz
//    )));
//
//    // Transform TBN vectors
//    let tangent = normalize(normalMatrix * T);
//    let bitangent = normalize(normalMatrix * B);
//    let normal = normalize(normalMatrix * N);
//
//    // Return transformed TBN matrix
//    return mat3x3<f32>(tangent, bitangent, normal);
//}
