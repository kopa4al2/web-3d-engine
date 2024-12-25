import Graphics from "core/Graphics";
import Texture, { TextureId } from "core/texture/Texture";
import interact from "interactjs";
import Canvas from "../Canvas";
import DebugUtil from "./DebugUtil";

export type TextureType = 'depth' | 'normal'

class DebugCanvas {
    public static canvasWidth = 512;
    public static canvasHeight = 512;

    private static canvas: HTMLCanvasElement;
    private static context: CanvasRenderingContext2D;

    public static getScaledContext() {
        return this.getContext();
        // return new ScaledContext(this.canvas, this.context);
    }

    public static debugTexture(texture: Texture) {
        const ctx = this.getContext();

        if (!texture.imageData) {
            console.warn('No image attached to texture: ', texture);
            return;
        }
        const img: ImageData | ImageBitmap = texture.imageData instanceof ArrayBuffer
            ? new ImageData(new Uint8ClampedArray(texture.imageData), texture.size.width, texture.size.height)
            : texture.imageData as (ImageBitmap | ImageData);

        if (img instanceof ImageBitmap) {
            ctx.drawImage(img, 0, 0);
        } else {
            ctx.putImageData(img, 0, 0);
        }
    }

    public static async debug(
        graphics: Graphics,
        texture: { id: TextureId, width: number, height: number },
        type: TextureType = 'depth') {

        if (!graphics._getTextureData) {
            console.warn('_getTextureData is not implemented in graphics, skipping ', graphics);
            return;
        }

        const textureData = await graphics._getTextureData(texture.id);

        if (type === 'depth') {
            return this.visualizeDepth(textureData, texture.width, texture.height);
        } else if (type === 'normal') {
            const blob = new Blob([textureData]);
            const bitmap = await createImageBitmap(blob);
            this.getContext().drawImage(bitmap, 0, 0);
        }
    }

    public static async visualizeDepth(data: Float32Array, width: number, height: number) {
        const context = this.getContext();
        const imageData = context.createImageData(width, height);
        for (let i = 0; i < data.length; i++) {
            const depth = data[i];
            const intensity = Math.floor(depth * 255); // Map depth [0, 1] to [0, 255]
            const pixelIndex = i * 4;
            imageData.data[pixelIndex] = intensity; // Red
            imageData.data[pixelIndex + 1] = intensity; // Green
            imageData.data[pixelIndex + 2] = intensity; // Blue
            imageData.data[pixelIndex + 3] = 255; // Alpha
        }

        context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        context.putImageData(imageData, 0, 0);
    }

    public static getContext() {
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            const canvas = document.createElement('canvas');
            canvas.style.zIndex = '999';
            canvas.style.position = 'absolute';
            canvas.style.top = '50px';
            canvas.style.left = '50px';
            canvas.style.boxShadow = '2px 2px 5px black';
            canvas.width = this.canvasWidth;
            canvas.height = this.canvasHeight;
            document.body.appendChild(canvas);


            // const position = { x: 0, y: 0 };
            const position = canvas.getBoundingClientRect();
            interact(canvas)
                .draggable({
                    listeners: {
                        move(event) {
                            position.x += event.dx
                            position.y += event.dy

                            event.target.style.transform = `translate(${position.x}px, ${position.y}px)`;
                        },
                    }
                });
                // .resizable({
                //     edges: { top: true, left: true, bottom: true, right: true },
                //     listeners: {
                //         move: function (event) {
                //             let { x, y } = event.target.dataset
                //
                //             x = ( parseFloat(x) || 0 ) + event.deltaRect.left
                //             y = ( parseFloat(y) || 0 ) + event.deltaRect.top
                //
                //             Object.assign(event.target.style, {
                //                 width: `${event.rect.width}px`,
                //                 height: `${event.rect.height}px`,
                //                 transform: `translate(${x}px, ${y}px)`
                //             })
                //
                //             Object.assign(event.target.dataset, { x, y })
                //         }
                //     }
                // });


            this.context = canvas.getContext('2d', { willReadFrequently: true })!;
        }

        return this.context;
    }
}

DebugUtil.addToWindowObject('debugCanvas', DebugCanvas);
export default DebugCanvas;