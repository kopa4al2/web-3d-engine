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
        
        const position = { x: 0, y: 0 };
        // interact(container)
        //     .draggable({
        //         listeners: {
        //             move(event) {
        //                 position.x += event.dx
        //                 position.y += event.dy
        //
        //                 event.target.style.transform = `translate(${position.x}px, ${position.y}px)`;
        //             },
        //         }
        //     })
        //     .resizable({
        //         edges: { top: true, left: true, bottom: true, right: true },
        //         listeners: {
        //             move: function (event) {
        //                 let { x, y } = event.target.dataset
        //
        //                 x = ( parseFloat(x) || 0 ) + event.deltaRect.left
        //                 y = ( parseFloat(y) || 0 ) + event.deltaRect.top
        //
        //                 Object.assign(event.target.style, {
        //                     width: `${event.rect.width}px`,
        //                     height: `${event.rect.height}px`,
        //                     transform: `translate(${x}px, ${y}px)`
        //                 })
        //
        //                 Object.assign(event.target.dataset, { x, y })
        //             }
        //         }
        //     });

        
        const pane = new Pane({ container, title });
        pane.registerPlugin(SdiPluginBundle);
        pane.registerPlugin(TweakpaneRotationInputPlugin);
        pane.registerPlugin(EssentialsPlugin);
        // pane.registerPlugin(CamerakitPlugin);

        return pane;
    }
}
