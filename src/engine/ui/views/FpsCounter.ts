// @ts-nocheck
import RightMenu from "../RightMenu";

export default class FpsCounter {

    public static counter;

    static begin() {
        this.counter.begin();
    }

    static end() {
        this.counter.end();
    }

    constructor(layout: RightMenu) {
        // this.counter = layout.getTopLevelContainer('FPS')
        //     .addBlade({ view: 'fpsgraph', label: 'fps', rows: 1 })
    }

    tick() {
        // this.counter.end();
        // this.counter.begin();
    }
}
