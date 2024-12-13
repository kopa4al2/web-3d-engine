struct Global {
    projectionViewMatrix: mat4x4<f32>,
    uViewPosition: vec4<f32>, // The eye of the camera
    lightDirection: vec4<f32>,
    lightColor: vec4<f32>,
}

struct Material {
    ambientLight: vec4<f32>,
    diffuseLight: vec4<f32>,
    specularLight: vec4<f32>,
    shininess: f32,
    maxHeight: f32,
    minHeight: f32,
    seaLevel: f32,
};

struct FragmentInput {
    @location(0) fragPosition: vec3<f32>,
    @location(1) fragNormal: vec3<f32>,
    @location(2) textureCoord: vec2<f32>,
}

@group(0) @binding(0) var <uniform> light: Global;
@group(0) @binding(1) var textures: texture_2d_array<f32>;
@group(0) @binding(2) var uSampler: sampler;

@group(1) @binding(0) var<uniform> material: Material;


@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    let grassOffset = vec2(0.0, 0.0);            // Grass at (0,0) to (512,512)
    let rockOffset = vec2(0.0, 0.5);             // Rock at (0,512) to (512,1024)
    let snowOffset = vec2(0.5, 0.0);             // Snow at (512,0) to (1024,512)
    let waterOffset = vec2(0.5, 0.5);            // Water at (512,512) to (1024,1024)

    // downscale the coordinates to take 1/4 of the 1024x1024 texture
    let atlasScale = vec2(0.5, 0.5);

    let heightFactor = (input.fragPosition.y - material.minHeight) / (material.maxHeight - material.minHeight);
    let slopeFactor = 1.0 - dot(normalize(input.fragNormal), vec3(0.0, 1.0, 0.0));  // 0 = flat, 1 = steep

    const grassThreshold = 0.60;
    const rockThreshold = 0.75;
    const snowThreshold = 0.85;

    var refractedTexCoords = input.textureCoord;
    refractedTexCoords += (refractedTexCoords - 0.5) * 0.02;
    var seaColor = textureSample(textures, uSampler, input.textureCoord * atlasScale + waterOffset, i32(0));
    let grassColor = textureSample(textures, uSampler, input.textureCoord * atlasScale + grassOffset, i32(0));
    let rockColor = textureSample(textures, uSampler, input.textureCoord * atlasScale + rockOffset, 0);
    let refractedRockColor = textureSample(textures, uSampler, input.textureCoord * atlasScale + rockOffset, 1);
    let snowColor = textureSample(textures, uSampler, input.textureCoord * atlasScale + snowOffset, 1);

    var textureColor = vec4(0.0, 0.0, 0.0, 0.0);
    if (heightFactor < 0.2) {
        let blendFactor = (heightFactor - grassThreshold) / (rockThreshold - grassThreshold);
        textureColor = mix(grassColor, rockColor, heightFactor * 2.0);
    } else {
        textureColor = mix(rockColor, snowColor, heightFactor * 2.0);
    }

    if (heightFactor < material.seaLevel) {
        // RIPPLES
        //        waterTexCoords.x += sin(uTime + vFragPosition.x * 0.1) * 0.01;
        //        waterTexCoords.y += cos(uTime + vFragPosition.z * 0.1) * 0.01;

        seaColor.a = 0.5;
        textureColor = mix(refractedRockColor, seaColor, 0.5);
    } else if (heightFactor < grassThreshold) {
        textureColor = grassColor;
    } else if (heightFactor < rockThreshold) {
        let blendFactor = (heightFactor - grassThreshold) / (rockThreshold - grassThreshold);
        textureColor = mix(grassColor, rockColor, blendFactor);
    } else {
        let blendFactor = (heightFactor - rockThreshold) / (1.0 - rockThreshold);
        textureColor = mix(rockColor, snowColor, blendFactor);
    }

    let uShininess = material.shininess;
    let uLightPos = light.lightDirection.xyz;
    let uViewPos = light.uViewPosition.xyz;
    let uAmbientColor = material.ambientLight.rgb;
    let uLightColor = light.lightColor.rgb;

    let normal = normalize(input.fragNormal);
    let lightDir = normalize(uLightPos - input.fragPosition);
    let viewDir = normalize(uViewPos - input.fragPosition);

//    let pixelColor = textureColor.rgb;
    let pixelColor = mix(material.diffuseLight.rgb, textureColor.rgb, textureColor.a);


    let ambient = uAmbientColor * pixelColor;
    let diff = max(dot(normal, lightDir), 0.0);
    let diffuse = diff * uLightColor * pixelColor;
    let reflectDir = reflect(-lightDir, normal);  // Reflect light direction around the normal
    let spec = pow(max(dot(viewDir, reflectDir), 0.0), uShininess);
    let specular = spec * uLightColor * material.specularLight.xyz;

    let result = ambient + diffuse + specular;

    return vec4(result, 1.0);
}
