import PropertiesManager from 'core/PropertiesManager';
import { SplitScreenMode } from 'engine/GlobalPropertiesControl';


export default class Canvas {

  private _htmlElement?: HTMLCanvasElement;
  private isShown = false;

  private onResizeListeners: (() => void)[] = [];

  constructor(public readonly parent: HTMLElement,
              private props: PropertiesManager,
              private canvasId: string = 'canvas') {
    this.props.subscribeToAnyPropertyChange(
      ['window.width', 'window.height', 'splitScreen'],
      props => this.updateDimensions(props));
  }

  get width() {
    return this.isShown ? this.htmlElement.width : 0;

  }

  get height() {
    return this.isShown ? this.htmlElement.height : 0;
  }

  get htmlElement(): HTMLCanvasElement {
    if (!this._htmlElement) {
      const wrapper = this.parent;
      const { width, height } = wrapper.getBoundingClientRect();
      this._htmlElement = document.createElement('canvas');
      this._htmlElement.id = this.canvasId;
      this._htmlElement.tabIndex = 1;
      this._htmlElement.width = width;
      this._htmlElement.height = height;

      wrapper.appendChild(this._htmlElement);
      this.updateDimensions(this.props);
    }

    return this._htmlElement;
  }

  addOnResizeListener(onResize: () => void): void {
    this.onResizeListeners.push(onResize);
  }

  getWebGl2Context(): WebGL2RenderingContext {
    const ctx = this.htmlElement.getContext('webgl2', { depth: true, });

    if (!ctx) {
      throw 'WebGL2 Is not supported';
    }

    return ctx;
  }

  getWebGpuContext(): GPUCanvasContext {
    const ctx = this.htmlElement.getContext('webgpu');

    if (!ctx) {
      throw 'WebGPU is not supported';
    }

    return ctx;
  }

  private updateDimensions(props: PropertiesManager) {
    const splitScreen: SplitScreenMode = props.getNum('splitScreen');
    const { top: topMenuOffset, height: topMenuHieght } = document.querySelector('.top-menu')!.getBoundingClientRect();
    const { innerWidth, innerHeight } = window;

    let width  = innerWidth,
        height = innerHeight - topMenuOffset - topMenuHieght;
    if (splitScreen === SplitScreenMode.SplitScreen) {
      width /= 2;
    }

    this.parent.style.width = `${width}px`;
    this.parent.style.height = `${height}px`;
    this.htmlElement.width = width;
    this.htmlElement.height = height;

    if (this.isShown) {
      this.parent.style.display = `none`;
    } else {
      this.parent.style.display = `initial`;
    }

    this.onResizeListeners.forEach(listener => listener());
  }

  async show(): Promise<void> {
    console.log(`SHOWING ${this.canvasId}`, this.parent);
    // this.parent.style.display = 'block';
    this.isShown = true;
      this.updateDimensions(this.props);
    // return new Promise(resolve => {
    //   return resolve();
    // });
  }

  async hide(): Promise<void> {
    console.log(`HIDING ${this.canvasId}`, this.parent);

    // this.htmlElement.style.display = 'none';
    this.isShown = false;
    this.updateDimensions(this.props);

    // return new Promise(resolve => {
    //   this.updateDimensions(this.props);
    //   return resolve();
    // });
  }
}
