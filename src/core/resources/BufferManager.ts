import Graphics from "core/Graphics";
import { BufferData, BufferId, BufferUsage } from "core/resources/gpu/BufferDescription";
import { ShaderStructName } from "core/resources/ShaderStruct";


/**
 * Manages global buffer (creation / caching / binding / data layout)
 */
export default class BufferManager {

    private buffers: Map<string, number> = new Map();
    public globalBuffers: Map<ShaderStructName, BufferId> = new Map();
    // public readonly staticGlobalBuffer: BufferId;
    // private readonly dynamicGlobalBuffer: BufferId;
    public constructor(private graphics: Graphics) {
        this.globalBuffers.set('Camera', graphics.createBuffer({
            byteLength: 80,
            label: 'Camera',
            usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
        }));
        this.globalBuffers.set('Light', graphics.createBuffer({
            // byteLength: 2048,
            byteLength: 464,
            label: 'Light',
            usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
        }));
        this.globalBuffers.set('Time', graphics.createBuffer({
            byteLength: 16,
            label: 'Time',
            usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
        }));
    }


    public writeToGlobalBuffer(struct: ShaderStructName, data: BufferData) {
        if (struct === 'Camera') {
            // console.log(data)
             // for (let i = 32; i < data.length; i++) {
            //     data[i] = 0;
            // }
        }
        this.graphics.writeToBuffer(this.globalBuffers.get(struct)!, data);
        // console.log(`Write to ${struct}: `, [...data])
        return;
        if (struct === 'Camera') {
            this.graphics.writeToBuffer(this.globalBuffers.get(struct)!, data);
        } else if (struct === 'Light') {
            // console.log('Light direction: ', data)
            this.graphics.writeToBuffer(this.globalBuffers.get(struct)!, data, 80)
        } else if (struct === 'Time') {
            // this.graphics.writeToBuffer(this.globalBuffers.get(struct)!, data, 112)
            this.graphics.writeToBuffer(this.globalBuffers.get(struct)!, data, 112)
        } else {
            console.warn(`UNKNOWN STRUCT: ${struct}`);
        }
    }

    public static mergeFloat32Arrays(arrays: (Float32Array | number[])[]): Float32Array {
        // console.log(`Will merge arrays: ${arrays[0].length} and ${arrays[1].length} and ${arrays[2]?.length}`)
        // Calculate the total length of the resulting array
        const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
        // console.log('TOtal length:', totalLength)
        // Create a new Float32Array with the total length
        const result = new Float32Array(totalLength);

        // Keep track of the current write position in the result array
        let offset = 0;

        // Copy each array into the result array
        for (const arr of arrays) {
            result.set(arr, offset); // Float32Array.set works for both TypedArrays and number[]
            offset += arr.length;
        }

        return result;
    }
}
