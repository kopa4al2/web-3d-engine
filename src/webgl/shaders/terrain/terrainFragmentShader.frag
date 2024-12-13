#version 300 es
precision highp sampler2DArray;
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

layout(std140) uniform Global {
    mat4 uProjectionView;
    vec4 uViewPosition;
    vec4 uLightDirection;
    vec4 uLightColor;
};

uniform sampler2DArray TexturesArray;

in vec2 vTexCoord;
in vec3 vFragPosition;
in vec3 vFragNormal;
out vec4 fragColor;

void main() {
    vec2 grassOffset = vec2(0.0, 0.0);// Grass at (0,0) to (512,512)
    vec2 rockOffset = vec2(0.0, 0.5);// Rock at (0,512) to (512,1024)
    vec2 snowOffset = vec2(0.5, 0.0);// Snow at (512,0) to (1024,512)
    vec2 waterOffset = vec2(0.5, 0.5);// Water at (512,512) to (1024,1024)
    vec2 atlasScale = vec2(0.5, 0.5);// Downscale the texture coordinates

    float maxHeight = uMaxHeight;
    float heightFactor = (vFragPosition.y - uMinHeight) / (maxHeight - uMinHeight);
    float slopeFactor = 1.0 - dot(normalize(vFragNormal), vec3(0.0, 1.0, 0.0));// 0 = flat, 1 = steep

    float grassThreshold = 0.50;// Grass for lower terrain
    float rockThreshold = 0.85;// Rock for mid-level terrain


    vec4 textureColor;
    if (heightFactor < uSeaLevel) {
        vec2 waterTexCoords = vTexCoord;
        // RIPPLES
        //        waterTexCoords.x += sin(uTime + vFragPosition.x * 0.1) * 0.01;
        //        waterTexCoords.y += cos(uTime + vFragPosition.z * 0.1) * 0.01;

        vec4 seaColor = texture(TexturesArray, vec3(atlasScale * vTexCoord + waterOffset, 0));
        seaColor.a = 0.5;

        vec2 refractedTexCoords = vTexCoord;
        refractedTexCoords += (waterTexCoords - 0.5) * 0.02;

        vec4 rockColor = texture(TexturesArray, vec3(atlasScale * refractedTexCoords + rockOffset, 0));
        textureColor = mix(rockColor, seaColor, 0.5);
    } else if (heightFactor < grassThreshold) {
        textureColor = texture(TexturesArray, vec3(atlasScale * vTexCoord + grassOffset, 0));
    } else if (heightFactor < rockThreshold) {
        // Blend grass and rock based on the height
        vec4 grassColor = texture(TexturesArray, vec3(atlasScale * vTexCoord + grassOffset, 0));
        vec4 rockColor = texture(TexturesArray, vec3(atlasScale * vTexCoord + rockOffset, 0));
        float blendFactor = (heightFactor - grassThreshold) / (rockThreshold - grassThreshold);
        textureColor = mix(grassColor, rockColor, blendFactor);
    } else {
        // Blend rock and snow
        vec4 rockColor = texture(TexturesArray, vec3(atlasScale * vTexCoord + rockOffset, 0));
        vec4 snowColor = texture(TexturesArray, vec3(atlasScale * vTexCoord + snowOffset, 0));
        float blendFactor = (heightFactor - rockThreshold) / (1.0 - rockThreshold);
        textureColor = mix(rockColor, snowColor, blendFactor);
    }

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
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), uShininess);
    vec3 specular = spec * uLightColor.rgb * uMaterialSpecular.rgb;

    vec3 result = ambient + diffuse + specular;
    fragColor = vec4(result, 1.0);
}


// TILING
//vec2 tiledTexCoord = vTexCoord * vec2(10.0, 10.0);  // Tile the texture 10 times across the terrain
//vec4 grassColor = texture2D(grassTexture, tiledTexCoord);


