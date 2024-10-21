import Canvas from "../Canvas";

export default class WebGPUContextOld {

    private constructor(public readonly device: GPUDevice,
                        public readonly context: GPUCanvasContext,
                        public readonly depthTexture: GPUTexture) {

    }

    public static async initWebGPU(canvas: Canvas): Promise<WebGPUContextOld> {
        const context = canvas.getWebGpuContext();
        const adapter = await navigator?.gpu?.requestAdapter();

        if (!context || !adapter) {
            throw 'WebGPU is not supported';
        }

        const device = await adapter.requestDevice();
        const swapChainFormat = 'bgra8unorm';
        context.configure({
            device: device,
            format: swapChainFormat,
        });
        /*context.configure({
            device: device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: 'premultiplied'
        });*/

        const depthTexture = device.createTexture({
            size: [canvas.width, canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });

        return new WebGPUContextOld(device, context, depthTexture)
    }
}