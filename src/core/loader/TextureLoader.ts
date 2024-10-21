import Texture from "../texture/Texture";

export default class TextureLoader {

    public static textures: Record<TextureName, Texture> = {};
    public static rawImages: Record<string, ImageData> = {};

    static async loadTexture(name: string, path: string): Promise<Texture> {
        const img = new Image();
        img.src = path;
        // console.time(name);
        await img.decode();
        // console.timeLog(name, 'decode');
        TextureLoader.textures[name] = new Texture(name, await createImageBitmap(img, { colorSpaceConversion: 'none' }));
        // console.timeEnd(name);
        return TextureLoader.textures[name];
    }

    static async loadHeightMap(name: string, path: string): Promise<ImageData> {
        return new Promise(resolve => {

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

export type TextureName = string