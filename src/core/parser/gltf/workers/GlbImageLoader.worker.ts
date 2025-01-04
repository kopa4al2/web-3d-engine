export interface GLBWorkerRequest {
    buffer: ArrayBuffer,
    mimeType: string,
}

export interface GLBWorkerResponse {
    imageBitmap: ImageBitmap;
}

self.onmessage = (event: MessageEvent<GLBWorkerRequest>) => {
    const { buffer, mimeType } = event.data;
    const view = new DataView(buffer);
    switch (mimeType) {
        case 'image/png' : {
            const blob = new Blob([view.buffer], { type: mimeType })
            createImageBitmap(blob)
                .then(imageBitmap => {
                    self.postMessage(
                        { imageBitmap },
                        { transfer: [imageBitmap] });
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
        }
        default: {
            console.error('Unmapped mime type: ', mimeType)
            throw new Error('Unmapped mime type: ' + mimeType);
        }
    }
}