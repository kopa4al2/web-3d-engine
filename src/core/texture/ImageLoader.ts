export interface SdiImage {
    data: ArrayBuffer,
    width: number,
    height: number,
}

export enum ImageFormat {
    PNG,
    JPEG,
}

export default class ImageLoader {


    public parseArrayBufferToImage(arrayBuffer: ArrayBuffer, imageFormat: ImageFormat): SdiImage {
        createImageBitmap(new Blob([arrayBuffer])).then(res => {
            // console.log('Created image bitmap', res);
            const canvas = new OffscreenCanvas(res.width, res.height)
            const context = canvas.getContext('2d', { willReadFrequently: true })!;
            context.drawImage(res, 0, 0, res.width, res.height);

            const imgData = context.getImageData(0, 0, res.width, res.height/*, { colorSpace: 'srgb' }*/);
            // console.log('Arraybuffer length: ', arrayBuffer.byteLength, ' bitmap length: ', imgData.data.byteLength)
        });
        if (imageFormat === ImageFormat.JPEG) {
            const dataView = new DataView(arrayBuffer);

            // Check the JPEG signature (first 2 bytes should be 0xFFD8)
            if (dataView.getUint8(0) !== 0xff || dataView.getUint8(1) !== 0xd8) {
                throw new Error('Not a valid JPEG file');
            }

            let offset = 2; // Start after the initial marker
            while (offset < dataView.byteLength) {
                const marker = dataView.getUint16(offset, false); // Big-endian marker
                offset += 2;

                // Skip non-SOF markers (e.g., APPn, COM, etc.)
                if (marker >= 0xffc0 && marker <= 0xffcf && marker !== 0xffc4 && marker !== 0xffcc) {
                    offset += 3; // Skip precision byte
                    const height = dataView.getUint16(offset, false); // 2-byte height
                    const width = dataView.getUint16(offset + 2, false); // 2-byte width
                    return { data: arrayBuffer, width, height };
                } else {
                    const length = dataView.getUint16(offset, false); // Length of the segment
                    offset += length;
                }
            }

            throw new Error('No SOF marker found in JPEG file');
        } else if (imageFormat === ImageFormat.PNG) {
            const dataView = new DataView(arrayBuffer);

            // Check the PNG signature (first 8 bytes)
            const isPng =
                dataView.getUint8(0) === 0x89 &&
                dataView.getUint8(1) === 0x50 &&
                dataView.getUint8(2) === 0x4e &&
                dataView.getUint8(3) === 0x47 &&
                dataView.getUint8(4) === 0x0d &&
                dataView.getUint8(5) === 0x0a &&
                dataView.getUint8(6) === 0x1a &&
                dataView.getUint8(7) === 0x0a;

            if (!isPng) {
                throw new Error('Not a valid PNG file');
            }

            // The IHDR chunk starts at byte 8
            const width = dataView.getUint32(16); // Width is a 4-byte big-endian integer
            const height = dataView.getUint32(20); // Height is a 4-byte big-endian integer

            return { data: arrayBuffer, width, height };
        }

        throw new Error('Unknown image format: ' + imageFormat);

    }
}