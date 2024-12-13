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

layout (std140) uniform PBRMaterial {
    TextureMap albedo_map;
    TextureMap normal_map;
    TextureMap metallic_map;
    vec4 base_color;
};

layout (std140) uniform Camera {
    mat4 projectionViewMatrix;
    vec4 cameraPosition;// The eye of the camera
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

uniform sampler2DArray TexturesArray;
uniform samplerCube EnvCubeMap;

in vec3 vFragPosition;
in vec3 vNormal;
in vec2 vTextureCoord;
in vec3 vTangent;
in vec3 vBitangent;
out vec4 fragColor;

void main() {
    vec2 uv = albedo_map.uv_scale * vTextureCoord + albedo_map.uv_offset;
    vec4 baseColor = texture(TexturesArray, vec3(uv, albedo_map.texture_layer)) * base_color;

    // TODO: Hard coded alpha mask, by default enabled for all
    if (baseColor.a <= 0.5) {
        discard;
    }

    // --- Metallic and Roughness ---
    vec2 metallicRoughtnessUv = metallic_map.uv_scale * vTextureCoord + metallic_map.uv_offset;
    vec3 metallicRoughness = texture(TexturesArray, vec3(metallicRoughtnessUv, metallic_map.texture_layer)).rgb;
//    float metallic = 0.6;
//    float roughness = 0.3;
    float metallic = min(0.4, metallicRoughness.b);
    float roughness = max(0.2, metallicRoughness.g);

    // --- Normal Mapping ---
    mat3 TBN = mat3(vTangent, vBitangent, vNormal);
    vec2 normalUv = normal_map.uv_scale * vTextureCoord + normal_map.uv_offset ;
    vec3 normalTangent = texture(TexturesArray, vec3(normalUv, normal_map.texture_layer)).rgb;
    normalTangent = normalize(normalTangent * 2.0 - 1.0);
    vec3 normalWorld = normalize(TBN * normalTangent);

    // --- View Direction ---
    vec3 viewDir = normalize(cameraPosition.xyz - vFragPosition);
    vec3 reflectedDir = reflect(-viewDir, normalize(vNormal));
    vec3 envColor = texture(EnvCubeMap, reflectedDir).rgb;

    // Fresnel Reflectance at Normal Incidence
    vec3 F0 = mix(vec3(0.04), baseColor.rgb, metallic);
    // Avoid zero roughness
    float roughnessSquared = roughness * roughness;
    float envNdotL = max(dot(normalWorld, reflectedDir), 0.1);
    float envNdotV = max(dot(normalWorld, viewDir), 0.1);
    vec3 fresnelEnv = F0 + (1.0 - F0) * pow(1.0 - envNdotV, 5.0);

    vec3 finalColor = vec3(0.0);

    // --- Point Lights ---
    for (uint i = 0u; i < numPointLights; i++) {
        PointLight light = pointLights[i];

        // Light direction and distance
        vec3 lightDir = normalize(light.position.xyz - vFragPosition);
        float distance = length(light.position.xyz - vFragPosition);

        // Attenuation
        float attenuation = 1.0 / (light.constantAtt + light.linearAtt * distance + light.quadraticAtt * distance * distance);

        // Fresnel term (Schlick's approximation)
        vec3 halfwayDir = normalize(lightDir + viewDir);
        float NdotH = max(dot(normalWorld, halfwayDir), 0.0);
        vec3 fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotH, 5.0);

        // Normal Distribution Function (NDF) - GGX
        float NdotH2 = NdotH * NdotH;
        float alpha2 = roughnessSquared * roughnessSquared;
        float D = alpha2 / (PI * pow(NdotH2 * (alpha2 - 1.0) + 1.0, 2.0));

        // Geometry Function (Schlick-GGX)
        float NdotV = max(dot(normalWorld, viewDir), 0.1);
        float NdotL = max(dot(normalWorld, lightDir), 0.1);
        float k = roughnessSquared / 2.0;
        float Gv = NdotV / (NdotV * (1.0 - k) + k);
        float Gl = NdotL / (NdotL * (1.0 - k) + k);
        float G = Gv * Gl;

        // Specular term
        vec3 specular = (D * fresnel * G) / (4.0 * NdotV * NdotL + 0.001);

        // Diffuse term (Lambertian)
        vec3 diffuse = (1.0 - fresnel) * (1.0 - metallic) * baseColor.rgb;
//        vec3 diffuse = max((1.0 - fresnel) * (1.0 - metallic), 0.0) * baseColor.rgb;
        // Combine light contributions
        vec3 radiance = light.color.rgb * light.intensity;
        finalColor += attenuation * radiance * (diffuse + specular) * NdotL;
    }

    // --- Directional Lights ---
    for (uint i = 0u; i < numDirectionalLights; i++) {
        DirectionalLight dirLight = directionalLights[i];

        // Light direction
        vec3 lightDir = normalize(-dirLight.direction.xyz);

        // Fresnel term (Schlick's approximation)
        vec3 halfwayDir = normalize(lightDir + viewDir);
        float NdotH = max(dot(normalWorld, halfwayDir), 0.0);
        vec3 fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotH, 5.0);

        // Normal Distribution Function (NDF) - GGX
        float NdotH2 = NdotH * NdotH;
        float alpha2 = roughnessSquared * roughnessSquared;
        float D = alpha2 / (PI * pow(NdotH2 * (alpha2 - 1.0) + 1.0, 2.0));

        // Geometry Function (Schlick-GGX)
        float NdotV = max(dot(normalWorld, viewDir), 0.1);
        float NdotL = max(dot(normalWorld, lightDir), 0.1);
        float k = roughnessSquared / 2.0;
        float Gv = NdotV / (NdotV * (1.0 - k) + k);
        float Gl = NdotL / (NdotL * (1.0 - k) + k);
        float G = Gv * Gl;

        // Specular term
        vec3 specular = (D * fresnel * G) / (4.0 * NdotV * NdotL + 0.001);

        // Diffuse term (Lambertian)
        vec3 diffuse = (1.0 - fresnel) * (1.0 - metallic) * baseColor.rgb;
//        vec3 diffuse = max((1.0 - fresnel) * (1.0 - metallic), 0.0) * baseColor.rgb;
        // Combine light contributions
        vec3 radiance = dirLight.color.rgb * dirLight.intensity;
        finalColor += radiance * (diffuse + specular) * NdotL;
    }

    // --- Environment Map Contributions ---
    vec3 envSpecular = fresnelEnv /*** envNdotL*/ * envColor;
    vec3 envDiffuse = fresnelEnv /*** envNdotL*/  * (1.0 - metallic) * (1.0 - fresnelEnv);
    finalColor += envDiffuse + envSpecular;

    // Ambient Light
    vec3 ambient = vec3(0.1);// Fixed ambient term
//    finalColor += ambient;
    finalColor += ambient * (1.0 - metallic);

    fragColor = vec4(finalColor, 1.0);
//    fragColor = vec4(normalTangent, 1.0);
//    fragColor = vec4(float(numDirectionalLights) / float(MAX_DIRECTIONAL_LIGHTS) , float(numPointLights) / float(MAX_POINT_LIGHTS), 0.0, 1.0);
//    fragColor = texture(TexturesArray, vec3(vTextureCoord, normal_map.texture_layer));
}


/*
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

layout(std140) uniform PBRMaterial {
    uint albedo_map;// Index for albedo texture in the texture array
    uint normal_map;// Index for normal map in the texture array
    uint metallic_map;// Index for metallic texture in the texture array
    uint roughness_map;// Index for roughness texture in the texture array
    vec2 uv_offset;// UV offset for texture mapping
    vec2 uv_scale;// UV scale for texture mapping
};


uniform sampler2DArray TexturesArray;

in vec3 vFragPosition;
in vec3 vNormal;
in vec2 vTextureCoord;
in vec3 vTangent;
in vec3 vBitangent;
out vec4 fragColor;

void main() {
    vec3 albedo = texture(TexturesArray, vec3(vTextureCoord, albedo_map)).rgb;
    mat3 TBN = mat3(vTangent, vBitangent, vNormal);
    vec3 normalTangent = texture(TexturesArray, vec3(vTextureCoord, normal_map)).rgb;
    normalTangent = normalize(normalTangent * 2.0 - 1.0);
    vec3 normalWorld = normalize(TBN * normalTangent);
    vec3 viewDir = normalize(cameraPosition.xyz - vFragPosition);

    vec3 finalColor = vec3(0.0);
    vec3 testColor = vec3(0.0);

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
        vec3 diffuse = diff * light.color.rgb * albedo * light.intensity;

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
        vec3 diffuse = diff * dirLight.color.rgb * albedo * dirLight.intensity;

        // Specular
        vec3 reflectDir = reflect(-lightDir, normalWorld);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
        vec3 specular = spec * dirLight.color.rgb * dirLight.intensity * 5.0;

        // Combine and add to final color
        finalColor += diffuse + specular;
        testColor += specular;
    }

    // Ambient Light
    vec3 ambient = vec3(0.1);// Fixed ambient term
    finalColor += ambient;

    fragColor = vec4(finalColor, 1.0);
}

*/