import TerrainGeometry from 'core/components/geometry/TerrainGeometry';
import Graphics, { BindGroupId, BindGroupLayoutId } from "core/Graphics";
import { BufferData, BufferId } from "core/resources/gpu/BufferDescription";
import { vec2, vec4 } from 'gl-matrix';
import BufferUtils from "../../../util/BufferUtils";

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


export class PBRMaterialProperties implements MaterialProperties {
    constructor(public albedo: TextureArrayIndex,
                public normalMap: TextureArrayIndex,
                public metallicRoughnessMap: TextureArrayIndex,
                public baseColorFactor: vec4,
                public roughnessMap?: TextureArrayIndex,
                public uvOffset: vec2 = vec2.fromValues(0, 0),
                public uvScale: vec2 = vec2.fromValues(1, 1)) {
    }

    createBufferV2() {
        // TODO: DO it like this
        // TextureMapViews.uv_offset[0] = 1.0;
        // TextureMapViews.uv_offset[1] = 2.0;
        // TextureMapViews.uv_scale[0] = 0.5;
        // TextureMapViews.uv_scale[1] = 0.5;
        // TextureMapViews.texture_layer[0] = 3;
        //
        // console.log(new Uint8Array(TextureMapValues)); // Inspect raw buffer contents
        const TextureMapValues = new ArrayBuffer(24);
        const TextureMapViews = {
            uv_offset: new Float32Array(TextureMapValues, 0, 2),
            uv_scale: new Float32Array(TextureMapValues, 8, 2),
            texture_layer: new Uint32Array(TextureMapValues, 16, 1),
        };
    }

    getBufferData(): BufferData {
        const bufferData = new ArrayBuffer(128);
        const dataView = new DataView(bufferData);


        // const albedoMap = {
        //     uv_offset: new Float32Array(bufferData, 0, 2),
        //     uv_scale: new Float32Array(bufferData, 8, 2),
        //     texture_layer: new Uint32Array(bufferData, 16, 1),
        // }
        let byteOffset = this.setTextureData(dataView, 0, this.albedo);
        // console.log(`Albedo byte offset. Expected: ${32}, Actual: ${byteOffset}`)
        byteOffset = this.setTextureData(dataView, byteOffset, this.normalMap);
        // console.log(`normal byte offset. Expected: ${64}, Actual: ${byteOffset}`)
        byteOffset = this.setTextureData(dataView, byteOffset, this.metallicRoughnessMap);
        // console.log(`metallic roughness byte offset. Expected: ${96}, Actual: ${byteOffset}`)
        byteOffset = BufferUtils.writeFloatArray(dataView, byteOffset, this.baseColorFactor);
        // console.log(`base color factor byte offset. Expected: ${128}, Actual: ${byteOffset}`)

        return new Uint8Array(bufferData);
    }

    private setTextureData(dataView: DataView<ArrayBuffer>, byteOffset: number, textureData: TextureArrayIndex): number {
        byteOffset = BufferUtils.writeFloatArray(dataView, byteOffset, [...textureData.textureUvOffset, ...textureData.textureUvScale]);
        // return BufferUtils.writeUint32Array(dataView, byteOffset, [textureData.textureLayer, 0, 0, 0])
        dataView.setUint32(byteOffset, textureData.textureLayer, true);
        byteOffset += 4;
        dataView.setUint32(byteOffset, 0, true);
        byteOffset += 4;
        dataView.setUint32(byteOffset, 0, true);
        byteOffset += 4;
        byteOffset += 4;

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
