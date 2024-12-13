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
}