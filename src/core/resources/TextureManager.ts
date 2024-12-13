import Graphics from 'core/Graphics';
import { TextureName } from 'core/loader/TextureLoader';
import { TextureArrayIndex } from 'core/mesh/material/MaterialProperties';
import { DefaultSampling } from "core/texture/SamplingConfig";
import Texture, { GlFace, TextureId, TextureSize, TextureType, TextureUsage } from 'core/texture/Texture';
import TexturePacker from "core/texture/TexturePacker";
import PromiseQueue from "core/utils/PromiseQueue";
import { vec2 } from 'gl-matrix';
import DebugUtil from "../../util/DebugUtil";

interface GlobalTextureData {
    width: number,
    height: number,
    totalLayers: number,
    layers: GlobalTextureLayer[],
}

interface GlobalTextureLayer {
    textures: [{ label: string, width: number, height: number, xOffset: number, yOffset: number }]
    takenWidth: number,
    takenHeight: number,
    xOffset: number,
    yOffset: number,
}

export default class TextureManager {
    private static readonly ENV_MAP_TEXTURE_KEY: string = 'ENV_MAP_TEXTURE_KEY';
    private static readonly MAX_TEXTURE_ARRAY_SIZE: TextureSize = { width: 1024, height: 1024 };
    public static readonly TEXTURE_ARRAY_LAYERS = 80;
    private cachedTextures: Map<string, Texture> = new Map();
    // textures currently loading by path TODO: We may not need this anymore
    private loadingTextures: Set<TextureName> = new Set();

    private globalTextures: Map<string, TextureId> = new Map();
    private textureArraysData: WeakMap<TextureId, GlobalTextureData> = new WeakMap();
    private cubeTextures: Map<string, TextureId> = new Map();

    private readonly texturePacker: TexturePacker;
    private readonly promiseQueue: PromiseQueue;

    constructor(private graphics: Graphics) {
        DebugUtil.addToWindowObject('textureManager', this);
        this.texturePacker = new TexturePacker(TextureManager.MAX_TEXTURE_ARRAY_SIZE.width,
            TextureManager.MAX_TEXTURE_ARRAY_SIZE.height,
            TextureManager.TEXTURE_ARRAY_LAYERS);

        this.promiseQueue = new PromiseQueue();

        // console.group('Debug texture packer')
        // console.log(this.texturePacker.addTexture(512, 512)); // Layer 0: { x: 0, y: 0, layer: 0, uv: [...] }
        // console.log(this.texturePacker.addTexture(512, 512)); // Layer 0: { x: 512, y: 0, layer: 0, uv: [...] }
        // console.log(this.texturePacker.addTexture(512, 512)); // Layer 0: { x: 0, y: 512, layer: 0, uv: [...] }
        // console.log(this.texturePacker.addTexture(724, 724));
        // console.log(this.texturePacker.addTexture(256, 256));
        // console.log(this.texturePacker.addTexture(1024, 1024)); // Layer 1: Takes the entire layer
        // console.groupEnd()
    }

    public async addEnvironmentMap(path: string, names: string[]) {
        // const images = await HDRLoader.loadHDRImages(path, names);
        const images = await Promise.all(names.map(relative => this.loadImage(path + relative)))


        const width = images[0].width;
        const height = images[0].height;
        const textureId = this.getEnvironmentMap();

        images.forEach((img, idx) => {
            this.graphics.updateTexture(textureId, {
                x: 0, y: 0, z: idx,
                data: {
                    width, height,
                    imageData: img.data,
                    channel: {
                        format: 'rgba8unorm',
                        dataType: 'UINT8',
                    },
                },
                glFace: GlFace.X + idx
                // bytesPerPixel: 4 * 2, // for HDR 4 channels, 2 bytes per channel
            });
        })

        this.cubeTextures.set(TextureManager.ENV_MAP_TEXTURE_KEY, textureId);
    }

    public getEnvironmentMap(): TextureId {
        const texture = this.cubeTextures.get(TextureManager.ENV_MAP_TEXTURE_KEY);
        if (texture) {
            return texture;
        }

        const cubeMap = this.graphics.createTexture({
            label: 'env-cube-map',
            image: {
                width: 1024, height: 1024,
                channel: {
                    // format: 'rgba16float', // for hdr format
                    format: 'rgba8unorm',
                    dataType: 'UINT8'
                },
            },
            usage: TextureUsage.TEXTURE_BINDING | TextureUsage.COPY_DST,
            type: TextureType.CUBE_MAP,
            depth: 6,
        });
        this.cubeTextures.set(TextureManager.ENV_MAP_TEXTURE_KEY, cubeMap);
        return cubeMap;
    }

    public async create1x1Texture(label: string, data: Uint8ClampedArray): Promise<TextureArrayIndex> {
        return await this.createTextureFromValues(label, data, 1, 1);
    }

    public async createTextureFromValues(label: string, data: Uint8ClampedArray, imgWidth: number, imgHeight: number) {
        if (this.cachedTextures.get(label)) {
            console.warn(`Loaded texture from cache: ${ label }`)
            return this.cachedTextures.get(label)!.index;
        }
        return await this.promiseQueue.addTask(() => this._createTextureFromValues(label, data, imgWidth, imgHeight));
    }

    public async _createTextureFromValues(label: string, data: Uint8ClampedArray, imgWidth: number, imgHeight: number) {
        const textureId = this.getTextureArrayIdForSize(TextureManager.MAX_TEXTURE_ARRAY_SIZE);
        const addedTexture = this.texturePacker.addTexture(imgWidth, imgHeight);
        if (addedTexture === null) {
            throw new Error(`Could not add texture: ${ label }`)
        }
        const {
            layer, uv,
            x, y,
            width, height
        } = addedTexture;

        this.graphics.updateTexture(textureId, {
            x, y, z: layer,
            data: {
                imageData: data,
                width, height,
                channel: {
                    format: 'rgba8unorm',
                    dataType: 'uint8'
                }
            },
        });
        // this.graphics.writeToTexture(textureId, new ImageData(data, width, height),
        //     vec3.fromValues(x, y, layer),
        //     width, height);
        // this.cachedTextures.set(label, new Texture(label, data, {
        //     textureUvScale: vec2.create(),
        //     textureLayer: layer,
        //     textureUvOffset: vec2.create()
        // }, { width, height }))

        return {
            textureLayer: layer,
            textureUvOffset: vec2.fromValues(uv[0], uv[1]),
            textureUvScale: vec2.fromValues(uv[2], uv[3]),
        }
    }

    public async addToGlobalTexture(path: string): Promise<TextureArrayIndex> {
        return this.promiseQueue.addTask(() => this._addToGlobalTexture(path));
    }

    private async _addToGlobalTexture(path: string): Promise<TextureArrayIndex> {
        if (this.cachedTextures.has(path)) {
            return this.cachedTextures.get(path)!.index;
        }
        if (this.loadingTextures.has(path)) {
            console.warn('Texture is already loading: ', path);
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(this.addToGlobalTexture(path));
                }, 500);
            });
        }
        this.loadingTextures.add(path);
        console.debug(`Texture path: ${ path } not found in cache.`);
        const imageData = await this.loadImage(path);
        if (!this.isSupportedSize(imageData.width, imageData.height)) {
            console.error('Texture is not in supported sizes. texture: ', imageData);
            throw new Error('Currently only textures that fit are supported');
        }

        const textureId = this.getTextureArrayIdForSize(TextureManager.MAX_TEXTURE_ARRAY_SIZE);
        const { width, height, x, y, layer, uv } = this.texturePacker.addTexture(imageData.width, imageData.height)!;

        this.graphics.updateTexture(textureId, {
            x, y, z: layer,
            data: {
                imageData: imageData.data,
                width, height,
                channel: {
                    format: 'rgba8unorm',
                    dataType: 'uint8'
                }
            },
        });
        // this.graphics.writeToTexture(textureId,
        //     imageData,
        //     vec3.fromValues(x, y, layer),
        //     width, height);
        const texture = new Texture(
            path, imageData,
            {
                textureLayer: layer,
                textureUvOffset: vec2.fromValues(uv[0], uv[1]),
                textureUvScale: vec2.fromValues(uv[2], uv[3]),
            },
            { width, height });
        this.cachedTextures.set(path, texture);
        this.loadingTextures.delete(path);

        return texture.index;
    }

    public getTextureArrayIdForSize(size: TextureSize): TextureId {
        const sizeSerialized = JSON.stringify(size);
        if (!this.globalTextures.has(sizeSerialized)) {
            console.log('Creating global texture');
            const textureId = this.graphics.createTexture({
                label: `texture-array-${ sizeSerialized }`,
                image: {
                    width: size.width, height: size.height,
                    channel: {
                        format: 'rgba8unorm',
                        dataType: 'uint8'
                    }
                }, usage: TextureUsage.COPY_DST | TextureUsage.TEXTURE_BINDING,
                depth: TextureManager.TEXTURE_ARRAY_LAYERS,
                type: TextureType.TEXTURE_ARRAY,
                // samplingConfig: DefaultSampling
            });
            this.globalTextures.set(sizeSerialized, textureId);
            this.textureArraysData.set(textureId, {
                width: size.width,
                height: size.height,
                totalLayers: TextureManager.TEXTURE_ARRAY_LAYERS,
                layers: []
            });

            return textureId;
        }

        return this.globalTextures.get(sizeSerialized)!;
    }

    private async loadImage(path: string): Promise<ImageData> {
        const img = new Image();
        img.src = path;
        await img.decode();

        return this.loadFromOffScreenCanvas(img);
    }

    private loadFromOffScreenCanvas(img: HTMLImageElement): ImageData {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const context = canvas.getContext('2d', { willReadFrequently: true })!;
        context.drawImage(img, 0, 0, img.width, img.height);

        return context.getImageData(0, 0, img.width, img.height/*, { colorSpace: 'srgb' }*/);
    }

    private isSupportedSize(width: number, height: number) {
        // 1024 is max texture size for now - hard coded
        return 1024 % width === 0 || 1024 % height === 0;
        // return (width === 1024 && height === 1024)
        //     || (width === 1920 && height === 1080)
    }
}


/*
private tryToFitTexture(label: string, textureId: TextureId, imageData: ImageData): TextureArrayIndex & {
        width: number,
        height: number
    } {
        const { layers, width, height } = this.textureArraysData.get(textureId)!;
        const imageWidth = imageData.width;
        const imageHeight = imageData.height;
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (layer.takenWidth + imageWidth < width
                || layer.takenHeight + imageHeight < height) {
                console.debug(`found layer to fit ${ textureId.description }! Layer: ${ i }, ${ layer }, image w: ${ imageWidth } h: ${ imageHeight }`);

                // if (layer.takenWidth + imageWidth < width && )
                layer.xOffset += imageWidth;
                layer.yOffset += imageHeight;
                this.graphics.writeToTexture(textureId,
                    imageData,
                    vec3.fromValues(layer.xOffset, layer.yOffset, i),
                    imageWidth,
                    imageHeight);

                layer.takenWidth += imageWidth;
                layer.takenHeight += imageHeight;

                const textureUvScale = vec2
                    .fromValues(layer.takenWidth / TextureManager.MAX_TEXTURE_ARRAY_SIZE.width, layer.takenHeight / TextureManager.MAX_TEXTURE_ARRAY_SIZE.height,);
                const textureUvOffset = vec2
                    .fromValues(layer.xOffset / TextureManager.MAX_TEXTURE_ARRAY_SIZE.width, layer.yOffset / TextureManager.MAX_TEXTURE_ARRAY_SIZE.height,);
                layer.textures.push({
                    width: imageWidth,
                    height: imageHeight,
                    xOffset: layer.xOffset,
                    yOffset: layer.yOffset,
                    label
                })
                return { width: imageWidth, height: imageHeight, textureLayer: i, textureUvScale, textureUvOffset };
            }
        }

        console.debug(`Did not find layer to fit ${ textureId.description }, creating new layer! Image w: ${ imageWidth } h: ${ imageHeight }, layers: `, layers);
        const xOffset = 0;
        const yOffset = 0;
        const textureUvScale = vec2
            .fromValues(imageWidth / TextureManager.MAX_TEXTURE_ARRAY_SIZE.width, imageHeight / TextureManager.MAX_TEXTURE_ARRAY_SIZE.height,);
        const textureUvOffset = vec2
            .fromValues(yOffset, yOffset);

        // console.log('Uv scale: ', textureUvScale, ' uv off: ', textureUvOffset, ' layer: ', layers.length - 1)
        this.graphics.writeToTexture(textureId,
            imageData,
            vec3.fromValues(yOffset, yOffset, layers.length),
            imageWidth,
            imageHeight);
        layers.push({
            textures: [{ width: imageWidth, height: imageHeight, xOffset, yOffset, label }],
            xOffset,
            yOffset,
            takenHeight: imageHeight,
            takenWidth: imageWidth,
        });

        return {
            width: imageWidth,
            height: imageHeight,
            textureLayer: layers.length - 1,
            textureUvOffset,
            textureUvScale
        };
    }
 */


/* public async addToGlobalTexture(path: string): Promise<TextureArrayIndex> {
         if (this.cachedTextures.has(path)) {
             return this.cachedTextures.get(path)!.index;
         }
         if (this.loadingTextures.has(path)) {
             console.debug('Texture is already loading: ', path);
             return new Promise(resolve => {
                 setTimeout(() => {
                     resolve(this.addToGlobalTexture(path));
                 }, 500);
             });
         }
         this.loadingTextures.add(path);
         console.debug(`Texture path: ${ path } not found in cache.`);
         const imageData = await this.loadImage(path);
         if (!this.isSupportedSize(imageData.width, imageData.height)) {
             console.error('Texture is not in supported sizes. texture: ', imageData);
             throw new Error('Currently only textures that fit are supported');
         }


         const textureId = this.getTextureArrayIdForSize(TextureManager.MAX_TEXTURE_ARRAY_SIZE);
         const { width, height, x, y, layer, uv } = this.texturePacker.addTexture(imageData.width, imageData.height)!;
         // const { width, height, ...textureIndex } = this.tryToFitTexture(path, textureId, imageData);

         this.graphics.writeToTexture(textureId,
             imageData,
             vec3.fromValues(x, y, layer),
             width, height);
         const texture = new Texture(
             path, imageData,
             {
                 textureLayer: layer,
                 textureUvOffset: vec2.fromValues(uv[0], uv[1]),
                 textureUvScale: vec2.fromValues(uv[2], uv[3]),
             },
             { width, height });
         this.cachedTextures.set(path, texture);
         this.loadingTextures.delete(path);

         return texture.index;
     }*/