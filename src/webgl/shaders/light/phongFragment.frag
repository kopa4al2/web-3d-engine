#version 300 es
precision highp int;
precision highp float;
precision highp sampler2DArray;

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

layout(std140) uniform PhongMaterial {
    vec4 uMaterialAmbient;
    vec4 uMaterialDiffuse;// This will be color if texutre isnt present4
    vec4 uMaterialSpecular;
};
uniform sampler2DArray TexturesArray;

in vec3 vFragPosition;
in vec2 vTextureCoord;
in vec3 vNormal;
in vec3 vTangent;
in vec3 vBitangent;
out vec4 fragColor;


void main() {
    vec3 finalColor = vec3(0.0);
    vec3 texture = texture(TexturesArray, vec3(vTextureCoord, 0)).rgb;
    vec3 normalWorld = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition.xyz - vFragPosition);

    // --- Point Lights ---
    for (uint i = 0u; i < numPointLights; i++) {
        PointLight light = pointLights[i];

        // Light direction and distance
        vec3 lightDir = normalize(light.position.xyz - vFragPosition);
        float distance = length(light.position.xyz - vFragPosition);

        // Attenuation
        float attenuation = 1.0 / (light.constantAtt + light.linearAtt * distance + light.quadraticAtt * distance * distance);

        // Diffuse
        float diff = max(dot(normalWorld, lightDir), 0.0);
        vec3 diffuse = diff * light.color.rgb * texture * light.intensity;

        // Specular shading (Blinn-Phong)
        vec3 halfwayDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(normalWorld, halfwayDir), 0.0), 32.0);// Shininess factor
        vec3 specular = spec * light.color.rgb;

        // Combine and add to final color
        finalColor += attenuation * (diffuse + specular);
    }

    // --- Directional Lights ---
    for (uint i = 0u; i < numDirectionalLights; i++) {
        DirectionalLight dirLight = directionalLights[i];

        // Light direction
        vec3 lightDir = normalize(-dirLight.direction.xyz);

        // Diffuse
        float diff = max(dot(normalWorld, lightDir), 0.0);
        vec3 diffuse = diff * dirLight.color.rgb * texture * dirLight.intensity;

        // Specular
        vec3 reflectDir = reflect(-lightDir, normalWorld);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);// Shininess = 32
        vec3 specular = spec * dirLight.color.rgb * dirLight.intensity;

        // Combine and add to final color
        finalColor += diffuse + specular;
    }

    // Ambient Light
    vec3 ambient = vec3(0.1);// Fixed ambient term
    finalColor += ambient;

    fragColor = vec4(finalColor, 1.0);
}
