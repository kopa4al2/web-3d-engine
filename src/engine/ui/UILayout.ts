import * as CamerakitPlugin from '@tweakpane/plugin-camerakit';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import * as TweakpaneRotationInputPlugin from '@0b5vr/tweakpane-plugin-rotation';
import { Pane } from 'tweakpane';
import interact from 'interactjs';
import { SdiPluginBundle } from './custom/Label';
import { BladeApi, ContainerApi, FolderApi } from '@tweakpane/core';

export type TopLevelContainer = 'LIGHTS' | 'ENTITIES' | 'MATERIALS' | 'FPS'
// ROTATION PLUGIN
// https://github.com/0b5vr/tweakpane-plugin-rotation?tab=readme-ov-file
export default class UILayout {

    private readonly _pane: Pane;

    private readonly tabs: Record<TopLevelContainer, ContainerApi>;

    constructor(private parent: HTMLElement, title?: string) {
        this._pane = this.createPane(parent, title);
        const fps = this.addFolder('FPS', true);
        const tabs = this.addTabs('LIGHTS', 'ENTITIES', 'MATERIALS');
        this.tabs = {
            'LIGHTS': tabs.pages[0],
            'ENTITIES': tabs.pages[1],
            'MATERIALS': tabs.pages[2],
            'FPS': fps,
        }
    }

    get pane() {
        return this._pane;
    }

    getTopLevelContainer(container: TopLevelContainer) {
        return this.tabs[container];
    }

    public static moveFolder(newContainer: ContainerApi, folder: FolderApi) {
        const newFolder = newContainer.addFolder({
            title: `${folder.title!}`,
            hidden: folder.hidden,
            expanded: folder.expanded,
            disabled: folder.disabled
        });

        folder.children.forEach(child => {
            // console.log('has child', child)
            // const controller = child.controller;
            // console.log(controller);
            // const state = child.exportState();
            // const clone = new BladeApi(child.controller);
            // clone.importState(state);
            newFolder.add(child);
            // newFolder.add(clone);
        });
        folder.dispose();

        return newFolder;
    }

    newPane(title: string) {
        return this.createPane(this.parent, title);
    }

    addFolder(title: string, expanded?: boolean, hidden?: boolean, disabled?: boolean) {
        return this._pane.addFolder({ title, expanded, hidden, disabled });
    }

    addTabs(...titles: string[]) {
        return this._pane.addTab({ pages: titles.map(title => ({ title })) });
        // return this.pane.addTab({ pages: [{ title }] });
    }

    addBlade(title: string, params: Record<string, unknown>) {
        return this._pane.addBlade({ title, ...params })
    }

    private createPane(parent: HTMLElement, title?: string) {
        const menu = (parent.querySelector('.menu') || parent) as HTMLElement;
        const container = document.createElement('div');
        menu.appendChild(container);

        const pane = new Pane({ container, title, expanded: true });
        // pane.registerPlugin(SdiPluginBundle);
        pane.registerPlugin(TweakpaneRotationInputPlugin);
        pane.registerPlugin(EssentialsPlugin);

        return pane;
    }
}
