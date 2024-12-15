import Graphics from 'core/Graphics';
import { BufferData, BufferId, BufferUsage } from 'core/resources/gpu/BufferDescription';
import { ShaderStructName } from 'core/resources/shader/ShaderStruct';


/**
 * Manages global buffer (creation / caching / binding / data layout)
 */
export default class BufferManager {

    public globalBuffers: Map<ShaderStructName, BufferId> = new Map();

    public constructor(private graphics: Graphics) {
        this.globalBuffers.set('Camera', graphics.createBuffer({
            byteLength: 256,
            // byteLength: 80,
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
        this.graphics.writeToBuffer(this.globalBuffers.get(struct)!, data);
        return;
    }
}
