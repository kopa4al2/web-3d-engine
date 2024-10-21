import { GPUContext } from "core/Graphics";

export default class WebGPUContext implements GPUContext {
    ctx: GPUCanvasContext;
    constructor(ctx: GPUCanvasContext) {
        this.ctx = ctx;
    }


}