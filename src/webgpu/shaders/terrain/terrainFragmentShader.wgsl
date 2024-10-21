struct Material {
    ambientLight: vec4<f32>,
    diffuseLight: vec4<f32>,
    specularLight: vec4<f32>,
    shininess: f32,
    maxHeight: f32,
    minHeight: f32,
    seaLevel: f32,
};

struct Light {
    lightDirection: vec4<f32>,
    lightColor: vec4<f32>,
    uViewPosition: vec4<f32>, // The eye of the camera
}

struct FragmentInput {
    @location(0) fragPosition: vec3<f32>,
    @location(1) fragNormal: vec3<f32>,
    @location(2) textureCoord: vec2<f32>,
}

@group(1) @binding(0) var<uniform> material: Material;
@group(1) @binding(1) var<uniform> light: Light;

@group(1) @binding(2) var grass1T: texture_2d<f32>;
@group(1) @binding(3) var grass1S: sampler;
@group(1) @binding(4) var mountain1T: texture_2d<f32>;
@group(1) @binding(5) var mountain1S: sampler;
@group(1) @binding(6) var snow1T: texture_2d<f32>;
@group(1) @binding(7) var snow1S: sampler;
@group(1) @binding(8) var water1T: texture_2d<f32>;
@group(1) @binding(9) var water1S: sampler;


@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    let heightFactor = (input.fragPosition.y - material.minHeight) / (material.maxHeight - material.minHeight);
    let slopeFactor = 1.0 - dot(normalize(input.fragNormal), vec3(0.0, 1.0, 0.0));  // 0 = flat, 1 = steep

    const grassThreshold = 0.50;
    const rockThreshold = 0.85;

    var refractedTexCoords = input.textureCoord;
    refractedTexCoords += (refractedTexCoords - 0.5) * 0.02;
    var seaColor = textureSample(water1T, water1S, input.textureCoord);
    let grassColor = textureSample(grass1T, grass1S, input.textureCoord);
    let rockColor = textureSample(mountain1T, mountain1S, input.textureCoord);
    let refractedRockColor = textureSample(mountain1T, mountain1S, refractedTexCoords);
    let snowColor = textureSample(snow1T,snow1S, input.textureCoord);

    var textureColor = vec4(0.0, 0.0, 0.0, 0.0);
    if (heightFactor < 0.5) {
        let blendFactor = (heightFactor - grassThreshold) / (rockThreshold - grassThreshold);
        textureColor = mix(grassColor, rockColor, heightFactor * 2.0); // heightFactor * 2.0
    } else {
        textureColor = mix(rockColor, snowColor, (heightFactor - 0.5) * 2.0); // Blend between texture2 and texture3
    }

//    if (heightFactor < material.seaLevel && false) {
//        // RIPPLES
//        //        waterTexCoords.x += sin(uTime + vFragPosition.x * 0.1) * 0.01;
//        //        waterTexCoords.y += cos(uTime + vFragPosition.z * 0.1) * 0.01;
//
//        seaColor.a = 0.5;
//
//        textureColor = mix(refractedRockColor, seaColor, 0.5);
//    } else if (heightFactor < grassThreshold) {
//        textureColor = grassColor;
//    } else if (heightFactor < rockThreshold) {
//        let blendFactor = (heightFactor - grassThreshold) / (rockThreshold - grassThreshold);
//        textureColor = mix(grassColor, rockColor, blendFactor);
//    } else {
//        let blendFactor = (heightFactor - rockThreshold) / (1.0 - rockThreshold);
//        textureColor = mix(rockColor, snowColor, blendFactor);
//    }

    return textureColor;

//    let uShininess = 10.0;
//    let uLightPos = light.lightDirection.xyz;
//    let uViewPos = light.uViewPosition.xyz;
//    let uAmbientColor = material.ambientLight.rgb;
//    let uLightColor = light.lightColor.rgb;
//
//    let normal = normalize(input.fragNormal);
//    let lightDir = normalize(uLightPos - input.fragPosition);
//    let viewDir = normalize(uViewPos - input.fragPosition);
//
//    let pixelColor = textureColor.rgb;
////    let pixelColor = mix(material.diffuseLight.rgb, textureColor.rgb, textureColor.a);
//
//    // Ambient component
//    let ambient = uAmbientColor * pixelColor;
//
//    // Diffuse component (Lambertian)
//    let diff = max(dot(normal, lightDir), 0.0);
//    let diffuse = diff * uLightColor * pixelColor; // remove diffuse if working with texture
//
//    // Specular component (Phong)
//    let reflectDir = reflect(-lightDir, normal);  // Reflect light direction around the normal
//    let spec = pow(max(dot(viewDir, reflectDir), 0.0), uShininess);
//    let specular = spec * uLightColor * material.specularLight.xyz;
//
//    let result = ambient + diffuse + specular;
//    return vec4(result, 1.0);
}