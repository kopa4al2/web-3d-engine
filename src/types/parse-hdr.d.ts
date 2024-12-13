declare module 'parse-hdr' {
    export interface HDRImageData {
        data: Float32Array;
        shape: [number, number];
        exposure: number;
        gamma: number;
    }

    export default function parseHDR(buffer: ArrayBuffer): HDRImageData;
}