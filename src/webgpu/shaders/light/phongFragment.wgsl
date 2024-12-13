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

struct Material {
    ambientLight: vec4<f32>,
    diffuseLight: vec4<f32>,
    specularLight: vec4<f32>,
    shininess: f32,
//    shininess: vec4<f32>,
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
//    _padding: vec4<f32>
};


struct FragmentInput {
    @location(0) fragPosition: vec3<f32>,
    @location(1) surfaceNormal: vec3<f32>,
    @location(2) textureCoord: vec2<f32>,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> light: Light;
@group(0) @binding(2) var<uniform> time: Time;
@group(0) @binding(3) var globalTextures: texture_2d_array<f32>;
@group(0) @binding(4) var globalSampler: sampler;

@group(1) @binding(0) var<uniform> material: Material;

const LIGHT_AMBIENT = vec4<f32>(0.2, 0.2, 0.2, 1.0);
const LIGHT_DIFFUSE = vec4<f32>(1.0, 1.0, 1.0, 1.0);
const LIGHT_SPECULAR = vec4<f32>(0.0, 0.0, 1.0, 1.0);
@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {

//    return vec4<f32>(1.0, 0.0, 0.0, 1.0);

    let uShininess = 32.0;
    let uAmbientColor = material.ambientLight.rgb;

    let viewDir: vec3<f32> = normalize(camera.position.xyz - input.fragPosition);
    let normal = normalize(input.surfaceNormal);
//    let texColor = vec4<f32>(1.0, 0.0, 0.0, 1.0);
    let texColor = textureSample(globalTextures, globalSampler, input.textureCoord, 1);
    let pixelColor = mix(material.diffuseLight.rgb, texColor.rgb, texColor.a);
    var finalColor: vec3<f32> = vec3<f32>(0.0);
    // --- Point Lights ---
    for (var i = 0u; i < light.numPointLights; i = i + 1u) {
        let light = light.pointLights[i];

        let lightDir = normalize(light.position.xyz - input.fragPosition);
        let distance = length(light.position.xyz - input.fragPosition);

        let attenuation = 1.0 / (light.constantAtt + light.linearAtt * distance + light.quadraticAtt * distance * distance);

        let diff = max(dot(normal, lightDir), 0.0);
        let diffuse = diff * light.color.rgb * pixelColor * light.intensity;

        let halfwayDir: vec3<f32> = normalize(lightDir + viewDir);
        let spec: f32 = pow(max(dot(normal, halfwayDir), 0.0), uShininess); // Shininess factor
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
        let diff = max(dot(normal, lightDir), 0.0);
        let diffuse = diff * dirLight.color.rgb * pixelColor * dirLight.intensity;

        // Specular
        let reflectDir = reflect(-lightDir, normal);
        let spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0); // Shininess = 32
        let specular = spec * dirLight.color.rgb * dirLight.intensity;

        // Combine and add to final color
        finalColor += diffuse + specular;
    }


    return vec4(finalColor, 1.0);

}

//
//let uLightPos = light.lightDirection.xyz;
//    let uLightColor = light.lightColor.rgb;
//
//
//    let normal = normalize(input.surfaceNormal);
//    let lightDir = normalize(uLightPos - input.fragPosition);
//    let viewDir = normalize(uViewPos - input.fragPosition);
//// How to get offset from texture
////    let atlasUV = inTexCoords * uniforms.uvScale + uniforms.uvOffset;
//    let texColor = textureSample(globalTextures, globalSampler, input.textureCoord, 2);
////    let texColor = textureSample(textures, uSampler, input.textureCoord * vec2(5, 5), 1);
//    let pixelColor = mix(material.diffuseLight.rgb, texColor.rgb, texColor.a);
////    let pixelColor = material.diffuseLight.rgb;
////    let texColor = textureSample(texture, samler, input.textureCoord);
//
//    // Ambient component
//    let ambient = uAmbientColor * pixelColor;
//    let diff = max(dot(normal, lightDir), 0.0);
//    let diffuse = diff * uLightColor * pixelColor; // remove diffuse if working with texture
//
//    // Specular component (Phong)
//    let reflectDir = reflect(-lightDir, normal);  // Reflect light direction around the normal
//    let spec = pow(max(dot(viewDir, reflectDir), 0.0), uShininess);
//    let specular = spec * uLightColor * material.specularLight.xyz;
//
//    let result = ambient + diffuse + specular;
