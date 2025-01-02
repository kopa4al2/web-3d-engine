#version 300 es
precision highp int;
precision highp float;
precision highp sampler2DArray;

const int MAX_DIRECTIONAL_LIGHTS = 2;
const int MAX_POINT_LIGHTS = 4;
const int MAX_SPOT_LIGHTS = 4;

const float EPSILON = 0.0001;

const float PI = radians(180.0);
const float TAU = radians(360.0);

struct SpotLight {
    vec4 position;
    vec4 direction;
    vec4 color;

    float innerCutoff;
    float outerCutoff;

    float intensity;
    float constantAtt;
    float linearAtt;
    float quadraticAtt;
};

struct PointLight {
    vec4 position;
    vec4 color;
    float intensity;
    float constantAtt;
    float linearAtt;
    float quadraticAtt;
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
    SpotLight spotLights[MAX_SPOT_LIGHTS];
    uint numDirectionalLights;
    uint numPointLights;
    uint numSpotLights;
    vec2 padding;
};

layout (std140) uniform Time {
    float deltaTime;
    float timePassed;
    vec2 _padding;
};

uniform sampler2DArray TexturesArray;
uniform samplerCube EnvCubeMap;

in vec3 vFragPosition;
in vec3 vNormal;
in vec2 vTextureCoord;
in vec3 vTangent;
in vec3 vBitangent;
out vec4 fragColor;

vec3 calculateSpotlight(SpotLight spotlight, vec3 fragPosition, vec3 normal,
vec3 viewDir, vec3 baseColor, float roughnessSquared, float metallic, vec3 F0);

void main() {
    highp vec2 normalizedUv = fract(vTextureCoord);

    vec2 albedoUv = albedo_map.uv_scale * normalizedUv + albedo_map.uv_offset;
    albedoUv = clamp(albedoUv, albedo_map.uv_offset, albedo_map.uv_offset + albedo_map.uv_scale - vec2(EPSILON));
    vec4 baseColor = texture(TexturesArray, vec3(albedoUv, albedo_map.texture_layer)) * base_color;

    // TODO: Hard coded alpha mask, by default enabled for all
    if (baseColor.a <= 0.5) {
        discard;
    }

    // --- Metallic and Roughness ---
    vec2 metallicRoughtnessUv = metallic_map.uv_scale * normalizedUv + metallic_map.uv_offset;
    metallicRoughtnessUv = clamp(metallicRoughtnessUv, metallic_map.uv_offset, metallic_map.uv_offset + metallic_map.uv_scale - vec2(EPSILON));
    vec3 metallicRoughness = texture(TexturesArray, vec3(metallicRoughtnessUv, metallic_map.texture_layer)).rgb;
    float metallic = metallicRoughness.b;
    float roughness = metallicRoughness.g;

    // --- Normal Mapping ---
    mat3 TBN = mat3(vTangent, vBitangent, vNormal);
    vec2 normalUv = normal_map.uv_scale * normalizedUv + normal_map.uv_offset;
    normalUv = clamp(normalUv, normal_map.uv_offset, normal_map.uv_offset + normal_map.uv_scale - vec2(EPSILON));
    vec3 normalTangent = texture(TexturesArray, vec3(normalUv, normal_map.texture_layer)).rgb;
    normalTangent = normalize(normalTangent * 2.0 - 1.0);
    vec3 normalWorld = normalize(TBN * normalTangent);

    // --- View Direction ---
    vec3 viewDir = normalize(cameraPosition.xyz - vFragPosition);
    vec3 reflectedDir = reflect(-viewDir, normalWorld);
    vec3 envColor = texture(EnvCubeMap, reflectedDir).rgb;

    // Fresnel Reflectance at Normal Incidence
    vec3 F0 = mix(vec3(0.04), baseColor.rgb, metallic);
    float roughnessSquared = roughness * roughness;
    float envNdotL = max(dot(normalWorld, reflectedDir), EPSILON);
    float envNdotV = max(dot(normalWorld, viewDir), EPSILON);
    vec3 fresnelEnv = F0 + (1.0 - F0) * pow(1.0 - envNdotV, 5.0);

    vec3 finalColor = vec3(0.0);

    // --- Spot Lights ---
    for (uint i = 0u; i < numSpotLights; i++) {
        SpotLight spotLight = spotLights[i];
        finalColor += calculateSpotlight(spotLight, vFragPosition, normalWorld,
        viewDir, baseColor.rgb, roughnessSquared, metallic, F0);
    }

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
        float NdotH = max(dot(normalWorld, halfwayDir), EPSILON);
        vec3 fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotH, 5.0);

        // Normal Distribution Function (NDF) - GGX
        float NdotH2 = NdotH * NdotH;
        float alpha2 = roughnessSquared * roughnessSquared;
        float D = alpha2 / (PI * pow(NdotH2 * (alpha2 - 1.0) + 1.0, 2.0));

        // Geometry Function (Schlick-GGX)
        float NdotV = max(dot(normalWorld, viewDir), EPSILON);
        float NdotL = max(dot(normalWorld, lightDir), EPSILON);
        float k = roughnessSquared / 2.0;
        float Gv = NdotV / (NdotV * (1.0 - k) + k);
        float Gl = NdotL / (NdotL * (1.0 - k) + k);
        float G = Gv * Gl;

        // Specular term
        vec3 specular = (D * fresnel * G) / (4.0 * NdotV * NdotL + 0.001);

        // Diffuse term (Lambertian)
        vec3 diffuse = (1.0 - fresnel) * (1.0 - metallic) * baseColor.rgb;

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
        float NdotH = max(dot(normalWorld, halfwayDir), EPSILON);
        vec3 fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotH, 5.0);

        // Normal Distribution Function (NDF) - GGX
        float NdotH2 = NdotH * NdotH;
        float alpha2 = roughnessSquared * roughnessSquared;
        float D = alpha2 / (PI * pow(NdotH2 * (alpha2 - 1.0) + 1.0, 2.0));

        // Geometry Function (Schlick-GGX)
        float NdotV = max(dot(normalWorld, viewDir), EPSILON);
        float NdotL = max(dot(normalWorld, lightDir), EPSILON);
        float k = roughnessSquared / 2.0;
        float Gv = NdotV / (NdotV * (1.0 - k) + k);
        float Gl = NdotL / (NdotL * (1.0 - k) + k);
        float G = Gv * Gl;

        // Specular term
        vec3 specular = (D * fresnel * G) / (4.0 * NdotV * NdotL + 0.001);

        // Diffuse term (Lambertian)
        vec3 diffuse = (1.0 - fresnel) * (1.0 - metallic) * baseColor.rgb;

        vec3 radiance = dirLight.color.rgb * dirLight.intensity;
        finalColor += radiance * (diffuse + specular) * NdotL;
    }

    vec3 envSpecular = fresnelEnv * envNdotL * envColor;
    vec3 envDiffuse = fresnelEnv * envNdotL * (1.0 - metallic) * (1.0 - fresnelEnv);
    finalColor += envDiffuse + envSpecular;

    // Ambient Light
    vec3 ambient = vec3(0.1);
    finalColor += ambient * (1.0 - metallic);

    fragColor = vec4(finalColor, baseColor.a);
    //    fragColor = texture(TexturesArray, vec3(albedoUv, albedo_map.texture_layer));
    //    vec2 normalizedUv = fract(normalizedUv);
    //    vec2 uv = albedo_map.uv_scale * normalizedUv + albedo_map.uv_offset;
    //    vec2 subRegionEnd = albedo_map.uv_offset + vec2(2048, 2048) * albedo_map.uv_scale;
    //    uv = clamp(uv, albedo_map.uv_offset, subRegionEnd);
    //    fragColor = texture(TexturesArray, vec3(uv, albedo_map.texture_layer));
    //    fragColor = vec4(normalWorld, base_color.a);
}


vec3 calculateSpotlight(SpotLight spotlight, vec3 fragPosition, vec3 normal, vec3 viewDir, vec3 baseColor, float roughnessSquared, float metallic, vec3 F0) {
    // Compute the light direction
    vec3 lightDir = normalize(spotlight.position.xyz - fragPosition);

    // Compute the distance and attenuation
    float distance = length(spotlight.position.xyz - fragPosition);
    float attenuation = 1.0 / (spotlight.constantAtt +
    spotlight.linearAtt * distance +
    spotlight.quadraticAtt * distance * distance);

    // Compute the spotlight cone influence
    float theta = dot(lightDir, -normalize(spotlight.direction.xyz));
    if (theta < spotlight.outerCutoff) {
        // Skip lighting outside the cone
        return vec3(0.0);
    }

    float epsilon = spotlight.innerCutoff - spotlight.outerCutoff;
    float spotlightEffect = clamp((theta - spotlight.outerCutoff) / epsilon, 0.0, 1.0);

    // Fresnel term (Schlick approximation)
    vec3 halfwayDir = normalize(lightDir + viewDir);
    float NdotH = max(dot(normal, halfwayDir), EPSILON);
    vec3 fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotH, 5.0);

    // Normal Distribution Function (GGX)
    float NdotH2 = NdotH * NdotH;
    float alpha2 = roughnessSquared * roughnessSquared;
    float D = alpha2 / (PI * pow(NdotH2 * (alpha2 - 1.0) + 1.0, 2.0));

    // Geometry Function (Schlick-GGX)
    float NdotV = max(dot(normal, viewDir), EPSILON);
    float NdotL = max(dot(normal, lightDir), EPSILON);

    if (NdotL <= 0.0) {
        // Skip back-facing surfaces
        return vec3(0.0);
    }

    float k = roughnessSquared / 2.0;
    float Gv = NdotV / (NdotV * (1.0 - k) + k);
    float Gl = NdotL / (NdotL * (1.0 - k) + k);
    float G = Gv * Gl;

    // Specular term
    vec3 specular = (D * fresnel * G) / (4.0 * NdotV * NdotL + 0.001);

    // Diffuse term (Lambertian)
    vec3 diffuse = (1.0 - fresnel) * (1.0 - metallic) * baseColor;

    // Final radiance from spotlight
    vec3 radiance = spotlight.color.rgb * spotlight.intensity;
    return attenuation * spotlightEffect * radiance * (diffuse + specular) * NdotL;
}

/*
float DistributionGGX(vec3 N, vec3 H, float roughness);
vec3 FresnelSchlick(float cosTheta, vec3 F0);
float GeometrySchlickGGX(float NdotV, float roughness);
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness);
vec3 BRDF(vec3 N, vec3 V, vec3 L, vec3 albedo, float roughness, float metalness);


vec3 FresnelSchlick(float cosTheta, vec3 F0) {
    // Fresnel-Schlick approximation
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

float GeometrySchlickGGX(float NdotV, float roughness) {
    float k = (roughness * roughness) / 2.0;
    return NdotV / (NdotV * (1.0 - k) + k);
}

float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggxV = GeometrySchlickGGX(NdotV, roughness);
    float ggxL = GeometrySchlickGGX(NdotL, roughness);
    return ggxV * ggxL;
}

vec3 BRDF(vec3 N, vec3 V, vec3 L, vec3 albedo, float roughness, float metalness) {
    vec3 H = normalize(V + L);
    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    float NdotH = max(dot(N, H), 0.0);
    float HdotV = max(dot(H, V), 0.0);

    // Fresnel term
    vec3 F0 = mix(vec3(0.04), albedo, metalness); // Dielectric or metallic base reflectance
    vec3 F = FresnelSchlick(HdotV, F0);

    // Geometry term
    float G = GeometrySmith(N, V, L, roughness);

    // Distribution term
    float D = DistributionGGX(N, H, roughness);

    // Specular reflection
    vec3 numerator = D * G * F;
    float denominator = 4.0 * NdotV * NdotL + 0.001; // Avoid division by zero
    vec3 specular = numerator / denominator;

    // Diffuse reflection (Lambertian)
    vec3 kS = F; // Specular reflectance
    vec3 kD = vec3(1.0) - kS; // Diffuse reflectance
    kD *= 1.0 - metalness; // No diffuse for metals

    vec3 diffuse = kD * albedo / PI;

    // Combine contributions
    return (diffuse + specular) * NdotL;
}
*/
