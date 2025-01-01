import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import * as TweakpaneRotationInputPlugin from '@0b5vr/tweakpane-plugin-rotation';
import * as TweakpaneImagePlugin from '@kitschpatrol/tweakpane-plugin-image';
import * as TweakpaneFileImportPlugin from '@kitschpatrol/tweakpane-plugin-file-import';
import * as TextareaPlugin from '@kitschpatrol/tweakpane-plugin-textarea';
import * as TweakpanePluginInputs from '@kitschpatrol/tweakpane-plugin-inputs';
import { Pane, TabPageApi } from 'tweakpane';
import { BladeApi, ContainerApi, EventListenable, FolderApi } from '@tweakpane/core';
import DebugUtil from "util/debug/DebugUtil";

export interface UiProperties {
    refresh: (el?: UiBladeWrapper<BladeApi>) => void;
}

export type UiBladeWrapper<T extends BladeApi<any>> =  UiProperties & EventListenable<any> & T;

export type TopLevelContainer = 'LIGHTS' | 'ENTITIES' | 'MATERIALS'
export default class UILayout {

    private readonly _pane: Pane;

    // private readonly tabs: Record<TopLevelContainer, TabPageApi>;
    private readonly tabs: Map<TopLevelContainer, TabPageApi>;
    private selectedTab?: TabPageApi;

    constructor(private parent: HTMLElement, title?: string) {
        DebugUtil.addToWindowObject('uilayout', this);
        this._pane = UILayout.createPane(parent, title);
        this.tabs = new Map();
        // const tabs = this.addTabs('LIGHTS', 'ENTITIES', 'MATERIALS');
        // this.tabs = {
        //     'LIGHTS': tabs.pages[0],
        //     'ENTITIES': tabs.pages[1],
        //     'MATERIALS': tabs.pages[2],
        // }
    }

    get pane() {
        return this._pane;
    }

    setActive(container: TopLevelContainer) {
        this.tabs.get(container)!.selected = true;
    }

    createTab(container: TopLevelContainer) {
        if (!this.tabs.has(container)) {
            this._pane.addTab({ pages: [{ title: container }], index: 1 });
            const tab = this.addTabs(container);
            this.tabs.set(container, tab.pages[0]);
            tab.on('select', (e) => {
                console.log('Select TAB', e);
            });

        }

        return this.tabs.get(container)!;
    }
    
    public static createBladeApi<T extends BladeApi>(container: ContainerApi, params: Record<string, any>): UiBladeWrapper<T> {
        const blade = container.addBlade(params) as UiBladeWrapper<T>;
        if (params.refresh) {
            blade.refresh = () => params.refresh!(blade); 
        }
        
        return blade;
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
        return UILayout.createPane(this.parent, title);
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

    // https://github.com/donmccurdy/tweakpane-plugin-thumbnail-list
    // https://github.com/0b5vr/tweakpane-plugin-profiler
    // https://github.com/tallneil/tweakpane-plugin-inputs
    // https://github.com/shoedler/tweakpane-plugin-waveform?tab=readme-ov-file
    // https://github.com/pangenerator/tweakpane-textarea-plugin
    public static createPane(parent: HTMLElement, title?: string) {
        const menu = (parent.querySelector('.menu') || parent) as HTMLElement;
        const container = document.createElement('div');
        menu.appendChild(container);

        const pane = new Pane({ container, title, expanded: true });
        pane.registerPlugin(TweakpanePluginInputs);
        pane.registerPlugin(TweakpaneImagePlugin);
        pane.registerPlugin(EssentialsPlugin);
        pane.registerPlugin(TweakpaneFileImportPlugin);
        pane.registerPlugin(TweakpaneRotationInputPlugin);
        pane.registerPlugin(TextareaPlugin);

        return pane;
    }
}
