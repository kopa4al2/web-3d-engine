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
};


struct FragmentInput {
    @location(0) pixelPosition: vec3<f32>,
    @location(1) surfaceNormal: vec3<f32>,
    @location(2) textureCoord: vec2<f32>,
}

@group(0) @binding(0) var<uniform> light: Global;

@group(1) @binding(0) var<uniform> material: Material;
@group(1) @binding(1) var texture: texture_2d<f32>;
@group(1) @binding(2) var samler: sampler;


@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    let uShininess = 10.0;
    let uLightPos = light.lightDirection.xyz;
    let uViewPos = light.uViewPosition.xyz;
    let uAmbientColor = material.ambientLight.rgb;
    let uLightColor = light.lightColor.rgb;

    let normal = normalize(input.surfaceNormal);
    let lightDir = normalize(uLightPos - input.pixelPosition);
    let viewDir = normalize(uViewPos - input.pixelPosition);

    let texColor = textureSample(texture, samler, input.textureCoord);
    let pixelColor = mix(material.diffuseLight.rgb, texColor.rgb, texColor.a);

    // Ambient component
    let ambient = uAmbientColor * pixelColor;

    // Diffuse component (Lambertian)
    let diff = max(dot(normal, lightDir), 0.0);
    let diffuse = diff * uLightColor * pixelColor; // remove diffuse if working with texture

    // Specular component (Phong)
    let reflectDir = reflect(-lightDir, normal);  // Reflect light direction around the normal
    let spec = pow(max(dot(viewDir, reflectDir), 0.0), uShininess);
    let specular = spec * uLightColor * material.specularLight.xyz;

    let result = ambient + diffuse + specular;

    return vec4(result, 1.0);
}


