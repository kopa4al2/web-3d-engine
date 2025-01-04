const MAX_SHADOW_CASTING_LIGHTS = 2;

struct Camera {
    projectionViewMatrix: mat4x4<f32>,                                    // 64 bytes
    projectionMatrix: mat4x4<f32>,                                        // 64 bytes
    viewMatrix: mat4x4<f32>,                                              // 64 bytes
    lightProjectionView: array<mat4x4<f32>, MAX_SHADOW_CASTING_LIGHTS>,   // 64 bytes
    position: vec4<f32>,                                                  // 16 bytes
    forward: vec4<f32>,                                                   // 16 bytes
    up: vec4<f32>,                                                        // 16 bytes
    nearFarFovAspect: vec4<f32>,                                          // 16 bytes
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
    @location(4) joints: vec4<f32>,
//    @location(4) joints: vec4<u32>,
    @location(5) weights: vec4<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) pixelPosition: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) textureCoord: vec2<f32>,
    @location(3) tangent: vec3<f32>,
    @location(4) bitangent: vec3<f32>,
//    @location(5) shadowPos: vec4<f32>,
//    @interpolate(flat) @location(6) instanceID: u32,
};


@group(0) @binding(0) var<uniform> global: Camera;

@group(2) @binding(0) var<storage, read> instanceData: array<InstanceData>;
@group(2) @binding(1) var<uniform> u_jointMatrices: array<mat4x4<f32>, 256>;

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let modelMatrix = instanceData[input.instanceID].modelMatrix;
    let inverseModel = instanceData[input.instanceID].modelMatrixInverseTranspose;


    var skinMatrix = mat4x4<f32>();
    for (var i = 0u; i < 4u; i++) {
        skinMatrix += u_jointMatrices[u32(input.joints[i])] * input.weights[i];
    }

    // Transform position, normal, and tangent
    let skinnedPosition = skinMatrix * vec4<f32>(input.position, 1.0);
    let skinnedNormal = normalize((skinMatrix * vec4<f32>(input.normal, 0.0)).xyz);
    let skinnedTangent = normalize((skinMatrix * input.tangent).xyz);

    // Apply model matrix for world-space transformation
//    let worldPosition = skinnedPosition;
    let worldNormal = normalize((modelMatrix * vec4<f32>(skinnedNormal, 0.0)).xyz);
    let worldTangent = normalize((modelMatrix * vec4<f32>(skinnedTangent, 0.0)).xyz);


    // COMPUTE TBN MATRIX
    let normalMatrix = extract_mat3_from_mat4(inverseModel);
//    let normal = normalize(normalMatrix * input.normal);
//    let tangent = normalize(normalMatrix * input.tangent.xyz);
//    let bitangent = cross(normal, tangent) * input.tangent.w;
    let bitangent = cross(worldNormal, worldTangent) * input.tangent.w;

    output.position = global.projectionViewMatrix * modelMatrix * skinnedPosition; //global.projectionViewMatrix * modelMatrix * vec4<f32>(input.position, 1.0);
    output.pixelPosition = (modelMatrix * skinnedPosition).xyz; // (modelMatrix * vec4<f32>(input.position, 1.0)).xyz;
    output.tangent = worldTangent;
    output.normal = worldNormal;
    output.bitangent = normalize(bitangent);
    output.textureCoord = input.textureCoord;

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
