#version 300 es
precision highp int;
precision highp float;

const int MAX_DIRECTIONAL_LIGHTS = 2;
const int MAX_POINT_LIGHTS = 4;

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


layout(std140) uniform Camera {
    mat4 projectionViewMatrix;
    mat4 projectionMatrix;
    mat4 viewMatrix;
    vec4 cameraPosition;
    vec4 cameraForward;
    vec4 cameraUp;
    vec4 nearFarFovAspect;
};

layout(std140) uniform Light {
    DirectionalLight directionalLights[MAX_DIRECTIONAL_LIGHTS];
    PointLight pointLights[MAX_POINT_LIGHTS];
    uint numDirectionalLights;
    uint numPointLights;
    // vec2 padding
};

layout(std140) uniform Time {
    float deltaTime;
    float timePassed;
    // vec2 _padding;
};

layout(location = 0) in vec3 aVertexPosition;
layout(location = 1) in vec2 textureUV;
layout(location = 2) in vec3 aNormal;
layout(location = 3) in vec3 aTangent;
layout(location = 4) in vec3 aBitangent;

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

    vFragPosition = vec3(modelMatrix * vec4(aVertexPosition, 1.0));
    //    vFragNormal = mat3(inverseModel) * aNormal;

    vTextureCoord = textureUV;
    vNormal = normalize(modelMatrix * vec4(aNormal, 0.0)).xyz;
    vTangent = normalize(modelMatrix * vec4(aTangent, 0.0)).xyz;
    vBitangent = normalize(modelMatrix * vec4(aBitangent, 0.0)).xyz;

    gl_Position = projectionViewMatrix * modelMatrix * vec4(aVertexPosition, 1.0);
}

mat4 getInstanceMatrix(float id, float offset) {
    float numberOfPixelsTotal = 8.0; // The number of pixels used for data. 1 pixel is 4 floats - 16 bytes. We use 2 mat4 so 2 * 16 = 32 flota - 8 pixels
    float baseIndex = id * 8.0 + offset;  // Each mat4 uses 4 pixels
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
