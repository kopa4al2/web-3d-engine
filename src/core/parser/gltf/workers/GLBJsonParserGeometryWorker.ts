export interface GlbGeometryParseRequest {
    // bufferView: number,
    bufferInfo: ArrayBuffer,
    buffer: ArrayBuffer,
    // debugData: any,
}

self.onmessage = async (event: MessageEvent<GlbGeometryParseRequest>) => {
    const bufferInfo = event.data.bufferInfo;
    const buffer = event.data.buffer;
    const view = new Uint32Array(bufferInfo);

    // const data: RequestBufferLayout[] = [];
    const parsedBuffers: ArrayBuffer[] = [];

    for (let i = 0; i < view.length; i += 5) {
        const start = view[i];
        const componentType = view[i + 1];
        const count = view[i + 2];
        const elementsPerVertex = view[i + 3];
        const stride = view[i + 4];

        // console.groupCollapsed('WORKER')
        // console.log(' DEBUG ', event.data.debugData)
        parsedBuffers.push(parseAccessor(buffer,
            start,
            componentType,
            elementsPerVertex,
            count,
            stride
        ));
        // console.groupEnd()

    }

    self.postMessage(parsedBuffers, { transfer: parsedBuffers });
}

function parseAccessor(buffer: ArrayBuffer, start: number, componentType: number,
                       elementsPerVertex: number, totalVertices: number, stride: number): ArrayBuffer {
    const componentSize = getBytesPerElement(componentType);
    const bytesPerVertex = componentSize * elementsPerVertex;
    if (stride === 0) {
        stride = bytesPerVertex;
    }

    const sourceBuffer = new DataView(buffer);
    const targetBuffer = new ArrayBuffer(totalVertices * bytesPerVertex);
    const targetBufferView = new DataView(targetBuffer);
    // console.log(`Start: ${start};componentSize:${componentSize};elementsPerVertex: ${elementsPerVertex}; totalVertices: ${totalVertices}; stride: ${stride}`,
    //     sourceBuffer.byteLength, targetBuffer.byteLength);

    for (let i = 0; i < totalVertices; i++) {
        const offset = start + i * stride;

        for (let j = 0; j < elementsPerVertex; j++) {
            const sourceOffset = offset + j * componentSize;
            const targetOffset = i * bytesPerVertex + j * componentSize;

            setData(componentType, sourceBuffer, targetBufferView, sourceOffset, targetOffset);
        }
    }

    return targetBuffer;
}

function setData(componentType: number,
                 sourceBuffer: DataView<ArrayBuffer>,
                 targetBuffer: DataView<ArrayBuffer>,
                 sourceOffset: number,
                 targetOffset: number) {
    switch (componentType) {
        case 5120 :
            targetBuffer.setInt8(targetOffset, sourceBuffer.getInt8(sourceOffset));
            break;
        case 5121 :
            targetBuffer.setUint8(targetOffset, sourceBuffer.getUint8(sourceOffset));
            break;
        case 5122 :
            targetBuffer.setInt16(targetOffset, sourceBuffer.getInt16(sourceOffset, true), true);
            break;
        case 5123 :
            targetBuffer.setUint16(targetOffset, sourceBuffer.getUint16(sourceOffset, true), true);
            break;
        case 5125 :
            targetBuffer.setUint32(targetOffset, sourceBuffer.getUint32(sourceOffset, true), true);
            break;
        case 5126 :
            targetBuffer.setFloat32(targetOffset, sourceBuffer.getFloat32(sourceOffset, true), true);
            break;
    }
}

function getBytesPerElement(componentType: number): number {
    switch (componentType) {
        case 5120: // BYTE
        case 5121: // UNSIGNED_BYTE
            return 1;
        case 5122: // SHORT
        case 5123: // UNSIGNED_SHORT
            return 2;
        case 5125: // UNSIGNED_INT
        case 5126: // FLOAT
            return 4;
        default:
            throw new Error(`Unsupported componentType: ${componentType}`);
    }
}