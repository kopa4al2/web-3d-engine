import TerrainGeometry from 'core/components/geometry/TerrainGeometry';
import Graphics, { BindGroupId, BindGroupLayoutId } from "core/Graphics";
import { BufferData, BufferId } from "core/resources/gpu/BufferDescription";
import { vec2, vec3, vec4 } from 'gl-matrix';
import BufferUtils from "../../utils/BufferUtils";
import Texture from 'core/texture/Texture';

export interface TextureArrayIndex {
    textureLayer: number,
    textureUvOffset: vec2,
    textureUvScale: vec2,
}

export default interface MaterialProperties {
    getBufferData(): BufferData;
}

export class UnlitMaterial implements MaterialProperties {
    constructor(public flags: number[],
                public fillColor: vec4,
                public outlineColor: vec4) {
    }

    getBufferData(): Float32Array {
        return new Float32Array([...this.fillColor, ...this.outlineColor, ...this.flags]);
    }
}

export class PhongMaterialProperties implements MaterialProperties {
    constructor(public ambient: vec4,
                public diffuse: vec4,
                public specular: vec4,
                // public shininess: number = 20.0
    ) {
    }

    getBufferData(): Float32Array {
        return new Float32Array([...this.ambient, ...this.diffuse, ...this.specular]);
    }
}

/**
 * constructor(public albedo: TextureArrayIndex,
 *                 public normalMap: TextureArrayIndex,
 *                 public metallicRoughnessMap: TextureArrayIndex,
 *                 public baseColorFactor: vec4) {
 *     }
 */
export interface AlbedoProperties {
    texture: Texture,
    baseColor?: vec4,
    alphaCutoff?: number
}
export interface EmissiveProperties {
    texture: Texture,
    factor: vec3,
    strength: number
}

export class PBRMaterialProperties implements MaterialProperties {
    constructor(public albedo: AlbedoProperties,
                public normalMap: Texture,
                public emissive: EmissiveProperties,
                public metallicRoughnessMap: Texture,
                public metallicRoughnessFactor: vec2,
                ) {
    }

    getBufferData(): BufferData {
        const bufferData = new ArrayBuffer(256);
        const dataView = new DataView(bufferData);

        let byteOffset = this.setTextureData(dataView, 0, this.albedo.texture.index, this.albedo.baseColor, this.albedo.alphaCutoff);
        // console.log(`Albedo byte offset. Expected: ${48}, Actual: ${byteOffset}`)
        byteOffset = this.setTextureData(dataView, byteOffset, this.normalMap.index);
        // console.log(`normal byte offset. Expected: ${48 * 2}, Actual: ${byteOffset}`)
        byteOffset = this.setTextureData(dataView, byteOffset, this.emissive.texture.index, vec4.fromValues(this.emissive.factor[0], this.emissive.factor[1], this.emissive.factor[2], this.emissive.strength));
        // console.log(`Emissive byte offset. Expected: ${48 * 3}, Actual: ${byteOffset}`)
        byteOffset = this.setTextureData(dataView, byteOffset, this.metallicRoughnessMap.index, vec4.fromValues(this.metallicRoughnessFactor[0], this.metallicRoughnessFactor[1], 1, 1));
        // console.log(`metallic roughness byte offset. Expected: ${48 * 4}, Actual: ${byteOffset}`)

        return new Uint8Array(bufferData);
    }

    private setTextureData(dataView: DataView<ArrayBuffer>,
                           byteOffset: number,
                           textureData: TextureArrayIndex,
                           colorFactor: vec4 = vec4.fromValues(1, 1, 1, 1),
                           alphaCutoff: number = 0.0): number {
        byteOffset = BufferUtils.writeFloatArray(dataView, byteOffset, [...textureData.textureUvOffset, ...textureData.textureUvScale]);

        dataView.setUint32(byteOffset, textureData.textureLayer, true);
        byteOffset += 4;
        dataView.setFloat32(byteOffset, alphaCutoff, true);
        byteOffset += 4;
        byteOffset += 8;
        byteOffset = BufferUtils.writeFloatArray(dataView, byteOffset, colorFactor)
        // dataView.setFloat32(byteOffset, colorFactor[0], true);
        // dataView.setFloat32(byteOffset, colorFactor[1], true);
        // dataView.setFloat32(byteOffset, colorFactor[2], true);
        // dataView.setFloat32(byteOffset, colorFactor[3], true);
        // byteOffset += 16;

        return byteOffset;
    }

}

export class TerrainMaterialProperties implements MaterialProperties {
    constructor(public ambientLight: vec4,
                public diffuseLight: vec4,
                public specularLight: vec4,
                public shininess: number = 20.0,
                public seaLevel: number = (TerrainGeometry.SEA_LEVEL - TerrainGeometry.MIN_HEIGHT) / (TerrainGeometry.MIN_HEIGHT + TerrainGeometry.HEIGHT_FACTOR - TerrainGeometry.MIN_HEIGHT),
                public maxHeight: number = TerrainGeometry.MIN_HEIGHT + TerrainGeometry.HEIGHT_FACTOR,
                public minHeight: number = TerrainGeometry.MIN_HEIGHT,
                public textureCoordinates: vec4 = vec4.fromValues(256.0, 256.0, 0, 0)) {
    }

    getBufferData(): Float32Array {
        return new Float32Array([...this.ambientLight, ...this.diffuseLight, ...this.specularLight,
            this.shininess, this.maxHeight, this.minHeight, this.seaLevel, ...this.textureCoordinates]);
    }

}

export const NOOP_MATERIAL: MaterialProperties = {
    getBufferData(): BufferData {
        return new Float32Array();
    }

} 
