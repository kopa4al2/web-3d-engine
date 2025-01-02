import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import * as TweakpaneRotationInputPlugin from '@0b5vr/tweakpane-plugin-rotation';
import * as TweakpaneImagePlugin from '@kitschpatrol/tweakpane-plugin-image';
import * as TweakpaneFileImportPlugin from '@kitschpatrol/tweakpane-plugin-file-import';
import * as TextareaPlugin from '@kitschpatrol/tweakpane-plugin-textarea';
import * as TweakpanePluginInputs from '@kitschpatrol/tweakpane-plugin-inputs';
import { Pane, TabApi, TabPageApi } from 'tweakpane';
import { BladeApi, ContainerApi, EventListenable, FolderApi } from '@tweakpane/core';
import DebugUtil from "util/debug/DebugUtil";
import { LightControl } from 'engine/ui/controls/LightControl';

export interface UiProperties {
    refresh: (el?: UiBladeWrapper<BladeApi>) => void;
}

export type UiBladeWrapper<T extends BladeApi<any>> = UiProperties & EventListenable<any> & T;

export type TopLevelContainer = 'LIGHTS' | 'ENTITIES' | 'MATERIALS'
export default class RightMenu {

    private readonly _pane: Pane;

    // private readonly tabs: Record<TopLevelContainer, TabPageApi>;
    private readonly tabs: Map<TopLevelContainer, TabPageApi>;
    private readonly tab: TabApi;
    activeTab?: TopLevelContainer;

    constructor(private parent: HTMLElement) {
        DebugUtil.addToWindowObject('uilayout', this);
        this._pane = RightMenu.createPane(parent);
        this.tabs = new Map();
        this.tab = this._pane.addTab({ pages: [{ title: 'NOOP' }] });
        this.tab.pages[0].dispose();
    }
    
    

    get pane() {
        return this._pane;
    }

    setActive(container: TopLevelContainer) {
        this.tabs.get(container)!.selected = true;
        this.activeTab = container;
    }

    createTab(container: TopLevelContainer) {
        if (!this.tabs.has(container)) {
            this.tabs.set(container, this.tab.addPage({ title: container }));
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
            newFolder.add(child);
        });
        folder.dispose();

        return newFolder;
    }

    newPane(title: string) {
        return RightMenu.createPane(this.parent, title);
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
