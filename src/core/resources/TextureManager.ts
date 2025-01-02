import Graphics from 'core/Graphics';
import HDRLoader from "core/loader/HDRLoader";
import Texture, { GlFace, TextureData, TextureId, TextureSize, TextureType, TextureUsage } from 'core/texture/Texture';
import TexturePacker from "core/texture/TexturePacker";
import PromiseQueue from "core/utils/PromiseQueue";
import { vec2 } from 'gl-matrix';
import DebugUtil from "../../util/debug/DebugUtil";
import Globals from '../../engine/Globals';
import { TextureArrayIndex } from 'core/mesh/material/MaterialProperties';

const normalFormat = 'rgba8unorm';
const hdrImgFormat = 'rgba16float';
const usedType = 'uint8';
const usedFormat = normalFormat;

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
    private static readonly SHADOW_MAP_TEXTURE_KEY: string = 'SHADOW_MAP_TEXTURE_KEY';
    private static readonly ENV_MAP_TEXTURE_KEY: string = 'ENV_MAP_TEXTURE_KEY';
    public static readonly MAX_TEXTURE_ARRAY_SIZE: TextureSize = { width: 2048, height: 2048 };
    public static readonly TEXTURE_ARRAY_LAYERS = 30;
    private cachedTextures: Map<string, Texture> = new Map();

    private globalTextures: Map<string, TextureId> = new Map();
    private cubeTextures: Map<string, TextureId> = new Map();

    private readonly texturePacker: TexturePacker;
    private readonly shadowMapPacker: TexturePacker;
    private readonly promiseQueue: PromiseQueue;

    constructor(private graphics: Graphics) {
        DebugUtil.addToWindowObject('textureManager', this);

        this.shadowMapPacker = new TexturePacker(Globals.SHADOW_PASS_TEXTURE_SIZE, Globals.SHADOW_PASS_TEXTURE_SIZE, Globals.MAX_SHADOW_CASTING_LIGHTS);
        this.texturePacker = new TexturePacker(TextureManager.MAX_TEXTURE_ARRAY_SIZE.width,
            TextureManager.MAX_TEXTURE_ARRAY_SIZE.height,
            TextureManager.TEXTURE_ARRAY_LAYERS,
            8
        );

        this.promiseQueue = new PromiseQueue();

        this.globalTextures.set(TextureManager.SHADOW_MAP_TEXTURE_KEY,
            graphics.createTexture({
                depth: Globals.MAX_SHADOW_CASTING_LIGHTS,
                label: 'shadowMapDepthTexture',
                type: TextureType.TEXTURE_ARRAY,
                usage: TextureUsage.COPY_DST | TextureUsage.TEXTURE_BINDING | TextureUsage.RENDER_ATTACHMENT | TextureUsage.COPY_SRC,
                image: {
                    channel: { format: Globals.SHADOW_PASS_DEPTH_FN, dataType: 'float' },
                    width: Globals.SHADOW_PASS_TEXTURE_SIZE,
                    height: Globals.SHADOW_PASS_TEXTURE_SIZE,
                }
            }));

        // console.group('Debug texture packer')
        // console.log(this.texturePacker.addTexture('512x512', 512, 512)); // Layer 0: { x: 0, y: 0, layer: 0, uv: [...] }
        // console.log(this.texturePacker.addTexture('512x512', 512, 512)); // Layer 0: { x: 512, y: 0, layer: 0, uv: [...] }
        // console.log(this.texturePacker.addTexture('512x512', 512, 512)); // Layer 0: { x: 0, y: 512, layer: 0, uv: [...] }
        // console.log(this.texturePacker.addTexture('724x724', 724, 724));
        // console.log(this.texturePacker.addTexture('256x256', 256, 256));
        // console.log(this.texturePacker.addTexture('2048x2048', 2048, 2048)); // Layer 1: Takes the entire layer
        // console.groupEnd()
    }

    public async loadCubeMap(path: string, names: string[], isHdr = false) {
        return this.promiseQueue.addTask(() => this._loadCubeMap(path, names, isHdr));
    }

    private async _loadCubeMap(path: string, names: string[], isHdr = false) {
        const images = isHdr
            ? await HDRLoader.loadHDRImagesV2(path, names)
            // ? await HDRLoader.loadHDRImages(path, names)
            // : await Promise.all(names.map(relative => this.loadImageAsUint8(path + relative)));
            : await Promise.all(names.map(relative => this.loadImage(path + relative)));

        const width = images[0].width;
        const height = images[0].height;

        // const width = isHdr ? ( images[0] as HDRImageData ).shape[0] : ( images[0] as ImageData ).width;
        // const height = isHdr ? ( images[0] as HDRImageData ).shape[1] : ( images[0] as ImageData ).height;
        const textureId = this.getEnvironmentMap();

        images.forEach((img, idx) => {
            // const numberOfChannels = 4; // rgba
            // const bytesPerChannel = ImageChannelRange[usedType];
            // const expectedSize = width * height * numberOfChannels * bytesPerChannel;
            // console.log(width, height)
            // console.log('expectedSize', expectedSize, 'actualSize: ', img.data.byteLength, 'expected length:', width * height * numberOfChannels, 'actual length: ', img.data.length, 'bytes per channel: ', bytesPerChannel);
            this.graphics.updateTexture(textureId, {
                x: 0, y: 0, z: idx,
                data: {
                    width, height,
                    imageData: img.data,
                    channel: {
                        format: usedFormat,
                        dataType: usedType,
                    },
                },
                glFace: GlFace.X + idx
                // bytesPerPixel: 4 * 2, // for HDR 4 channels, 2 bytes per channel
            });
        })

        this.cubeTextures.set(TextureManager.ENV_MAP_TEXTURE_KEY, textureId);
    }

    public getShadowMap(): TextureId {
        return this.globalTextures.get(TextureManager.SHADOW_MAP_TEXTURE_KEY)!;
    }

    public getShadowMapLayer(): number {
        const packed = this.shadowMapPacker.addTexture('shadowMap', Globals.SHADOW_PASS_TEXTURE_SIZE, Globals.SHADOW_PASS_TEXTURE_SIZE);
        return packed.layer;
    }

    // public getShadowMapLayer(): number {
    //     const packed = this.shadowMapPacker.addTexture('shadowMap', 1024, 1024);
    //     console.log('shadowMapLayer', packed);
    //     return packed.layer;
    // }

    public getEnvironmentMap(): TextureId {
        const texture = this.cubeTextures.get(TextureManager.ENV_MAP_TEXTURE_KEY);
        if (texture) {
            return texture;
        }

        const cubeMap = this.graphics.createTexture({
            label: 'env-cube-map',
            image: {
                width: 4096, height: 4096,
                // width: 1024, height: 1024,
                channel: {
                    format: usedFormat,
                    dataType: usedType,
                    // format: 'rgba8unorm',
                    // dataType: 'uint8'
                },
            },
            usage: TextureUsage.TEXTURE_BINDING | TextureUsage.COPY_DST,
            type: TextureType.CUBE_MAP,
            depth: 6,
        });
        this.cubeTextures.set(TextureManager.ENV_MAP_TEXTURE_KEY, cubeMap);
        return cubeMap;
    }

    updateTexture(texture: Texture, data?: TextureData) {
        const { x, y, layer: z, width, height } = this.texturePacker.findTexture(texture.path)!;
        const image = data || texture.imageData;
        const imageData = this.prepareDataForUpload(image);
        this.graphics.updateTexture(texture.id, {
            x, y, z,
            data: {
                imageData,
                width, height,
                channel: {
                    format: 'rgba8unorm',
                    dataType: 'uint8'
                }
            },
        });

    }
    
    public async create1x1Texture(label: string, data: Uint8ClampedArray): Promise<Texture> {
        // public create1x1Texture(label: string, data: Uint8ClampedArray): Promise<TextureArrayIndex> {
        return this.createTextureFromValues(label, data, 1, 1);
    }

    private async createTextureFromValues(label: string, data: Uint8ClampedArray, imgWidth: number, imgHeight: number): Promise<Texture> {
        if (this.cachedTextures.get(label)) {
            console.warn(`Loaded texture from cache: ${label}`)
            return this.cachedTextures.get(label)!;
        }

        const ctx = new OffscreenCanvas(imgWidth, imgHeight).getContext('2d')!;
        ctx.fillStyle = `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${data[3]})`;
        ctx.fillRect(0, 0, imgWidth, imgHeight);
        return ctx.canvas.convertToBlob({ type: 'image/png' })
            .then(createImageBitmap)
            .then(bitmap => {
                const texture = this.createTexture(label, bitmap)
                this.cachedTextures.set(label, texture);
                return texture;
            });
        // const blob = new Blob([data.buffer], { type: 'image/png' });

    }

    public getAllTextures(): Map<string, Texture> {
        return this.cachedTextures;
    }

    public getTextureIndex(texture: Texture): TextureArrayIndex {
        const { layer, uvScaleY, uvScaleX, uvOffsetY, uvOffsetX } = this.texturePacker.findTexture(texture.path)!;
        return {
            textureLayer: layer,
            textureUvScale: vec2.fromValues(uvScaleX, uvScaleY),
            textureUvOffset: vec2.fromValues(uvOffsetX, uvOffsetY)
        };
    }

    public getTexture(id: string): Texture {
        if (!this.cachedTextures.has(id)) {
            console.error(`Texture with id: ${id} is not present`);
            throw new Error(`Cannot get texture: ${id} as its not present in the cache`);
        }

        return this.cachedTextures.get(id)!;
    }

    public addPreloadedToGlobalTexture(id: string, image: TextureData) {
        // return this.promiseQueue.addTask(async () => this._addPreloadedToGlobalTexture(id, image));
        return this._addPreloadedToGlobalTexture(id, image);
    }

    private _addPreloadedToGlobalTexture(id: string, image: TextureData) {
        if (this.cachedTextures.has(id)) {
            console.warn(`Image with id: ${id} is already loaded`)
            return this.cachedTextures.get(id)!;
        }

        const texture = this.createTexture(id, image);
        this.cachedTextures.set(id, texture);

        return texture;
    }

    public async addToGlobalTexture(path: string): Promise<Texture> {
        return this.promiseQueue.addTask(() => this._addToGlobalTexture(path));
    }

    private async _addToGlobalTexture(path: string): Promise<Texture> {
        if (this.cachedTextures.has(path)) {
            return this.cachedTextures.get(path)!;
        }

        const imageData = await this.loadImageAsBitMap(path);
        // const imageData = await this.loadImage(path);
        if (!this.isSupportedSize(imageData.width, imageData.height)) {
            console.error('Texture is not in supported sizes. texture: ', imageData);
            throw new Error('Currently only textures that fit are supported');
        }

        const texture = this.createTexture(path, imageData);
        this.cachedTextures.set(path, texture);

        return texture;
    }

    public getTextureArrayIdForSize(size: TextureSize): TextureId {
        const sizeSerialized = JSON.stringify(size);
        if (!this.globalTextures.has(sizeSerialized)) {
            const textureId = this.graphics.createTexture({
                label: `array-w-${size.width}-h-${size.height}-d-${TextureManager.TEXTURE_ARRAY_LAYERS}`,
                image: {
                    width: size.width, height: size.height,
                    channel: {
                        format: 'rgba8unorm',
                        dataType: 'uint8',
                        // dataType: 'float'
                    }
                },
                // usage: TextureUsage.COPY_DST | TextureUsage.TEXTURE_BINDING,
                usage: TextureUsage.COPY_DST | TextureUsage.TEXTURE_BINDING | TextureUsage.RENDER_ATTACHMENT,
                depth: TextureManager.TEXTURE_ARRAY_LAYERS,
                type: TextureType.TEXTURE_ARRAY,
                // samplingConfig: DefaultSampling
            });
            this.globalTextures.set(sizeSerialized, textureId);
            DebugUtil.addToWindowObject('globalTexture', textureId);

            return textureId;
        }

        return this.globalTextures.get(sizeSerialized)!;
    }

    private createTexture(id: string, image: TextureData): Texture {
        const textureId = this.getTextureArrayIdForSize(TextureManager.MAX_TEXTURE_ARRAY_SIZE);
        const packed = this.texturePacker.addTexture(id, image.width, image.height);

        const {
            width, height, x, y,
            layer, uvScaleX, uvScaleY, uvOffsetX, uvOffsetY
        } = packed;

        const imageData = this.prepareDataForUpload(image); 
            // image instanceof ImageData
            // ? image.data
            // : image instanceof ImageBitmap
            //     ? image
            //     : new Uint8ClampedArray(image.bytes);

        this.graphics.updateTexture(textureId, {
            x, y, z: layer,
            data: {
                imageData,
                width, height,
                channel: {
                    format: 'rgba8unorm',
                    dataType: 'uint8'
                }
            },
        });

        return new Texture(
            textureId, id, image,
            {
                textureLayer: layer,
                textureUvOffset: vec2.fromValues(uvOffsetX, uvOffsetY),
                textureUvScale: vec2.fromValues(uvScaleX, uvScaleY),
            },
            { width, height });
    }

    private prepareDataForUpload(image: ImageBitmap | ImageData | { width: number; height: number; bytes: ArrayBufferLike }) {
        return image instanceof ImageData
            ? image.data
            : image instanceof ImageBitmap
                ? image
                : new Uint8ClampedArray(image.bytes);
    }

    private async loadImageAsBitMap(path: string): Promise<ImageBitmap> {
        return fetch(path)
            .then(res => res.blob())
            .then(blob => createImageBitmap(blob))
    }

    private async loadImage(path: string): Promise<ImageData> {
        return fetch(path)
            .then(res => res.blob())
            .then(createImageBitmap)
            .then(this.loadFromOffScreenCanvas);
    }

    private loadFromOffScreenCanvas(img: HTMLImageElement | ImageBitmap): ImageData {
        const canvas = new OffscreenCanvas(img.width, img.height);

        canvas.width = img.width;
        canvas.height = img.height;

        const context = canvas.getContext('2d', { willReadFrequently: true })!;
        context.drawImage(img, 0, 0, img.width, img.height);

        return context.getImageData(0, 0, img.width, img.height/*, { colorSpace: 'srgb' }*/);
    }

    private isSupportedSize(width: number, height: number) {
        return 1024 % width === 0 || 1024 % height === 0;
    }
}
