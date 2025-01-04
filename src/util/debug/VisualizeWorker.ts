export interface VisualizeWorkerResponse {
    result: ArrayBuffer
}

export interface VisualizeWorkerRequest {
    buffer: ArrayBuffer,
    from?: number,
    to?: number,
}

self.onmessage = (event: MessageEvent<VisualizeWorkerRequest>) => {
    const { data } = event;
    const buffer = new Float32Array(data.buffer);
    const from = data.from || 0;
    const to = data.buffer || buffer.byteLength;


    let minDepth = Infinity;
    let maxDepth = -Infinity;

    for (let i = 0; i < buffer.length; i++) {
        // if (buffer[i] < minDepth) {return;}
        if (buffer[i] < minDepth) minDepth = buffer[i];
        if (buffer[i] > maxDepth) maxDepth = buffer[i];
    }

    // console.log(`(${minDepth}, ${maxDepth})`)

    // const canvas = new OffscreenCanvas(512, 512);
    // const ctx = canvas.getContext('2d');
    const imageData = new ImageData(512, 512);
    for (let i = 0; i < buffer.length; i++) {
        const depth = buffer[i];
        // const normalizedDepth = linearizeDepth(depth, 0.1, 100.0);
        const normalizedDepth = (depth - minDepth) / (maxDepth - minDepth);
        const intensity = Math.floor(normalizedDepth * 255); // Map depth [0, 1] to [0, 255]
        const pixelIndex = i * 4;
        imageData.data[pixelIndex] = intensity; // Red
        imageData.data[pixelIndex + 1] = intensity; // Green
        imageData.data[pixelIndex + 2] = intensity; // Blue
        imageData.data[pixelIndex + 3] = 255; // Alpha
    }

    //         const imageData = context.getImageData(0, 0, width, height);
    self.postMessage({
        result: imageData.data.buffer
    }, { transfer: [imageData.data.buffer] });
}
