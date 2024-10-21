import { TextureData } from "core/buffer/Buffer";

export type TextureId = symbol;
export type SamplerId = symbol;

export default class Texture {

    constructor(public name: string, public imageData: TextureData) {
    }
}