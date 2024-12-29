export interface GLBWorkerRequest {
    buffer: ArrayBuffer,
    mimeType: string,
}

export interface GLBWorkerResponse {
    imageBitmap: ImageBitmap;
    // data: ArrayBuffer,
    // width: number,
    // height: number,
}

self.onmessage = (event: MessageEvent<GLBWorkerRequest>) => {
    const { buffer, mimeType } = event.data;
    const view = new DataView(buffer);
    switch (mimeType) {
        case 'image/png' : {
            // const width = view.getUint32(16, false);  // Read width at byte 16
            // const height = view.getUint32(20, false); // Read height at byte 20
            const blob = new Blob([view.buffer], { type: mimeType })
            // const ctx = getCanvasContext(width, height, self.name);
            createImageBitmap(blob)
                .then(imageBitmap => {
                    self.postMessage(
                        { imageBitmap },
                        { transfer: [imageBitmap] });
                    
                    // ctx.drawImage(imageBitmap, 0, 0)
                    // const imageData = ctx.getImageData(0, 0, width, height);
                    // self.postMessage(
                    //     { data: imageData.data.buffer, width, height },
                    //     { transfer: [imageData.data.buffer] });
                });
            break;
        }
        case 'image/jpeg': {
            const blob = new Blob([view.buffer], { type: mimeType });
            createImageBitmap(blob)
                .then(imageBitmap => {
                    self.postMessage(
                        { imageBitmap },
                        { transfer: [imageBitmap] });
                });
            break;
                    
            // let i = 0;
            // while (i < view.byteLength) {
            //     // JPEG segment marker
            //     if (view.getUint8(i) === 0xFF && view.getUint8(i + 1) === 0xC0) {
            //         // Skip the 2-byte marker and the length of the segment
            //         const length = view.getUint16(i + 2, false);
            //         // The width and height are stored at byte 5 and 6 of the segment
            //         const height = view.getUint16(i + 5, false);
            //         const width = view.getUint16(i + 7, false);
            //         const blob = new Blob([view.buffer], { type: mimeType });
            //         createImageBitmap(blob)
            //             .then(bitmap => {
            //                 const ctx = getCanvasContext(width, height, self.name);
            //                 ctx.drawImage(bitmap, 0, 0);
            //                 const imageData = ctx.getImageData(0, 0, width, height);
            //                 self.postMessage(
            //                     { data: imageData.data.buffer, width, height },
            //                     { transfer: [imageData.data.buffer] });
            //             });
            //         return;
            //     }
            //     i++;
            // }
            // console.error(`JPEG dimensions not found: ${i}`)
            // throw new Error("JPEG dimensions not found.");
        }
        default: {
            console.error('Unmapped mime type: ', mimeType)
            throw new Error('Unmapped mime type: ' + mimeType);
        }
    }
}

const canvases: Record<string, OffscreenCanvas> = {}

function getCanvasContext(width: number, height: number, name: string) {
    let canvas = canvases[name];
    if (!canvas) {
        canvas = new OffscreenCanvas(width, height);
        canvases[name] = canvas;
    }

    if (canvas.width !== width) {
        console.warn('resizing canvas, if there are problems, check this');
        canvas.width = width;
    }

    if (canvas.height !== height) {
        console.warn('resizing canvas, if there are problems, check this');
        canvas.height = height;
    }

    return canvas.getContext('2d', { willReadFrequently: true })!;
}
