#version 300 es
precision highp int;
precision highp float;


layout(std140) uniform World {
    mat4 uModelViewProjection;
};

layout(location = 0) in vec3 aPosition;
//out vec3 vPosition;

void main() {
    gl_Position = uModelViewProjection * vec4(aVertexPosition, 1.0);
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