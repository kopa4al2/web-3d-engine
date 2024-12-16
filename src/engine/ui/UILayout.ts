import * as CamerakitPlugin from '@tweakpane/plugin-camerakit';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import { Pane } from 'tweakpane';

// ROTATION PLUGIN
// https://github.com/0b5vr/tweakpane-plugin-rotation?tab=readme-ov-file
export default class UILayout {

    private readonly _pane: Pane;

    constructor(title: string, parent: HTMLElement) {
        const container = (parent.querySelector('.menu') || parent) as HTMLElement;
        this._pane = new Pane({ container, title });
        this._pane.registerPlugin(EssentialsPlugin);
        this._pane.registerPlugin(CamerakitPlugin);
    }

    get pane() {
        return this._pane;
    }

    addFolder(title: string, expanded = true) {
        return this._pane.addFolder({ title, expanded });
    }
    addTabs(...titles: string[]) {
        return this._pane.addTab({ pages: titles.map(title => ({ title })) });
        // return this.pane.addTab({ pages: [{ title }] });
    }

    addBlade(title: string, params: Record<string, unknown>) {
        return this._pane.addBlade({ title, ...params })
    }
}