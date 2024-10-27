#version 300 es
precision highp int;
precision highp float;

layout(std140) uniform Material {
    vec4 uMaterialAmbient;
    vec4 uMaterialDiffuse;// This will be color if texutre isnt present4
    vec4 uMaterialSpecular;
//    float uShininess;
};

layout(std140) uniform Light {
    vec4 uLightDirection;
    vec4 uLightColor;

    vec4 uViewPosition;// The eye of the camera
};

uniform sampler2D uSampler;

in vec2 vTexCoord;
in vec3 vFragPosition;
in vec3 vFragNormal;
out vec4 fragColor;

void main() {
    float uShininess = 10.0;
    vec3 uLightPos = uLightDirection.xyz;
    vec3 uViewPos = uViewPosition.xyz;
    vec3 uAmbientColor = uMaterialAmbient.rgb;

    vec3 normal = normalize(vFragNormal);
    vec3 lightDir = normalize(uLightPos - vFragPosition);
    vec3 viewDir = normalize(uViewPos - vFragPosition);

    vec4 texColor = texture(uSampler, vTexCoord);
    // If texture has alpha channel > 0 it will use the texutre otherwise the diffuse color
    vec3 color = mix(uMaterialDiffuse.rgb, texColor.rgb, texColor.a);

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