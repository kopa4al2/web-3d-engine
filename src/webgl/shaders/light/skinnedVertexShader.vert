#version 300 es
precision highp int;
precision highp float;

//const int MAX_DIRECTIONAL_LIGHTS = 2;
//const int MAX_POINT_LIGHTS = 4;
//const int MAX_SPOT_LIGHTS = 4;
//const int MAX_SHADOW_CASTING_LIGHTS;

/*{{GLOBALS}}*/

struct SpotLight {
    vec4 position;
    vec4 direction;
    vec4 color;

    float innerCutoff;
    float outerCutoff;

    float intensity;
    float constantAtt;
    float linearAtt;
    float quadraticAtt;
};

struct PointLight {
    vec4 position;
    vec4 color;
    float intensity;
    float constantAtt;// Constant attenuation
    float linearAtt;// Linear attenuation
    float quadraticAtt;// Quadratic attenuation
};

struct DirectionalLight {
    vec4 direction;
    vec4 color;
    float intensity;
};

layout (std140) uniform Camera {
    mat4 projectionViewMatrix;
    mat4 projectionMatrix;
    mat4 viewMatrix;
    mat4[MAX_SHADOW_CASTING_LIGHTS] lightProjectionView;
    vec4 cameraPosition;
    vec4 cameraForward;
    vec4 cameraUp;
    vec4 nearFarFovAspect;
};

layout (std140) uniform Light {
    DirectionalLight directionalLights[MAX_DIRECTIONAL_LIGHTS];
    PointLight pointLights[MAX_POINT_LIGHTS];
    SpotLight spotLights[MAX_SPOT_LIGHTS];
    uint numDirectionalLights;
    uint numPointLights;
    uint numSpotLights;
    vec2 padding;
};

layout(std140) uniform Time {
    float deltaTime;
    float timePassed;
    vec2 _padding;
};

layout(std140) uniform SkinnedMeshJointMatrices {
    mat4[300] jointMatrices;
};

layout(location = 0) in vec3 aVertexPosition;
layout(location = 1) in vec2 textureUV;
layout(location = 2) in vec3 aNormal;
layout(location = 3) in vec4 aTangent;
layout(location = 4) in vec4 aJointIndices;
layout(location = 5) in vec4 aJointWeights;

out vec3 vFragPosition;
out vec2 vTextureCoord;
out vec3 vNormal;
out vec3 vTangent;
out vec3 vBitangent;

uniform sampler2D instanceDataTexture;
uniform float textureWidth;

        
mat4 getInstanceMatrix(float id, float offset);


void main() {
    mat4 modelMatrix = getInstanceMatrix(float(gl_InstanceID), 0.0);
    mat4 inverseModel = getInstanceMatrix(float(gl_InstanceID), 4.0);

    mat4 skinMatrix = mat4(0.0);
    for (uint i = 0u; i < 4u; i++) {
        skinMatrix += jointMatrices[uint(aJointIndices[i])] * aJointWeights[i];
    }

    // Apply the flip (e.g., flipping the Y-axis in case of a left-handed to right-handed conversion)
    vec3 flippedNormal = vec3(aNormal.x, aNormal.y, -aNormal.z);  // Flip Y-axis for normal
    vec3 flippedTangent = vec3(aTangent.x, aTangent.y, -aTangent.z);  // Flip Y-axis for tangent
//    vec3 flippedBitangent = vec3(aBitangent.x, -aBitangent.y, aBitangent.z);  // Flip Y-axis for bitangent

    // Transform position, normal, and tangent using skinning
    vec4 skinnedPosition = skinMatrix * vec4(aVertexPosition, 1.0);
//    vec3 skinnedNormal = normalize((skinMatrix * vec4(flippedNormal, 0.0)).xyz);
//    vec3 skinnedTangent = normalize((skinMatrix * vec4(flippedTangent, 0.0)).xyz);
        vec3 skinnedNormal = normalize((skinMatrix * vec4(aNormal, 0.0)).xyz);
        vec3 skinnedTangent = normalize((skinMatrix * vec4(aTangent.xyz, 0.0)).xyz);

    // Apply normal matrix to transform into world space
    mat3 normalMatrix = mat3(inverseModel);
    vec3 worldNormal = normalize(normalMatrix * skinnedNormal);
    vec3 worldTangent = normalize(normalMatrix * skinnedTangent);

    // Compute bitangent
    vec3 worldBitangent = normalize(cross(worldNormal, worldTangent) * aTangent.w);

    vTangent = worldTangent;
    vNormal = worldNormal;
    vBitangent = worldBitangent;
    vFragPosition = skinnedPosition.xyz;
    vTextureCoord = textureUV;
    gl_Position = projectionViewMatrix * skinnedPosition;
}

mat4 getInstanceMatrix(float id, float offset) {
    float numberOfPixelsTotal = 8.0;// The number of pixels used for data. 1 pixel is 4 floats - 16 bytes. We use 2 mat4 so 2 * 16 = 32 flota - 8 pixels
    float baseIndex = id * 8.0 + offset;// Each mat4 uses 4 pixels
    float u0 = baseIndex / textureWidth;
    float u1 = (baseIndex + 1.0) / textureWidth;
    float u2 = (baseIndex + 2.0) / textureWidth;
    float u3 = (baseIndex + 3.0) / textureWidth;

    // Access the single row, v = 0.5 to get the center of the 1-row texture
    vec4 row0 = texture(instanceDataTexture, vec2(u0, 0.5));
    vec4 row1 = texture(instanceDataTexture, vec2(u1, 0.5));
    vec4 row2 = texture(instanceDataTexture, vec2(u2, 0.5));
    vec4 row3 = texture(instanceDataTexture, vec2(u3, 0.5));

    return mat4(row0, row1, row2, row3);
}


// TODO: Test this
//mat4 getModelMatrix(int instanceID) {
//    float row = float(instanceID) * 4.0;
//    return mat4(
//    texelFetch(modelMatrixTexture, ivec2(0, int(row)), 0),
//    texelFetch(modelMatrixTexture, ivec2(1, int(row + 1.0)), 0),
//    texelFetch(modelMatrixTexture, ivec2(2, int(row + 2.0)), 0),
//    texelFetch(modelMatrixTexture, ivec2(3, int(row + 3.0)), 0)
//    );
//}
