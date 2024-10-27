#version 300 es
precision highp int;
precision highp float;

layout(std140) uniform Material {
    vec4 uMaterialAmbient;
    vec4 uMaterialDiffuse;// This will be color if texutre isnt present4
    vec4 uMaterialSpecular;
    float uShininess;
    float uMaxHeight;
    float uMinHeight;
    float uSeaLevel;
};

layout(std140) uniform Light {
    vec4 uLightDirection;
    vec4 uLightColor;

    vec4 uViewPosition;// The eye of the camera
};

uniform sampler2D grassTexture;
uniform sampler2D mountain1Texture;
uniform sampler2D snow1Texture;
uniform sampler2D water1Texture;

in vec2 vTexCoord;
in vec3 vFragPosition;
in vec3 vFragNormal;
out vec4 fragColor;

void main() {
    float maxHeight = uMaxHeight;
    // Normalize the height (assume y position is height)
    float heightFactor = (vFragPosition.y - uMinHeight) / (maxHeight - uMinHeight);

    // Calculate slope based on the normal (how much the surface is inclined)
    float slopeFactor = 1.0 - dot(normalize(vFragNormal), vec3(0.0, 1.0, 0.0));// 0 = flat, 1 = steep

    // Define thresholds for texture blending
    float grassThreshold = 0.50;// Grass for lower terrain
    float rockThreshold = 0.85;// Rock for mid-level terrain


    vec4 textureColor;
    if (heightFactor < uSeaLevel) {
        vec2 waterTexCoords = vTexCoord;
        // RIPPLES
        //        waterTexCoords.x += sin(uTime + vFragPosition.x * 0.1) * 0.01;
        //        waterTexCoords.y += cos(uTime + vFragPosition.z * 0.1) * 0.01;

        vec4 seaColor = texture(water1Texture, waterTexCoords);
        seaColor.a = 0.5;

        vec2 refractedTexCoords = vTexCoord;
        refractedTexCoords += (waterTexCoords - 0.5) * 0.02;

        vec4 rockColor = texture(mountain1Texture, refractedTexCoords);
        textureColor = mix(rockColor, seaColor, 0.5);
    } else if (heightFactor < grassThreshold) {
        textureColor = texture(grassTexture, vTexCoord);
    } else if (heightFactor < rockThreshold) {
        // Blend grass and rock based on the height
        vec4 grassColor = texture(grassTexture, vTexCoord);
        vec4 rockColor = texture(mountain1Texture, vTexCoord);
        float blendFactor = (heightFactor - grassThreshold) / (rockThreshold - grassThreshold);
        textureColor = mix(grassColor, rockColor, blendFactor);
    } else {
        // Blend rock and snow
        vec4 rockColor = texture(mountain1Texture, vTexCoord);
        vec4 snowColor = texture(snow1Texture, vTexCoord);
        float blendFactor = (heightFactor - rockThreshold) / (1.0 - rockThreshold);
        textureColor = mix(rockColor, snowColor, blendFactor);
    }
//    fragColor = textureColor;

        vec3 uLightPos = uLightDirection.xyz;
        vec3 uViewPos = uViewPosition.xyz;
        vec3 uAmbientColor = uMaterialAmbient.rgb;

        vec3 normal = normalize(vFragNormal);
        vec3 lightDir = normalize(uLightPos - vFragPosition);
        vec3 viewDir = normalize(uViewPos - vFragPosition);

        // If texture has alpha channel > 0 it will use the texutre otherwise the diffuse color
        vec3 color = mix(uMaterialDiffuse.rgb, textureColor.rgb, textureColor.a);

        vec3 ambient = uAmbientColor * color;
        float diff = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diff * uLightColor.rgb * color;

        // Specular component (Phong)
        vec3 reflectDir = reflect(-lightDir, normal);// Reflect light direction around the normal
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), uShininess);
        vec3 specular = spec * uLightColor.rgb * uMaterialSpecular.rgb;

        vec3 result = ambient + diffuse + specular;
        fragColor = vec4(result, 1.0);
}


// TILING
//vec2 tiledTexCoord = vTexCoord * vec2(10.0, 10.0);  // Tile the texture 10 times across the terrain
//vec4 grassColor = texture2D(grassTexture, tiledTexCoord);


