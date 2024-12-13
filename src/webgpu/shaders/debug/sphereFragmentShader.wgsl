struct Material {
    fillColor: vec4<f32>,
    lineColor: vec4<f32>,
    flags: vec2<f32>,
};

struct FragmentInput {
    @location(0) uv: vec2<f32>,
}

@group(1) @binding(0) var<uniform> material: Material;

const OUTLINE = 0x1;
const SKIP_FILL_COLOR = 0x2;


const CUBE_SHAPE = 0x1;
const SPHERE_SHAPE = 0x2;


@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    let drawFlags = u32(material.flags[0]);
    let shapeFlags = u32(material.flags[1]);

    if ((drawFlags & OUTLINE) != 0) {
          if (shouldRender(shapeFlags, input.uv)) {
            return material.lineColor;
          }
    }

     if ((drawFlags & SKIP_FILL_COLOR) != 0) {
        discard;
    }

    return material.fillColor;
}

fn shouldRender(shape: u32, uv: vec2<f32>) -> bool {
    if ((shape & SPHERE_SHAPE) != 0) {
        // Render only specific latitude and longitude lines
        let latFactor = 10.0;    // Adjust to control latitude line density
        let lonFactor = 10.0;    // Adjust to control longitude line density

        // Render only when latitude or longitude is near a multiple of latFactor or lonFactor
        let renderLatLine = fract(uv.x * latFactor) < 0.05;
        let renderLonLine = fract(uv.y * lonFactor) < 0.05;

        return (renderLatLine || renderLonLine);
    }

    if ((shape & CUBE_SHAPE) != 0) {
        var edgeDistance = min(uv.x, 1.0 - uv.x); // Horizontal edge distance
        edgeDistance = min(edgeDistance, uv.y);      // Vertical top edge distance
        edgeDistance = min(edgeDistance, 1.0 - uv.y); // Vertical bottom edge distance


        return edgeDistance < 0.05;
    }

    return true;
}


