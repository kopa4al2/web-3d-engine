export interface GLTFWorkerRequest {
    uri: string,
}

export interface GLTFWorkerResponse {
    imageBitmap: ImageBitmap,
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