#version 300 es
precision highp int;
precision highp float;

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
    vec4 cameraPosition;// The eye of the camera
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

const vec3 cubeVertices[8] = vec3[8](
    vec3(-1.0, -1.0, -1.0), // 0
    vec3( 1.0, -1.0, -1.0), // 1
    vec3( 1.0,  1.0, -1.0), // 2
    vec3(-1.0,  1.0, -1.0), // 3
    vec3(-1.0, -1.0,  1.0), // 4
    vec3( 1.0, -1.0,  1.0), // 5
    vec3( 1.0,  1.0,  1.0), // 6
    vec3(-1.0,  1.0,  1.0)  // 7
);

// Define the 36 vertices for the cube (2 triangles per face, 6 faces total)
const vec3 positions[36] = vec3[36](
    cubeVertices[0], cubeVertices[1], cubeVertices[2], // -Z face
    cubeVertices[2], cubeVertices[3], cubeVertices[0],
    cubeVertices[4], cubeVertices[5], cubeVertices[6], // +Z face
    cubeVertices[6], cubeVertices[7], cubeVertices[4],
    cubeVertices[0], cubeVertices[4], cubeVertices[7], // -X face
    cubeVertices[7], cubeVertices[3], cubeVertices[0],
    cubeVertices[1], cubeVertices[5], cubeVertices[6], // +X face
    cubeVertices[6], cubeVertices[2], cubeVertices[1],
    cubeVertices[3], cubeVertices[7], cubeVertices[6], // +Y face
    cubeVertices[6], cubeVertices[2], cubeVertices[3],
    cubeVertices[0], cubeVertices[4], cubeVertices[5], // -Y face
    cubeVertices[5], cubeVertices[1], cubeVertices[0]
);

out vec3 vWorldDir;

void main() {
    vWorldDir = (cameraPosition * vec4(positions[gl_VertexID], 0.0)).xyz;
    gl_Position = projectionViewMatrix * vec4(positions[gl_VertexID], 1.0);
}