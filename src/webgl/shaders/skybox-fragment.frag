#version 300 es
precision highp int;
precision highp float;
precision highp sampler2DArray;

const int MAX_DIRECTIONAL_LIGHTS = 2;
const int MAX_POINT_LIGHTS = 4;
const float PI = radians(180.0);
const float TAU = radians(360.0);

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

struct TextureMap {
    vec2 uv_offset;
    vec2 uv_scale;
    uint texture_layer;
    float _padding;
//    vec3 _padding;
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

layout (std140) uniform Light {
    DirectionalLight directionalLights[MAX_DIRECTIONAL_LIGHTS];
    PointLight pointLights[MAX_POINT_LIGHTS];
    uint numDirectionalLights;
    uint numPointLights;
// vec2 padding
};

layout (std140) uniform Time {
    float deltaTime;
    float timePassed;
// vec2 _padding;
};

uniform samplerCube EnvCubeMap;

in vec3 vWorldDir;
out vec4 fragColor;

void main() {
    //    fragColor = vec4(1.0, 0.0, 0.0, 1.0);
    fragColor = texture(EnvCubeMap, vWorldDir);
}
