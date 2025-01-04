export interface GLTFWorkerRequest {
    uri: string,
}

export interface GLTFWorkerResponse {
    imageBitmap: ImageBitmap,
    // data: ArrayBuffer,
    // width: number,
    // height: number,
}

self.onmessage = (event: MessageEvent<GLTFWorkerRequest>) => {
    const { data } = event;
    fetch(data.uri, { cache: 'force-cache'})
        .then(response => response.blob())
        .then(blob => createImageBitmap(blob))
        .then(bitmap => {
            self.postMessage({
            imageBitmap: bitmap,
            }, { transfer: [bitmap] });
        });
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
