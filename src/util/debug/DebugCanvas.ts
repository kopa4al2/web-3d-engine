import Graphics from "core/Graphics";
import Texture, { TextureData, TextureId } from "core/texture/Texture";
import PromiseQueue from "core/utils/PromiseQueue";
import WorkerPool from "core/worker/WorkerPool";
import interact from "interactjs";
import Canvas from "../../Canvas";
import DebugUtil from "./DebugUtil";
import { VisualizeWorkerRequest, VisualizeWorkerResponse } from "./VisualizeWorker";

export type TextureType = 'depth' | 'normal'

class DebugCanvas {
    public static canvasWidth = 512;
    public static canvasHeight = 512;

    private static canvas: HTMLCanvasElement;
    private static context: CanvasRenderingContext2D;

    // private static workers = new WorkerPool<VisualizeWorkerRequest, VisualizeWorkerResponse>(
    //     () => new Worker(new URL('./VisualizeWorker.ts', import.meta.url), { name: 'Canvas-Worker' }), 1);

    public static debugTexture(texture: Texture | { imageData: TextureData, size: { width: number, height: number } }) {
        const ctx = this.getContext();

        if (!texture.imageData) {
            console.warn('No image attached to texture: ', texture);
            return;
        }
        const img: ImageData | ImageBitmap = texture.imageData instanceof ArrayBuffer
            ? new ImageData(new Uint8ClampedArray(texture.imageData), texture.size.width, texture.size.height)
            : texture.imageData as (ImageBitmap | ImageData);

        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        if (img instanceof ImageBitmap) {
            ctx.drawImage(img, 0, 0);
        } else {
            ctx.putImageData(img, 0, 0);
        }
    }


    public static visualizeDepth(buffer: ArrayBuffer, width: number, height: number) {
        const context = this.getContext();
        // const imageData = context.createImageData(width, height);
        const imageData = new ImageData(width, height);
        const data = new Float32Array(buffer);
        const minDepth = 0.8;
        const maxDepth = 1.00;
        // let minDepth = Infinity;
        // let maxDepth = -Infinity;
        // for (let i = 0; i < data.length; i++) {
            // if (data[i] < minDepth) minDepth = data[i];
            // if (data[i] > maxDepth) maxDepth = data[i];
        // }
        // console.log(`(${minDepth}, ${maxDepth})`)

        for (let i = 0; i < data.length; i++) {
            const depth = data[i];
            // const normalizedDepth = linearizeDepth(depth, 0.1, 100.0);
            const normalizedDepth = (depth - minDepth) / (maxDepth - minDepth);
            const intensity = Math.floor(normalizedDepth * 255); // Map depth [0, 1] to [0, 255]
            const pixelIndex = i * 4;
            imageData.data[pixelIndex] = intensity; // Red
            imageData.data[pixelIndex + 1] = intensity; // Green
            imageData.data[pixelIndex + 2] = intensity; // Blue
            imageData.data[pixelIndex + 3] = 255; // Alpha
        }

        createImageBitmap(imageData).then(d => {
            context.clearRect(0, 0, this.canvas.width, this.canvas.height);
            context.drawImage(d, 0, 0, width, height, 0, 0, this.canvasWidth, this.canvasHeight);
        });
    }

    public static getContext() {
        if (!this.canvas) {
            const canvas = document.createElement('canvas');
            this.canvas = canvas;
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
