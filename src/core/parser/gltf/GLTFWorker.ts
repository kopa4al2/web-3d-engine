export interface GLTFWorkerRequest {
    uri: string,
}

export interface GLTFWorkerResponse {
    // img: ImageBitmap,
    data: ArrayBuffer,
    width: number,
    height: number,
}

self.onmessage = (event: MessageEvent<GLTFWorkerRequest>) => {
    const { data } = event;
    fetch(data.uri)
        .then(response => response.blob())
        .then(blob => createImageBitmap(blob))
        .then(bitmap => {
            const width = bitmap.width;
            const height = bitmap.height;
            const canvas = getCanvas(width, height);
            const context = canvas.getContext('2d', { willReadFrequently: true })!;
            context.drawImage(bitmap, 0, 0);

            const imageData = context.getImageData(0, 0, width, height);
            self.postMessage({
                // img: bitmap,
                width, height,
                data: imageData.data.buffer
            }, { transfer: [imageData.data.buffer] });
        });
}

let canvas: OffscreenCanvas;

function getCanvas(width: number, height: number): OffscreenCanvas {
    return new OffscreenCanvas(width, height);
    
    if (!canvas) {
        canvas = new OffscreenCanvas(width, height);
    }

    if (canvas.width !== width) {
        canvas.width = width;
    }

    if (canvas.height !== height) {
        canvas.height = height;
    }

    return canvas;
}
