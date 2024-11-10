#version 300 es
precision highp int;
precision highp float;


layout(std140) uniform World {
    mat4 uModelViewProjection;
};

layout(location = 0) in vec3 aVertexPosition;

void main() {
    gl_Position = uModelViewProjection * vec4(aVertexPosition, 1.0);
}