#version 300 es
precision highp int;
precision highp float;

layout(std140) uniform Global {
    mat4 uProjectionView;
};

layout(location = 0) in vec3 aVertexPosition;

uniform sampler2D instanceDataTexture;
uniform float textureWidth;

mat4 getInstanceMatrix(float id, float offset) {
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

void main() {
    mat4 modelMatrix = getInstanceMatrix(float(gl_InstanceID), 0.0);
    gl_Position = uProjectionView * modelMatrix * vec4(aVertexPosition, 1.0);
}