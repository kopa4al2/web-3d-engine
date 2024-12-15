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

out vec3 vWorldDir;

void main() {
    vWorldDir = aVertexPosition;
    
    mat4 viewMatrixWithoutTranslation = viewMatrix;
    viewMatrixWithoutTranslation[3][0] = 0.0;       // Zero out translation (x)
    viewMatrixWithoutTranslation[3][1] = 0.0;       // Zero out translation (y)
    viewMatrixWithoutTranslation[3][2] = 0.0;       // Zero out translation (z)
    gl_Position = projectionMatrix * viewMatrixWithoutTranslation * vec4(aVertexPosition, 1.0);
    
    // Push the skybox to the far plane
    gl_Position.z = gl_Position.w - 0.0001;
}
