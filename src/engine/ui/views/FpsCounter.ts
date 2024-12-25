import UILayout from "../UILayout";

export default class FpsCounter {

    private counter;

    constructor(private layout: UILayout) {
        const folder = layout.addFolder('FPS', true);
        // const folder = layout.newPane('FPS');
        this.counter = folder.addBlade({ view: 'fpsgraph', label: 'fps', rows: 1 })
    }

    tick() {
        // @ts-ignore
        this.counter.end();
        // @ts-ignore
        this.counter.begin();
    }
}
