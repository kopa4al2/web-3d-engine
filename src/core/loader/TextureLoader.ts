import Texture from "../texture/Texture";

export default class TextureLoader {

    public static pixelDataTextures: Record<TextureName, Texture> = {}

    public static textures: Record<TextureName, Texture> = {
    };
    public static rawImages: Record<string, ImageData> = {};

    // static async loadTexture(name: TextureName, path: string, textureName: string = name): Promise<Texture> {
    //     const img = new Image();
    //     img.src = path;
    //     await img.decode();
    //     // TextureLoader.textures[name] = new Texture(textureName, await createImageBitmap(img, { colorSpaceConversion: 'none' }));
    //     TextureLoader.loadFromOffScreenCanvas(name, img);
    //     return TextureLoader.textures[name];
    // }

    // static loadFromOffScreenCanvas(name: TextureName, img: HTMLImageElement) {
    //     const canvas = document.createElement('canvas');
    //     canvas.width = img.width;
    //     canvas.height = img.height;
    //     // console.log(`Texture: ${name} has width: ${img.width} and height: ${img.height}`)
    //     const context = canvas.getContext('2d', { willReadFrequently: true })!;
    //     context.drawImage(img, 0, 0, img.width, img.height);
    //
    //     // Extract the RGBA pixel data from the canvas
    //     const imageData = context.getImageData(0, 0, img.width, img.height);
    //     // const pixelData = new Uint8Array(imageData.data.buffer);
    //     // @ts-ignore
    //     TextureLoader.pixelDataTextures[name] = new Texture(name, imageData, { width: imageData.width, height: imageData.height });
    // }

    static async loadHeightMap(name: string, path: string): Promise<ImageData> {
        return new Promise<ImageData>(resolve => {
            const img = new Image();
            img.src = path;

            img.onload = function () {
                let canvas = document.createElement('canvas');
                let ctx = canvas.getContext('2d');

                canvas.width = img.width;
                canvas.height = img.height;
                ctx!.drawImage(img, 0, 0);

                const imageData = ctx!.getImageData(0, 0, img.width, img.height);
                TextureLoader.rawImages[name] = imageData
                resolve(imageData)
            };
        });
    }
}

export type TextureName = 'texture' | 'grass1' | 'grass2' | 'mountain1' | 'opaque' | string
