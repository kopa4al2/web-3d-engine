import UILayout from "../UILayout";

export default class CameraUI {
    private counter;

    constructor(private layout: UILayout) {
        this.counter = layout.addBlade('FPS', { view: 'fpsgraph', label: 'FPS', rows: 1 })
    }

    tick() {
        // @ts-ignore
        this.counter.end();
        // @ts-ignore
        this.counter.begin();
    }
}