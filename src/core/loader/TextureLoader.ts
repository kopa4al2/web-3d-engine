import Texture from "../texture/Texture";

export default class TextureLoader {

    public static textures: Record<TextureName, Texture> = {
        grass1: Texture.OPAQUE_TEXTURE,
        grass2: Texture.OPAQUE_TEXTURE,
        mountain1: Texture.OPAQUE_TEXTURE,
        opaque: Texture.OPAQUE_TEXTURE,
        texture: Texture.OPAQUE_TEXTURE
    };
    public static rawImages: Record<string, ImageData> = {};

    static async loadTexture(name: TextureName, path: string, textureName: string = name): Promise<Texture> {
        const img = new Image();
        img.src = path;
        // console.time(name);
        await img.decode();
        // console.timeLog(name, 'decode');
        TextureLoader.textures[name] = new Texture(textureName, await createImageBitmap(img, { colorSpaceConversion: 'none' }));
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

export type TextureName = 'texture' | 'grass1' | 'grass2' | 'mountain1' | 'opaque' | string