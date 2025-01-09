import { BladeApi } from '@tweakpane/core';
import { RadioGridController } from '@tweakpane/plugin-essentials';
import RightMenu from 'engine/ui/menus/RightMenu';
import FpsCounter from 'engine/ui/views/FpsCounter';
import PropertiesManager from 'core/PropertiesManager';
import { Pane } from 'tweakpane';

export enum SplitScreenMode {
  SplitScreen,
  WebGl2,
  WebGpu,
}

export default class GlobalPropertiesControl {

  private splitScreenState: SplitScreenMode;
  private radioGrid: BladeApi;
  private pane: Pane;

  constructor(private screenProps: PropertiesManager) {
    this.splitScreenState = Number(localStorage.getItem('splitScreenMode')) ?? SplitScreenMode.WebGpu;
    this.pane = RightMenu.createPane(document.querySelector('.gpu-api-switch')!, SplitScreenMode[this.splitScreenState]);
    FpsCounter.counter = this.pane.addBlade({ view: 'fpsgraph', label: 'fps', rows: 2 });
    const apis = {
      active: this.splitScreenState,
      available: [
        ['Split Screen', ''],
        ['Web gpu', 'Webgl 2']
      ],
      onSelect: [
        [() => this.updateState(SplitScreenMode.SplitScreen)],
        [() => this.updateState(SplitScreenMode.WebGpu), () => this.updateState(SplitScreenMode.WebGl2)]],
    };

    this.radioGrid = this.pane.addBinding(apis, 'active', {
      label: undefined,
      view: 'radiogrid',
      groupName: 'grp',
      size: [2, 2],
      cells: (x: number, y: number) => ({
        title: apis.available[y][x],
        value: apis.onSelect[y][x],
      }),
    }).on('change', (ev) => (ev.value as any)());
    this.resetRadioButtonsState();
    this.screenProps.updateProperty('splitScreen', this.splitScreenState);
  }

  private updateState(splitScreenMode: SplitScreenMode) {
    localStorage.setItem('splitScreenMode', splitScreenMode.toString());
    this.splitScreenState = splitScreenMode;
    this.pane.title = SplitScreenMode[this.splitScreenState];
    this.screenProps.updateProperty('splitScreen', this.splitScreenState);
  }

  private resetRadioButtonsState() {
    // @ts-ignore
    const valueController = this.radioGrid.controller.valueController as RadioGridController<any>;
    const splitScreenBtn = valueController.cellControllers[0];
    const webGpuApiBtn = valueController.cellControllers[2];
    const webglApiBtn = valueController.cellControllers[3];

    // const currentApi = properties.getString('gpuApi');
    splitScreenBtn.view.element.style.gridColumn = 'span 2';
    splitScreenBtn.view.inputElement.checked = this.splitScreenState === SplitScreenMode.SplitScreen;
    webGpuApiBtn.view.inputElement.checked = this.splitScreenState === SplitScreenMode.WebGpu;
    webglApiBtn.view.inputElement.checked = this.splitScreenState === SplitScreenMode.WebGl2;
    valueController.cellControllers[1].viewProps.set('hidden', true);
  }
}