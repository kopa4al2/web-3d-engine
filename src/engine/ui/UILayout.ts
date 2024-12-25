import * as CamerakitPlugin from '@tweakpane/plugin-camerakit';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import * as TweakpaneRotationInputPlugin from '@0b5vr/tweakpane-plugin-rotation';
import { Pane } from 'tweakpane';
import interact from 'interactjs';
import { SdiPluginBundle } from './custom/Label';

// ROTATION PLUGIN
// https://github.com/0b5vr/tweakpane-plugin-rotation?tab=readme-ov-file
export default class UILayout {

    private readonly _pane: Pane;

    constructor(private parent: HTMLElement, title?: string) {
        this._pane = this.createPane(parent, title);
    }

    get pane() {
        return this._pane;
    }

    newPane(title: string) {
        return this.createPane(this.parent, title);
    }

    addFolder(title: string, expanded = true) {
        return this._pane.addFolder({ title, expanded });
    }

    addTabs(...titles: string[]) {
        return this._pane.addTab({ pages: titles.map(title => ( { title } )) });
        // return this.pane.addTab({ pages: [{ title }] });
    }

    addBlade(title: string, params: Record<string, unknown>) {
        return this._pane.addBlade({ title, ...params })
    }

    private createPane(parent: HTMLElement, title?: string) {
        const menu = ( parent.querySelector('.menu') || parent ) as HTMLElement;
        const container = document.createElement('div');
        menu.appendChild(container);
        
        const pane = new Pane({ container, title, expanded: true });
        // pane.registerPlugin(SdiPluginBundle);
        pane.registerPlugin(TweakpaneRotationInputPlugin);
        pane.registerPlugin(EssentialsPlugin);

        return pane;
    }
}
