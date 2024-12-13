const MAX_DIRECTIONAL_LIGHTS = 2;
const MAX_POINT_LIGHTS = 4;

const PI = radians(180.0);
const TAU = radians(360.0);

struct Camera {
    projectionViewMatrix: mat4x4<f32>,
    position: vec4<f32>, // The eye of the camera
}

struct Light {
    directionalLights: array<DirectionalLight, MAX_DIRECTIONAL_LIGHTS>,
    pointLights: array<PointLight, MAX_POINT_LIGHTS>,
    numDirectionalLights: u32,
    numPointLights: u32,
    _padding: vec2<f32>,
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
    @align(32) base_color: vec4<f32>,
};

struct PointLight {
    position: vec4<f32>,
    color: vec4<f32>,
    intensity: f32,
    constantAtt: f32,  // Constant attenuation
    linearAtt: f32,    // Linear attenuation
    quadraticAtt: f32, // Quadratic attenuation
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
    @interpolate(flat) @location(5) instanceID: u32,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> light: Light;
@group(0) @binding(2) var<uniform> time: Time;
@group(0) @binding(3) var globalTextures: texture_2d_array<f32>;
@group(0) @binding(4) var globalSampler: sampler;
@group(0) @binding(5) var envMap: texture_cube<f32>;
@group(0) @binding(6) var envSampler: sampler;


@group(1) @binding(0) var<uniform> material: PBRMaterial;

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    let uv = material.albedo_map.uv_scale * input.textureCoord + material.albedo_map.uv_offset;
    let baseColor = textureSample(globalTextures, globalSampler, uv, material.albedo_map.texture_layer) * material.base_color;

    // TODO: Hard coded alpha mask, by default enabled for all
    if (baseColor.a <= 0.5) {
        discard;
    }

    // --- Metallic and Roughness ---
    let metallicRoughtnessUv = material.metallic_map.uv_scale * input.textureCoord + material.metallic_map.uv_offset;
    let metallicRoughness = textureSample(globalTextures, globalSampler, metallicRoughtnessUv, material.metallic_map.texture_layer).rgb;
//    let metallic = 1.0;
//    let roughness = 0.3;
    let metallic = min(0.4, metallicRoughness.b);
    let roughness = max(0.2, metallicRoughness.g);

    // --- Normal Mapping ---
    let TBN: mat3x3<f32> = mat3x3<f32>(input.tangent, input.bitangent, input.normal);
    let normalUv = material.normal_map.uv_scale * input.textureCoord + material.normal_map.uv_offset ;
    var normalTangent = textureSample(globalTextures, globalSampler, normalUv, material.normal_map.texture_layer).rgb;
    normalTangent = normalize(normalTangent * 2.0 - 1.0);
    let normalWorld: vec3<f32> = normalize(TBN * normalTangent);

    // --- View Direction ---
//    let blendedNormal = normalize(mix(input.normal, normalWorld, 0.2));
    let viewDir: vec3<f32> = normalize(camera.position.xyz - input.fragPosition);
//    let reflectedDir = reflect(-viewDir, normalWorld);
    let reflectedDir = reflect(-viewDir, normalize(input.normal));
    let envColor = textureSample(envMap, envSampler, reflectedDir).rgb;

    // Fresnel Reflectance at Normal Incidence
    let F0 = mix(vec3<f32>(0.04), baseColor.rgb, metallic);
    let roughnessSquared = roughness * roughness;
    let envNdotL = max(dot(normalWorld, reflectedDir), 0.1);
    let envNdotV = max(dot(normalWorld, viewDir), 0.1);
    let fresnelEnv = F0 + (1.0 - F0) * pow(1.0 - envNdotV, 5.0);

    var finalColor: vec3<f32> = vec3<f32>(0.0);
    // --- Point Lights ---
    for (var i = 0u; i < light.numPointLights; i = i + 1u) {
        let light = light.pointLights[i];

        // Light direction and distance
        let lightDir = normalize(light.position.xyz - input.fragPosition);
        let distance = length(light.position.xyz - input.fragPosition);

        // Attenuation
        let attenuation = 1.0 / (light.constantAtt + light.linearAtt * distance + light.quadraticAtt * distance * distance);

        // Fresnel term (Schlick's approximation)
        let halfwayDir = normalize(lightDir + viewDir);
        let NdotH = max(dot(normalWorld, halfwayDir), 0.0);
        let fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotH, 5.0);

        // Normal Distribution Function (NDF) - GGX
        let NdotH2 = NdotH * NdotH;
        let alpha2 = roughnessSquared * roughnessSquared;
        let D = alpha2 / (PI * pow(NdotH2 * (alpha2 - 1.0) + 1.0, 2.0));

        // Geometry Function (Schlick-GGX)
        let NdotV = max(dot(normalWorld, viewDir), 0.1);
        let NdotL = max(dot(normalWorld, lightDir), 0.1);
        let k = roughnessSquared / 2.0;
        let Gv = NdotV / (NdotV * (1.0 - k) + k);
        let Gl = NdotL / (NdotL * (1.0 - k) + k);
        let G = Gv * Gl;

        // Specular term
        let specular = (D * fresnel * G) / (4.0 * NdotV * NdotL);
//        let specular = (D * fresnel * G) / (4.0 * NdotV * NdotL + 0.001);

        // Diffuse term (Lambertian)
        let diffuse = (1.0 - fresnel) * (1.0 - metallic) * baseColor.rgb;
//        let diffuse = max((1.0 - fresnel) * (1.0 - metallic), 0.0) * baseColor.rgb;

        // Combine light contributions
        let radiance = light.color.rgb * light.intensity;
        finalColor += attenuation * radiance * (diffuse + specular) * NdotL;
    }

    // --- Directional Lights ---
    for (var i = 0u; i < light.numDirectionalLights; i = i + 1u) {
        let dirLight = light.directionalLights[i];

        // Light direction
        let lightDir = normalize(-dirLight.direction.xyz);


        // Fresnel term (Schlick's approximation)
        let halfwayDir = normalize(lightDir + viewDir);
        let NdotH = max(dot(normalWorld, halfwayDir), 0.0);
        let fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotH, 5.0);

        // Normal Distribution Function (NDF) - GGX
        let NdotH2 = NdotH * NdotH;
        let alpha2 = roughnessSquared * roughnessSquared;
        let D = alpha2 / (PI * pow(NdotH2 * (alpha2 - 1.0) + 1.0, 2.0));

        // Geometry Function (Schlick-GGX)
        let NdotV = max(dot(normalWorld, viewDir), 0.1);
        let NdotL = max(dot(normalWorld, lightDir), 0.1);
        let k = roughnessSquared / 2.0;
        let Gv = NdotV / (NdotV * (1.0 - k) + k);
        let Gl = NdotL / (NdotL * (1.0 - k) + k);
        let G = Gv * Gl;

        // Specular term
        let specular = (D * fresnel * G) / (4.0 * NdotV * NdotL + 0.001);

        // Diffuse term (Lambertian)
        let diffuse = (1.0 - fresnel) * (1.0 - metallic) * baseColor.rgb;
//        let diffuse = max((1.0 - fresnel) * (1.0 - metallic), 0.0) * baseColor.rgb;

        let radiance = dirLight.color.rgb * dirLight.intensity;
        finalColor += radiance * (diffuse + specular) * NdotL;
    }

    // --- Environment Map Contributions ---
    let envSpecular = fresnelEnv /** envNdotL*/ * envColor;
    let envDiffuse = fresnelEnv /** envNdotL*/  * (1.0 - metallic) * (1.0 - fresnelEnv);

    finalColor += envDiffuse + envSpecular;

    // Ambient Light
    let ambient = vec3<f32>(0.1); // Fixed ambient term
    finalColor += ambient * (1.0 - metallic);
//    finalColor += ambient;

//    return vec4<f32>(textureSample(globalTextures, globalSampler, vec2(0.0, 0.0), 0).rgb, 1.0);
//    return vec4<f32>(textureSample(globalTextures, globalSampler, input.textureCoord, 10).rgb, 1.0);

      return vec4<f32>(finalColor, baseColor.a);
}


// OLD
/*
const MAX_DIRECTIONAL_LIGHTS = 2;
const MAX_POINT_LIGHTS = 4;

struct Camera {
    projectionViewMatrix: mat4x4<f32>,
    position: vec4<f32>, // The eye of the camera
}

struct Light {
    directionalLights: array<DirectionalLight, MAX_DIRECTIONAL_LIGHTS>,
    pointLights: array<PointLight, MAX_POINT_LIGHTS>,
    numDirectionalLights: u32,
    numPointLights: u32,
    _padding: vec2<f32>,
}

struct Time {
    deltaTime: f32,
    timePassed: f32,
    _padding: vec2<f32>,
}

struct PBRMaterial {
    albedo_map: i32,       // Index for albedo texture in the texture array
    normal_map: i32,       // Index for normal map in the texture array
    metallic_map: i32,     // Index for metallic texture in the texture array
    roughness_map: i32,    // Index for roughness texture in the texture array
    uv_offset: vec2<f32>,  // UV offset for texture mapping
    uv_scale: vec2<f32>,   // UV scale for texture mapping
};

struct PointLight {
    position: vec4<f32>,
    color: vec4<f32>,
    intensity: f32,
    constantAtt: f32,  // Constant attenuation
    linearAtt: f32,    // Linear attenuation
    quadraticAtt: f32, // Quadratic attenuation
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
    @interpolate(flat) @location(5) instanceID: u32,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> light: Light;
@group(0) @binding(2) var<uniform> time: Time;
@group(0) @binding(3) var globalTextures: texture_2d_array<f32>;
@group(0) @binding(4) var globalSampler: sampler;


@group(1) @binding(0) var<uniform> material: PBRMaterial;

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    let albedo = textureSample(globalTextures, globalSampler, input.textureCoord, material.albedo_map).rgb;
    let TBN: mat3x3<f32> = mat3x3<f32>(input.tangent, input.bitangent, input.normal);
    var normalTangent = textureSample(globalTextures, globalSampler, input.textureCoord, material.normal_map).rgb;
    normalTangent = normalize(normalTangent * 2.0 - 1.0);
    let normalWorld: vec3<f32> = normalize(TBN * normalTangent);
    let viewDir: vec3<f32> = normalize(camera.position.xyz - input.fragPosition);


    var finalColor: vec3<f32> = vec3<f32>(0.0);
    var testColor: vec3<f32> = vec3<f32>(0.0);
    // --- Point Lights ---
    for (var i = 0u; i < light.numPointLights; i = i + 1u) {
        let light = light.pointLights[i];

        // Light direction and distance
        let lightDir = normalize(light.position.xyz - input.fragPosition);
        let distance = length(light.position.xyz - input.fragPosition);

        // Attenuation
        let attenuation = 1.0 / (light.constantAtt + light.linearAtt * distance + light.quadraticAtt * distance * distance);

        // Diffuse
        let diff = max(dot(normalWorld, lightDir), 0.0);
        let diffuse = diff * light.color.rgb * albedo.rgb * light.intensity;

        // Specular shading (Blinn-Phong)
        let halfwayDir: vec3<f32> = normalize(lightDir + viewDir);
        let spec: f32 = pow(max(dot(normalWorld, halfwayDir), 0.0), 32.0); // Shininess factor
        let specular: vec3<f32> = spec * light.color.rgb;

        // Combine and add to final color
        finalColor += attenuation * (diffuse + specular);
    }

    // --- Directional Lights ---
    for (var i = 0u; i < light.numDirectionalLights; i = i + 1u) {
        let dirLight = light.directionalLights[i];

        // Light direction
        let lightDir = normalize(-dirLight.direction.xyz);

        // Diffuse
        let diff = max(dot(normalWorld, lightDir), 0.0);
        let diffuse = diff * dirLight.color.rgb * albedo.rgb * dirLight.intensity;

        // Specular
        let reflectDir = reflect(-lightDir, normalWorld);
        let spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0); // Shininess = 32
        let specular = spec * dirLight.color.rgb * dirLight.intensity * 15.0;

        finalColor += diffuse + specular;
        testColor += specular;
    }

    // Ambient Light
    let ambient = vec3<f32>(0.1); // Fixed ambient term
    finalColor += ambient;

//    return vec4<f32>(light.pointLights[0].color.rgb, 1.0);
//    return vec4<f32>(light.directionalLights[0].color.rgb, 1.0);
//    return vec4<f32>(clamp(f32(light.numDirectionalLights) / f32(MAX_DIRECTIONAL_LIGHTS), 0.0, 1.0), clamp(f32(light.numPointLights) / f32(MAX_POINT_LIGHTS), 0.0, 1.0), 0.0, 1.0);
    return vec4<f32>(finalColor, 1.0);
//    return vec4<f32>(viewDir, 1.0);
}
*/