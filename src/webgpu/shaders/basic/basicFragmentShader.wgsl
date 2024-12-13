//struct Material {
//    color: vec4<f32>,
//};


//@group(1) @binding(0) var<uniform> material: Material;

@fragment
fn main() -> @location(0) vec4<f32> {
    return vec4<f32>(1.0, 1.0, 0.0, 1.0);
}


