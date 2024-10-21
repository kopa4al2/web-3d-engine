import { GraphicsDevice } from "core/Graphics";

export default class WebGPUDevice implements GraphicsDevice {
    constructor(public gpuDevice: GPUDevice) {
        this.gpuDevice = gpuDevice;
    }
}