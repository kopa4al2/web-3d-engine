import { ShaderUniformType } from "core/shaders/GPUShader";

/**
 * DYNAMICALLY CREATE SHADERS:
 * ==== DEFINE SHADERS =====
 *  Define uniforms (structs / values)
 *      Struct Material {
 *          ambientLight: vec4<f32>,
 *          diffuseLight: vec4<f32>,
 *          specularLight: vec4<f32>,
 *      }
 *      const struct {
 *          name: Material,
 *          size: 48,
 *          elements: [{ vec4, ambientLight, vec4 diffuseLight, vec4 specularLight }]
 *      }
 *
 *  Define vertices:
 *      layout(location = 0) in vec3 aVertexPosition;
 *      layout(location = 1) in vec2 aTextureUv;
 *
 *      const vertexInput [{ location: 0, vec3, aVertexPosition }, { location: 1, vec2, aTextureUv }]
 *
 *  Define varying
 *      out vec2 vTexCoord;
 *      out vec3 vFragPosition;
 *      ...
 *      in vec2 vTexCoord;
 *      in vec3 vFragPosition;
 *
 *      const varying [{ location: 0, vec2, vTexCoord }, { location: 1, vec3, vFragPosition }]
 *
 *  Shader code:
 *     gl_Position = struct.World.uModelViewProjection * vec4(vertex.aVertexPosition, 1.0);
 *     vFragPosition = vec3(struct.World.uModelMatrix * vec4(vertex.aVertexPosition, 1.0));
 *     varying.vTexCoord = vertex.aTextureUV;
 *
 *   Bonus:
 *      Include common libraries
 *      Conditional uniforms
 *
 *  === TRANSLATE TO GPU API ===
 *
 *    Assemble the shader.
 *    Validate if such description is already present.
 *    Create buffers for structs if not already present.
 *    If cannot reuse, create new ShaderDescription with unique id. (think how to determine if this shader is unique)
 *    NO GPU RESOURCES ARE ALLOCATED
 *    Bonus: Validate the shader code if its already existing - reuse
 *
 *
 * === Bind OBJ / gLTF / Custom mesh to a ShaderDescription ===
 *
 *    TODO: Think about the options:
 *    1. Each obj/gltf/geometry knows which description is will use, we have predefined mapping, and we allocate resources only when needed
 *    2. Treat obj/gltf/geometry as black box - read it and try to determine which shader it fits (maybe create one dynamically)
 *
 *  === ADD TO SCENE ===
 *
 *    Create buffers
 *    For webgl create the shader program and the uniform groups (check if can be reused). Create VAOs
 *    For webgpu create bind groups, bind groups layout, pipelines,
 *    Unique ID is created for this shader, so it can be reused
 *    A single mesh can be composed of many meshes, or use many shaders, consider this.
 *
 * === RENDER ===
 *
 *
 *
 * Cone: indices, vertices
 * Material: vec4[]
 */

export default interface ShaderStruct {
    name: string,
    elements: ShaderVariable[]
}

export interface ShaderVariable {
    name: string,
    type: ShaderVariableType,
}

export enum ShaderVariableType {
    MAT3,
    MAT4,
    VEC2,
    VEC3,
    VEC4,
    TEXTURE,
    SAMPLER
}


export const TextureStruct: (...textureName: string[]) => ShaderStruct = (...textureNames: string[]) => ({
    elements: textureNames.map((name) => ({
        name, type: ShaderVariableType.TEXTURE
    })),
    name: 'texture'
})

export const SamplerStruct: (...textureName: string[]) => ShaderStruct = (...textureNames: string[]) => ({
    elements: textureNames.map((name) => ({
        name, type: ShaderVariableType.TEXTURE
    })),
    name: 'sampler'
})

export const WorldStruct: ShaderStruct = {
    elements: [
        { name: 'uModelViewProjection', type: ShaderVariableType.MAT4 },
        { name: 'uModelMatrix', type: ShaderVariableType.MAT4 },
        { name: 'uInverseTranspose', type: ShaderVariableType.MAT4 }],
    name: 'World'
}

export const LightStruct: ShaderStruct = {
    elements: [
        { name: 'uLightDirection', type: ShaderVariableType.VEC4 },
        { name: 'uLightColor', type: ShaderVariableType.VEC4 },
        { name: 'uViewPosition', type: ShaderVariableType.VEC4 }],
    name: 'Light'
}

export const MaterialStruct: ShaderStruct = {
    elements: [
        { name: 'uAmbientLight', type: ShaderVariableType.VEC4 },
        { name: 'uDiffuseLight', type: ShaderVariableType.VEC4 },
        { name: 'uSpecularLight', type: ShaderVariableType.VEC4 }],
    name: 'Material'
}


/**
 * struct PBRMaterial {
 *     baseColor: vec4<f32>,      // Albedo (base color)
 *     metallic: f32,             // Metallic value
 *     roughness: f32,            // Roughness value
 *     emissive: vec3<f32>,       // Emissive color (for glowing materials)
 *     ambientOcclusion: f32,     // Ambient occlusion factor
 *     normalMap: bool,           // Whether the material uses a normal map
 * };
 */