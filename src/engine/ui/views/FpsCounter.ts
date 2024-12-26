// @ts-nocheck
import UILayout from "../UILayout";

export default class FpsCounter {

    private counter;

    constructor(layout: UILayout) {
        this.counter = layout.getTopLevelContainer('FPS')
            .addBlade({ view: 'fpsgraph', label: 'fps', rows: 1 })
    }

    tick() {
        this.counter.end();
        this.counter.begin();
    }
}
