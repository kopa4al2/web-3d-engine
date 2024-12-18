import UILayout from "../UILayout";

export default class FpsCounter {

    private counter;

    constructor(private layout: UILayout) {
        const folder = layout.newPane('FPS');
        this.counter = folder.addBlade( { view: 'fpsgraph', label: 'fps graph', rows: 2, expanded: false })
    }

    tick() {
        // @ts-ignore
        this.counter.end();
        // @ts-ignore
        this.counter.begin();
    }
}
