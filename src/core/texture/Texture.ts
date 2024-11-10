import { TextureData } from "core/resources/gpu/BufferDescription";
import { vec4 } from 'gl-matrix';

export type TextureId = symbol;
export type SamplerId = symbol;

export default class Texture {


    public static readonly OPAQUE_TEXTURE = new Texture('OPAQUE', new ImageData(new Uint8ClampedArray([0, 0, 0, 0]), 1, 1));

    constructor(public name: string, public imageData: TextureData) {
    }
}