const MAX_DIRECTIONAL_LIGHTS = 2;
const MAX_POINT_LIGHTS = 4;
const MAX_SPOT_LIGHTS = 4;
const MAX_SHADOW_CASTING_LIGHTS = 1;

const EPSILON = 0.001;

const PI = radians(180.0);
const TAU = radians(360.0);

struct Camera {
    projectionViewMatrix: mat4x4<f32>,                                    // 64 bytes
    projectionMatrix: mat4x4<f32>,                                        // 64 bytes
    viewMatrix: mat4x4<f32>,                                              // 64 bytes
    lightProjectionView: array<mat4x4<f32>, MAX_SHADOW_CASTING_LIGHTS>,   // 128 bytes
    position: vec4<f32>,                                                  // 16 bytes
    forward: vec4<f32>,                                                   // 16 bytes
    up: vec4<f32>,                                                        // 16 bytes
    nearFarFovAspect: vec4<f32>,                                          // 16 bytes
}

struct Light {
    directionalLights: array<DirectionalLight, MAX_DIRECTIONAL_LIGHTS>,
    pointLights: array<PointLight, MAX_POINT_LIGHTS>,
    spotLights: array<Spotlight, MAX_SPOT_LIGHTS>,
    numDirectionalLights: u32,
    numPointLights: u32,
    numSpotLights: u32,
    _padding: u32,
}

struct Time {
    deltaTime: f32,
    timePassed: f32,
    _padding: vec2<f32>,
}


struct TextureMap {
    uv_offset: vec2<f32>,
    uv_scale: vec2<f32>,
    texture_layer: u32,
}

struct PBRMaterial {
    @align(32) albedo_map: TextureMap,
    @align(32) normal_map: TextureMap,
    @align(32) metallic_map: TextureMap,
    base_color: vec4<f32>,
    metallicRoughnessFactor: vec2<f32>,
};

struct PointLight {
    position: vec4<f32>,
    color: vec4<f32>,
    intensity: f32,
    constantAtt: f32,
    linearAtt: f32,
    quadraticAtt: f32,
};

struct Spotlight {
    position: vec4<f32>,
    direction: vec4<f32>,
    color: vec4<f32>,
    innerCutoff: f32,
    outerCutoff: f32,
    intensity: f32,
    constantAtt: f32,
    linearAtt: f32,
    quadraticAtt: f32,
     // Padding: vec2<f32> (to align to 16 bytes boundary for next Spotlight)
};

struct DirectionalLight {
    direction: vec4<f32>,
    color: vec4<f32>,
    intensity: f32,
};

struct FragmentInput {
    @location(0) fragPosition: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) textureCoord: vec2<f32>,
    @location(3) tangent: vec3<f32>,
    @location(4) bitangent: vec3<f32>,
//    @location(5) shadowPos: vec4<f32>,
//    @interpolate(flat) @location(6) instanceID: u32,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> light: Light;
@group(0) @binding(2) var<uniform> time: Time;

@group(0) @binding(3) var globalTextures: texture_2d_array<f32>;
@group(0) @binding(4) var globalSampler: sampler;
@group(0) @binding(5) var envMap: texture_cube<f32>;
@group(0) @binding(6) var envSampler: sampler;

@group(0) @binding(7) var shadowMap: texture_depth_2d_array;
@group(0) @binding(8) var shadowSampler: sampler_comparison;

@group(1) @binding(0) var<uniform> material: PBRMaterial;

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    var normalizedUv = fract(input.textureCoord);
//    normalizedUv.y = 1.0 - normalizedUv.y;
    
    let uv = material.albedo_map.uv_scale * normalizedUv + material.albedo_map.uv_offset;
    let baseColor = textureSample(globalTextures, globalSampler, uv, material.albedo_map.texture_layer) * material.base_color;

    // TODO: Hard coded alpha mask, by default enabled for all
    if (baseColor.a <= 0.5) {
        discard;
    }

    // --- Metallic and Roughness ---
    let metallicRoughtnessUv = material.metallic_map.uv_scale * normalizedUv + material.metallic_map.uv_offset;
    let metallicRoughness = textureSample(globalTextures, globalSampler, metallicRoughtnessUv, material.metallic_map.texture_layer).rgb;
    let metallic = metallicRoughness.b * material.metallicRoughnessFactor.x;
    let roughness = metallicRoughness.g * material.metallicRoughnessFactor.y;

    // --- Normal Mapping ---
    let TBN: mat3x3<f32> = mat3x3<f32>(input.tangent, input.bitangent, input.normal);
    let normalUv = material.normal_map.uv_scale * normalizedUv + material.normal_map.uv_offset ;
    var normalTangent = textureSample(globalTextures, globalSampler, normalUv, material.normal_map.texture_layer).rgb;
    normalTangent = normalize(normalTangent * 2.0 - 1.0);
    let normalWorld: vec3<f32> = normalize(TBN * normalTangent);

    // --- View Direction ---
    let viewDir: vec3<f32> = normalize(camera.position.xyz - input.fragPosition);
    let reflectedDir = reflect(-viewDir, normalWorld);
    let envColor = textureSample(envMap, envSampler, reflectedDir).rgb;

    // Fresnel Reflectance at Normal Incidence
    let F0 = mix(vec3<f32>(0.04), baseColor.rgb, metallic);
    let roughnessSquared = roughness * roughness;
    let envNdotL = max(dot(normalWorld, reflectedDir), EPSILON);
    let envNdotV = max(dot(normalWorld, viewDir), EPSILON);
    let fresnelEnv = F0 + (1.0 - F0) * pow(1.0 - envNdotV, 5.0);

    var finalColor: vec3<f32> = vec3<f32>(0.0);

    var size = f32(textureDimensions(shadowMap).x);
    var oneOverSize = 1.0 / size;
    var shadowFactor = 0.0;
    for (var i = 0u; i < MAX_SHADOW_CASTING_LIGHTS; i++) {
        let lightSpacePosition = camera.lightProjectionView[i] *  vec4<f32>(input.fragPosition, 1.0);
        let lightNDC = lightSpacePosition.xyz / lightSpacePosition.w;
        let shadowCoord = (vec2<f32>(lightNDC.x, -lightNDC.y) + vec2<f32>(1.0)) * 0.5;
        let shadowDepth = lightNDC.z;

        for (var dx = -1; dx <= 1; dx++) {
            for (var dy = -1; dy <= 1; dy++) {
                let offset = vec2<f32>(f32(dx) * oneOverSize, f32(dy) * oneOverSize);
                let clampedShadowCoord = clamp(shadowCoord + offset, vec2<f32>(0.0), vec2<f32>(1.0));
                shadowFactor += textureSampleCompare(shadowMap, shadowSampler,
                 clampedShadowCoord, i, shadowDepth - 0.005);
            }
        }
    }
    shadowFactor /= (MAX_SHADOW_CASTING_LIGHTS * 9.0);
    
    // --- Spot Lights ---
    for (var i = 0u; i < light.numSpotLights; i = i + 1u) {
        let spotLight = light.spotLights[i];
        finalColor += calculateSpotlight(spotLight, input.fragPosition, normalWorld, viewDir, baseColor.rgb, roughnessSquared, metallic, F0, shadowFactor);
    }

    // --- Point Lights ---
    for (var i = 0u; i < light.numPointLights; i = i + 1u) {
        let pointLight = light.pointLights[i];

        // Light direction and distance
        let lightDir = normalize(pointLight.position.xyz - input.fragPosition);
        let distance = length(pointLight.position.xyz - input.fragPosition);

        // Attenuation
        let attenuation = 1.0 / (pointLight.constantAtt + pointLight.linearAtt * distance + pointLight.quadraticAtt * distance * distance);

        // Fresnel term (Schlick's approximation)
        let halfwayDir = normalize(lightDir + viewDir);
        let NdotH = max(dot(normalWorld, halfwayDir), EPSILON);
        let fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotH, 5.0);

        // Normal Distribution Function (NDF) - GGX
        let NdotH2 = NdotH * NdotH;
        let alpha2 = roughnessSquared * roughnessSquared;
        let D = alpha2 / (PI * pow(NdotH2 * (alpha2 - 1.0) + 1.0, 2.0));

        // Geometry Function (Schlick-GGX)
        let NdotV = max(dot(normalWorld, viewDir), EPSILON);
        let NdotL = max(dot(normalWorld, lightDir), EPSILON);
        let k = roughnessSquared / 2.0;
        let Gv = NdotV / (NdotV * (1.0 - k) + k);
        let Gl = NdotL / (NdotL * (1.0 - k) + k);
        let G = Gv * Gl;

        // Specular term
        let specular = (D * fresnel * G) / (4.0 * NdotV * NdotL + 0.001);

        // Diffuse term (Lambertian)
        let diffuse = (1.0 - fresnel) * (1.0 - metallic) * baseColor.rgb;

        // Combine light contributions
        let radiance = pointLight.color.rgb * pointLight.intensity;
        finalColor += attenuation * radiance * (diffuse + specular) * NdotL;
    }

    // --- Directional Lights ---
    for (var i = 0u; i < light.numDirectionalLights; i = i + 1u) {
        let dirLight = light.directionalLights[i];

        // Light direction
        let lightDir = normalize(-dirLight.direction.xyz);


        // Fresnel term (Schlick's approximation)
        let halfwayDir = normalize(lightDir + viewDir);
        let NdotH = max(dot(normalWorld, halfwayDir), EPSILON);
        let fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotH, 5.0);

        // Normal Distribution Function (NDF) - GGX
        let NdotH2 = NdotH * NdotH;
        let alpha2 = roughnessSquared * roughnessSquared;
        let D = alpha2 / (PI * pow(NdotH2 * (alpha2 - 1.0) + 1.0, 2.0));

        // Geometry Function (Schlick-GGX)
        let NdotV = max(dot(normalWorld, viewDir), EPSILON);
        let NdotL = max(dot(normalWorld, lightDir), EPSILON);
        let k = roughnessSquared / 2.0;
        let Gv = NdotV / (NdotV * (1.0 - k) + k);
        let Gl = NdotL / (NdotL * (1.0 - k) + k);
        let G = Gv * Gl;

        // Specular term
        let specular = (D * fresnel * G) / (4.0 * NdotV * NdotL + 0.001);

        // Diffuse term (Lambertian)
        let diffuse = (1.0 - fresnel) * (1.0 - metallic) * baseColor.rgb;

        let radiance = dirLight.color.rgb * dirLight.intensity;
        finalColor += radiance * (diffuse + specular) * NdotL;
    }

    // --- Environment Map Contributions ---
    let envSpecular = fresnelEnv * envNdotL * envColor;
    let envDiffuse = fresnelEnv * envNdotL  * (1.0 - metallic) * (1.0 - fresnelEnv);

    finalColor += envDiffuse + envSpecular;

    // Ambient Light
    let ambient = vec3<f32>(0.1);
    finalColor += ambient;
//    finalColor += ambient * (1.0 - metallic);
    
  

//      return baseColor;
      return vec4<f32>(finalColor, baseColor.a);
//      return vec4<f32>(normalWorld, baseColor.a);
}

fn calculateSpotlight(
    spotlight: Spotlight,
    fragPosition: vec3<f32>,
    normal: vec3<f32>,
    viewDir: vec3<f32>,
    baseColor: vec3<f32>,
    roughnessSquared: f32,
    metallic: f32,
    F0: vec3<f32>,
    shadowFactor: f32,
//    inverseViewMatrix: mat4x4<f32>, textureCoord: vec2<f32>, norm: vec3<f32>, pos: vec3<f32>
) -> vec3<f32> {
    // Compute the light direction
    let lightDir = normalize(spotlight.position.xyz - fragPosition);

    // Compute the spotlight cone influence
    let theta = dot(lightDir, -normalize(spotlight.direction.xyz));
    if (theta < spotlight.outerCutoff) {
        // outside the cone
        return vec3<f32>(0.0, 0.0, 0.0);
    }

    // Compute the distance and attenuation
    let distance = length(spotlight.position.xyz - fragPosition);
    let attenuation = 1.0 / dot(
                vec3<f32>(1.0, distance, distance * distance),
                vec3<f32>(spotlight.constantAtt, spotlight.linearAtt, spotlight.quadraticAtt));
//    let attenuation = 1.0 / (spotlight.constantAtt +
//                             spotlight.linearAtt * distance +
//                             spotlight.quadraticAtt * distance * distance);

    let epsilon = spotlight.innerCutoff - spotlight.outerCutoff;
    let spotlightEffect = clamp((theta - spotlight.outerCutoff) / epsilon, 0.0, 1.0);

    // Fresnel term (Schlick approximation)
    let halfwayDir = normalize(lightDir + viewDir);
    let NdotH = max(dot(normal, halfwayDir), EPSILON);
    let fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotH, 5.0);

    // Normal Distribution Function (GGX)
    let NdotH2 = NdotH * NdotH;
    let alpha2 = roughnessSquared * roughnessSquared;
    let D = alpha2 / (PI * pow(NdotH2 * (alpha2 - 1.0) + 1.0, 2.0));

    // Geometry Function (Schlick-GGX)
    let NdotV = max(dot(normal, viewDir), EPSILON);
    let NdotL = max(dot(normal, lightDir), EPSILON);
    if (NdotL <= EPSILON) {
        return vec3<f32>(0.0); // Skip back-facing surfaces
    }

    let k = roughnessSquared / 2.0;
    let Gv = NdotV / (NdotV * (1.0 - k) + k);
    let Gl = NdotL / (NdotL * (1.0 - k) + k);
    let G = Gv * Gl;

    // Specular term
    let specular = (D * fresnel * G) / (4.0 * NdotV * NdotL + 0.001);

    // Diffuse term (Lambertian)
    let diffuse = (1.0 - fresnel) * (1.0 - metallic) * baseColor;

    // Final radiance from spotlight
    let radiance = spotlight.color.rgb * spotlight.intensity * shadowFactor;

    return attenuation * spotlightEffect * radiance * (diffuse + specular) * NdotL;
}

//    let lightSpacePosition = camera.lightProjectionView[0] *  vec4<f32>(input.fragPosition, 1.0);
//    let lightNDC = lightSpacePosition.xyz / lightSpacePosition.w;
//    let shadowCoord = (lightNDC.xy + vec2<f32>(1.0)) * 0.5;
//    let texelCoords = vec2<i32>(shadowCoord * vec2(1024.0, 1024.0));
//    let depth = textureLoad(shadowMap, texelCoords, 0, 0);
//    return vec4<f32>(vec3<f32>(depth), 1.0);



/*
// OLD SPOTLIGHT FN
fn calculateSpotlight(
    spotlight: Spotlight,
    fragPosition: vec3<f32>,
    normal: vec3<f32>,
    viewDir: vec3<f32>,
    baseColor: vec3<f32>,
    roughnessSquared: f32,
    metallic: f32,
    F0: vec3<f32>,
    shadowFactor: f32,
) -> vec3<f32> {
    // Compute the light direction
    let lightDir = normalize(spotlight.position.xyz - fragPosition);

    // Compute the distance and attenuation
    let distance = length(spotlight.position.xyz - fragPosition);
    let attenuation = 1.0 / (spotlight.constantAtt +
                             spotlight.linearAtt * distance +
                             spotlight.quadraticAtt * distance * distance);

    // Compute the spotlight cone influence
    let theta = dot(lightDir, -normalize(spotlight.direction.xyz));
    if (theta < spotlight.outerCutoff) {
        return vec3<f32>(0.0); // Skip lighting outside the cone
    }
    let epsilon = spotlight.innerCutoff - spotlight.outerCutoff;
    let spotlightEffect = clamp((theta - spotlight.outerCutoff) / epsilon, 0.0, 1.0);

    // Fresnel term (Schlick approximation)
    let halfwayDir = normalize(lightDir + viewDir);
    let NdotH = max(dot(normal, halfwayDir), EPSILON);
    let fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotH, 5.0);

    // Normal Distribution Function (GGX)
    let NdotH2 = NdotH * NdotH;
    let alpha2 = roughnessSquared * roughnessSquared;
    let D = alpha2 / (PI * pow(NdotH2 * (alpha2 - 1.0) + 1.0, 2.0));

    // Geometry Function (Schlick-GGX)
    let NdotV = max(dot(normal, viewDir), EPSILON);
    let NdotL = max(dot(normal, lightDir), EPSILON);

    if (NdotL <= EPSILON) {
        return vec3<f32>(0.0); // Skip back-facing surfaces
    }

    let k = roughnessSquared / 2.0;
    let Gv = NdotV / (NdotV * (1.0 - k) + k);
    let Gl = NdotL / (NdotL * (1.0 - k) + k);
    let G = Gv * Gl;

    // Specular term
    let specular = (D * fresnel * G) / (4.0 * NdotV * NdotL + 0.001);

    // Diffuse term (Lambertian)
    let diffuse = (1.0 - fresnel) * (1.0 - metallic) * baseColor;

    // Final radiance from spotlight
    let radiance = spotlight.color.rgb * spotlight.intensity * shadowFactor;
    return attenuation * spotlightEffect * radiance * (diffuse + specular) * NdotL;
}*/
