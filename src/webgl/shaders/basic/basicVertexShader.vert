#version 300 es
precision highp int;
precision highp float;


layout(std140) uniform Global {
    mat4 uModelViewProjection;
};

layout(location = 0) in vec3 aVertexPosition;

void main() {
    gl_Position = vec4(aVertexPosition, 1.0);
//    gl_Position = uModelViewProjection * vec4(aVertexPosition, 1.0);
}
