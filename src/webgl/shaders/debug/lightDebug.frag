#version 300 es
precision highp int;
precision highp float;

layout(std140) uniform Material {
   vec4 uColor;
};

out vec4 fragColor;

void main() {
    fragColor = uColor;
}
