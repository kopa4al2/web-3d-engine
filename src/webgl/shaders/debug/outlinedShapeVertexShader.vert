#version 300 es
precision highp int;
precision highp float;

layout(std140) uniform Global {
    mat4 uProjectionView;
    vec4 uViewPosition;// The eye of the camera
    vec4 uLightDirection;
    vec4 uLightColor;
};

layout(location = 0) in vec3 aVertexPosition;
layout(location = 1) in vec2 uv;
layout(location = 2) in vec3 normal;

//out float vLatitude;
//out float vLongitude;
out vec2 vUV;
//out int vInstanceId;

uniform sampler2D instanceDataTexture;
uniform float textureWidth;

mat4 getInstanceMatrix(float id, float offset) {
    //    float textureWidth = 1024.0;
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
// TODO: CHat gpt recommends this, try it
//mat4 getModelMatrix(int instanceID) {
//    float row = float(instanceID) * 4.0;
//    return mat4(
//    texelFetch(modelMatrixTexture, ivec2(0, int(row)), 0),
//    texelFetch(modelMatrixTexture, ivec2(1, int(row + 1.0)), 0),
//    texelFetch(modelMatrixTexture, ivec2(2, int(row + 2.0)), 0),
//    texelFetch(modelMatrixTexture, ivec2(3, int(row + 3.0)), 0)
//    );
//}

void main() {
    mat4 modelMatrix = getInstanceMatrix(float(gl_InstanceID), 0.0);

    gl_Position = uProjectionView * modelMatrix * vec4(aVertexPosition, 1.0);

    vUV = uv;
//    vInstanceId = gl_InstanceID;
    //    vLatitude = uv.x;
    //    vLongitude = uv.y;
}

