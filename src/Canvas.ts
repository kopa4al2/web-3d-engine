import PropertiesManager, { WindowProperties } from "core/PropertiesManager";
import { addTitle } from "html/Views";
import log from "util/Logger";
import MathUtil from "util/MathUtil";
import ThrottleUtil from "util/ThrottleUtil";


export default class Canvas {
    width: number;
    height: number;
    readonly htmlElement: HTMLCanvasElement;

    constructor(public readonly parent: HTMLElement,
                private props: PropertiesManager,
                private canvasId: string = 'canvas') {
        this.width = props.getAbsolute('window.width');
        this.height = props.getAbsolute('window.height');

        this.htmlElement = document.createElement('canvas');
        this.htmlElement.id = canvasId;
        this.htmlElement.tabIndex = 1;

        this.parent.style.width = '100%';
        this.parent.style.height = '100%';
        this.htmlElement.style.position = 'relative';
        this.htmlElement.width = this.width;
        this.htmlElement.height = this.height;

        this.updateDimensions(props.getT('window'));
        this.props.subscribeToAnyPropertyChange(
            ['window.width', 'window.height', 'window.leftOffset', 'window.topOffset', 'window.hide'],
            props => this.updateDimensions(props.getT('window')));
    }

    addToDOM(parentElement?: HTMLElement): Canvas {
        const wrapper = parentElement || this.parent;
        wrapper.appendChild(this.htmlElement);
        addTitle(this.canvasId, this.parent, this.props);

        window.addEventListener('resize', ThrottleUtil.debounce(e => {
            this.width = MathUtil.clamp(window.innerWidth, 800, 1920);
            this.height = MathUtil.clamp(window.innerHeight, 600, 1080);

            if (this.props.getBoolean('splitScreen')) {
                this.width = window.innerWidth / 2;
                if (this.props.get<number>('window.leftOffset') > 0) {
                    const leftOffset = window.innerWidth - this.width;
                    this.props.updateNestedProperty('window', { leftOffset })
                    this.parent.style.left = leftOffset + 'px';
                }
            }

            this.parent.style.width = this.width + 'px';
            this.parent.style.height = this.height + 'px';
            this.htmlElement.width = this.width;
            this.htmlElement.height = this.height;

            this.props.updateNestedProperty('window', { width: this.width, height: this.height });
        }, 100));

        return this;
    }

    getWebGl2Context(): WebGL2RenderingContext {
        const ctx = this.htmlElement.getContext("webgl2", { depth: true, });

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

    private updateDimensions({ width, height, leftOffset, topOffset, hide }: WindowProperties) {
        this.width = width;
        this.height = height;
        this.parent.style.width = width + 'px';
        this.parent.style.height = height + 'px';
        this.parent.style.top = topOffset + 'px';
        this.parent.style.left = leftOffset + 'px';
        this.parent.style.display = hide ? 'none' : 'block';
        this.htmlElement.width = width;
        this.htmlElement.height = height;
    }
}
