import { vec3 } from "gl-matrix";
import DebugCanvas from "./DebugCanvas";

export default class BufferUtils {
    private constructor() {
    }

    public static writeFloatArray(dataView: DataView, byteOffset: number, array: ArrayLike<number>): number {
        for (let i = 0; i < array.length; i++) {
            // Little-endian
            dataView.setFloat32(byteOffset, array[i], true);
            // Each float is 4 bytes
            byteOffset += Float32Array.BYTES_PER_ELEMENT;
        }
        // Return the next available byte offset
        return byteOffset;
    }

    public static writeUint32Array(dataView: DataView, byteOffset: number, array: ArrayLike<number>): number {
        for (let i = 0; i < array.length; i++) {
            // Little-endian
            dataView.setUint32(byteOffset, array[i], true);
            // Each float is 4 bytes
            byteOffset += Uint32Array.BYTES_PER_ELEMENT;
        }
        // Return the next available byte offset
        return byteOffset;
    }

    public static mergeFloat32Arrays(arrays: (Float32Array | number[])[]): Float32Array {
        const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
        const result = new Float32Array(totalLength);

        let offset = 0;
        for (const arr of arrays) {
            result.set(arr, offset);
            offset += arr.length;
        }

        return result;
    }

    public static parseVertexAttribToImage(attribute: number[], numberOfElements: number) {
        if (attribute.length % numberOfElements !== 0) {
            console.warn(`Attribute with length: ${ attribute.length } does not divide by: ${ numberOfElements }`)
        }

        const numOfVertices = attribute.length / numberOfElements;
        const width = Math.ceil(Math.sqrt(numOfVertices));
        const height = Math.ceil(numOfVertices / width);

        const targetWidth = 256;
        const targetHeight = 256;

        console.log(`Num of vertices: ${ numOfVertices } width: ${ width } height: ${ height }`);

        const canvas = new OffscreenCanvas(targetWidth, targetHeight);
        const ctx = canvas.getContext('2d')!;
        const imgData = ctx.createImageData(targetWidth, targetHeight);
        const data = imgData.data;

        const scaleX = width / targetWidth;
        const scaleY = height / targetHeight;

        for (let y = 0; y < targetHeight; y++) {
            for (let x = 0; x < targetWidth; x++) {
                // Map target pixel to original grid
                const originalX = x * scaleX;
                const originalY = y * scaleY;

                const r = interpolate(attribute, width, originalX, originalY, 0);
                const g = interpolate(attribute, width, originalX, originalY, 1);
                const b = interpolate(attribute, width, originalX, originalY, 2);

                const pixelIdx = (y * targetWidth + x) * 4;
                data[pixelIdx] = Math.floor((r + 1) * 0.5 * 255); // R
                data[pixelIdx + 1] = Math.floor((g + 1) * 0.5 * 255); // G
                data[pixelIdx + 2] = Math.floor((b + 1) * 0.5 * 255); // B
                data[pixelIdx + 3] = 255; // Alpha
            }
        }

        function interpolate(normals: number[], width: number, x: number, y: number, channel: number) {
            const x0 = Math.floor(x);
            const x1 = Math.min(x0 + 1, width - 1);
            const y0 = Math.floor(y);
            const y1 = Math.min(y0 + 1, width - 1);

            const tx = x - x0;
            const ty = y - y0;

            const n00 = normals[(y0 * width + x0) * 3 + channel];
            const n10 = normals[(y0 * width + x1) * 3 + channel];
            const n01 = normals[(y1 * width + x0) * 3 + channel];
            const n11 = normals[(y1 * width + x1) * 3 + channel];

            return (1 - tx) * (1 - ty) * n00 +
                tx * (1 - ty) * n10 +
                (1 - tx) * ty * n01 +
                tx * ty * n11;
        }

        ctx.putImageData(imgData, 0, 0)
        return imgData;
    }
}
