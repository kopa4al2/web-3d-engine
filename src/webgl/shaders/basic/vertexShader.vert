#version 300 es
precision highp int;
precision highp float;


layout(std140) uniform World {
    mat4 uModelViewProjection;
    mat4 uModelMatrix;
    mat4 uInverseTransposeModelMatrix;
};

layout(location = 0) in vec3 aVertexPosition;
layout(location = 1) in vec2 textureUV;
layout(location = 2) in vec3 aNormal;

out vec2 vTexCoord;
out vec3 vFragPosition;
out vec3 vFragNormal;

void main() {
    vFragPosition = vec3(uModelMatrix * vec4(aVertexPosition, 1.0));
    vFragNormal = mat3(uInverseTransposeModelMatrix) * aNormal;
    gl_Position = uModelViewProjection * vec4(aVertexPosition, 1.0);
    vTexCoord = textureUV;
}

// Transform normal to world space
//vFragNormal = mat3(uModelMatrix) * aNormal;  // Assuming no scaling, otherwise use inverse-transpose


    // pass light direction and do ths
    // let lightDir = normalize(lightPosition - fragPosition);

    // pass view direction for this
    // let viewDir = normalize(cameraPosition - fragPosition);

    // fragment shader light by fragDirection
    /*
     // Normalize the normal and calculate light direction
        let normal = normalize(fragNormal);
        let lightDir = normalize(light.position - fragPosition);

        // Lambertian diffuse lighting
        let diffuse = max(dot(normal, lightDir), 0.0);

        // Final color (simple diffuse model for illustration)
        let color = diffuse * light.color;

        return vec4<f32>(color, 1.0);
    */