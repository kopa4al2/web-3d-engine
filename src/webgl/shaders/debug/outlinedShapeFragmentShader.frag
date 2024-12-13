#version 300 es
precision highp int;
precision highp float;


layout(std140) uniform Global {
    mat4 uProjectionView;
    vec4 uViewPosition;// The eye of the camera
    vec4 uLightDirection;
    vec4 uLightColor;
};

layout(std140) uniform Material {
    vec4 uFillColor;
    vec4 uLineColor;
    vec2 flags;
};

const uint OUTLINE = 0x1u;
const uint SKIP_FILL_COLOR = 0x2u;

const uint CUBE_SHAPE = 0x1u;
const uint SPHERE_SHAPE = 0x2u;

out vec4 fragColor;

in vec2 vUV;

bool shouldRender(uint shapeFlag, vec2 uv);

void main() {
//    fragColor = uViewPosition;
//    fragColor = vec4(float(flags & OUTLINE), flags & SKIP_FILL_COLOR, flags, 1.0);
//    uint renderFlags = flags[0];
//    uint shapeFlags = flags[1];
    uint drawFlags = uint(flags[0]);
    uint shapeFlags = uint(flags[1]);
    if ((drawFlags & OUTLINE) != 0u) {


        if (shouldRender(shapeFlags, vUV)) {
            fragColor = uLineColor;
            return;
        }
    }

    if ((drawFlags & SKIP_FILL_COLOR) != 0u) {
        discard;
    }

    fragColor = uFillColor;
}

bool shouldRender(uint shapeFlag, vec2 uv) {
    if ((shapeFlag & SPHERE_SHAPE) != 0u) {
        float latFactor = 10.0;// Adjust to control latitude line density
        float lonFactor = 10.0;// Adjust to control longitude line density

        // Render only when latitude or longitude is near a multiple of latFactor or lonFactor
        bool renderLatLine = fract(uv.x * latFactor) < 0.05;
        bool renderLonLine = fract(uv.y * lonFactor) < 0.05;

        return renderLatLine || renderLonLine;
    }

    if ((shapeFlag & CUBE_SHAPE) != 0u) {
        float edgeDistance = min(uv.x, 1.0 - uv.x); // Horizontal edge distance
        edgeDistance = min(edgeDistance, uv.y);      // Vertical top edge distance
        edgeDistance = min(edgeDistance, 1.0 - uv.y); // Vertical bottom edge distance


        return edgeDistance < 0.05;
    }

    return true;
}
