import { RadioGridController } from "@tweakpane/plugin-essentials";
import Canvas from "Canvas";
import ProjectionMatrix from "core/components/camera/ProjectionMatrix";
import EntityManager from "core/EntityManager";
import Graphics from "core/Graphics";
import PropertiesManager, { PartialProperties, Property, PropertyValue } from "core/PropertiesManager";
import EntityComponentSystem from "core/systems/EntityComponentSystem";
import SdiPerformance from "core/utils/SdiPerformance";
import Engine, { OnRenderPlugin } from "Engine";
import { TopMenu } from "engine/ui/menus/TopMenu";
import { glMatrix, mat4, quat, vec2, vec3 } from "gl-matrix";
import { enableGpuGraphicsApiSwitch, enableSplitScreenSwitch } from "html/Controls";
import { enableWebComponentEntitySelect } from 'html/entity-select/EntitySelect';
import { Pane } from "tweakpane";
import DebugUtil from './util/debug/DebugUtil';
import WebGLGraphics from "webgl/WebGLGraphics";
import WebGPUGraphics from "webgpu/graphics/WebGPUGraphics";
import EntityTweakPane from 'engine/ui/controls/EntityTweakPane';
import UILayout from "./engine/ui/UILayout";
import FpsCounter from "./engine/ui/views/FpsCounter";
import ResourceManager from 'core/resources/ResourceManager';
import MaterialTweakPane from 'engine/ui/controls/MaterialTweakPane';
import MaterialFactory from 'core/factories/MaterialFactory';
import './styles/index.scss'
import './styles/theme.scss'

// OVERRIDE SYMBOL TO STRING FOR DEBUGGING
Symbol.prototype.toString = function () {
    return this.description || 'N/A';
}
DebugUtil.addToWindowObject('quat', quat);
DebugUtil.addToWindowObject('vec3', vec3);
DebugUtil.addToWindowObject('mat4', mat4);
DebugUtil.addToWindowObject('glMatrix', glMatrix);

// enableWebComponentEntitySelect();

SdiPerformance.begin();

const onRender: OnRenderPlugin = () => {
    screenProps.flushBuffer()
};


document.body.onload = async () => {
    SdiPerformance.log('DOM loaded');

    new GlobalPropertiesControl(screenProps);
    let gpuEngine: Engine | undefined,
        glEngine: Engine | undefined,
        gpuProps: PropertiesManager | undefined,
        glProps: PropertiesManager | undefined;

    if (screenProps.getBoolean('splitScreen')) {
        const engineProps = {
            ['window.width']: window.innerWidth / 2,
            splitScreen: true,
        }
        const { webGpuProps, webgpuEngine } = await initWebGpu(engineProps);
        gpuEngine = webgpuEngine;
        gpuProps = webGpuProps;
        gpuEngine.start();

        const { webGl2Props, webGlEngine } = await initWebGlEngine({
            ...engineProps,
            'window.leftOffset': window.innerWidth / 2
        });
        glEngine = webGlEngine;
        glProps = webGl2Props;
        glEngine.start();
    } else if (screenProps.get('gpuApi') !== 'webgl2') {
        const { webGpuProps, webgpuEngine } = await initWebGpu({
            'window.width': window.innerWidth,
            'window.leftOffset': 0,
            splitScreen: false,
        });
        gpuEngine = webgpuEngine;
        gpuProps = webGpuProps;
        gpuEngine.start();
    } else if (screenProps.get('gpuApi') === 'webgl2') {
        const { webGl2Props, webGlEngine } = await initWebGlEngine({
            'window.width': window.innerWidth,
            'window.leftOffset': 0,
            splitScreen: false,
        });
        glEngine = webGlEngine;
        glProps = webGl2Props;
        glEngine.start();
    }

    screenProps.subscribeToAnyPropertyChange(['splitScreen', 'gpuApi'], async props => {
        const isSplitScreen = props.getBoolean('splitScreen');
        const isWebGl = props.get('gpuApi') === 'webgl2';
        const windowWidth = isSplitScreen ? window.innerWidth / 2 : window.innerWidth;

        if (!gpuEngine || !gpuProps) {
            const { webGpuProps, webgpuEngine } = await initWebGpu({
                'window.width': windowWidth,
                splitScreen: isSplitScreen,
            });

            gpuEngine = webgpuEngine;
            gpuProps = webGpuProps;
        }
        if (!glEngine || !glProps) {
            const { webGl2Props, webGlEngine } = await initWebGlEngine({
                'window.width': windowWidth,
                splitScreen: isSplitScreen
            });

            glEngine = webGlEngine;
            glProps = webGl2Props;
        }

        if (!isSplitScreen) {
            const engineToStart = isWebGl ? glEngine : gpuEngine;
            const startedEngineProps = isWebGl ? glProps : gpuProps;
            const engineToStop = isWebGl ? gpuEngine : glEngine;
            const stoppedEngineProps = isWebGl ? gpuProps : glProps;


            engineToStop.stop();
            // await Promise.resolve(setTimeout(() => {}, 100));
            engineToStart.start();

            stoppedEngineProps.updateNestedProperty('window', { width: 0, leftOffset: 0, hide: true });
            startedEngineProps.updateNestedProperty('window', {
                leftOffset: 0,
                width: window.innerWidth,
                hide: false,
            });

            glProps.updateProperty('splitScreen', false);
            gpuProps.updateProperty('splitScreen', false);
            stoppedEngineProps.flushBuffer();
        } else {
            gpuEngine.start();
            glEngine.start();
            glProps.updateProperty('splitScreen', true);
            gpuProps.updateProperty('splitScreen', true);
            glProps.updateNestedProperty('window', {
                width: window.innerWidth / 2,
                leftOffset: window.innerWidth / 2,
                hide: false,
            });
            gpuProps.updateNestedProperty('window', {
                width: window.innerWidth / 2,
                leftOffset: 0,
                hide: false,
            });
        }
    });


    // document.querySelector('canvas')!.focus();
    SdiPerformance.log('Initialized engine');
};

const screenProps = new PropertiesManager({
    input: {
        inputFlags: {},
        mousePos: vec2.create(),
        mouseDelta: vec2.create(),
        deltaWheel: vec3.create(),
        wheel: vec3.create(),
    },
    wireframe: false,
    fieldOfView: Math.PI / 4,
    zNear: 0.1,
    zFar: 100,
    // splitScreen: false,
    splitScreen: !!localStorage.getItem('splitScreen'),
    gpuApi: localStorage.getItem('gpuApi') || 'webgpu',
    // gpuApi: 'webgl2',
    window: {
        width: window.innerWidth,
        height: window.innerHeight,
        leftOffset: 0,
        topOffset: 0,
        hide: false,
    }
}, {}, 'Screen');

const sharedProps: PartialProperties = {
    fieldOfView: Math.PI / 4,
    zNear: 0.1,
    zFar: 1000,
}

async function initWebGlEngine(properties: PartialProperties) {
    const webGl2Props = createProperties({ ...sharedProps, ...properties }, {
        input: {
            inputFlags: {},
            mousePos: vec2.create(),
            mouseDelta: vec2.create(),
            deltaWheel: vec3.create(),
            wheel: vec3.create(),
        },
        wireframe: properties.wireframe || false,
        fieldOfView: Math.PI / 4,
        zNear: 0.1,
        zFar: 1000,
        splitScreen: properties.splitScreen || false,
        gpuApi: 'webgl2',
        window: {
            width: properties['window.width'] as number || window.innerWidth / 2,
            height: window.innerHeight,
            leftOffset: window.innerWidth / 2,
            topOffset: 0,
            hide: false
        }
    }, 'webgl2');

    const canvas = new Canvas(document.getElementById('webgl2-canvas') as HTMLElement,
        webGl2Props,
        'webgl2');
    canvas.addToDOM();
    const layout = new UILayout(canvas.parent);

    const graphics = new WebGLGraphics(canvas, webGl2Props);
    const webGlEngine = await createEngine('WebGl', webGl2Props, canvas, graphics, layout);
    return { webGl2Props, webGlEngine };
}

async function initWebGpu(properties: PartialProperties) {
    const webGpuProps = createProperties(sharedProps, {
        input: {
            inputFlags: {},
            mousePos: vec2.create(),
            mouseDelta: vec2.create(),
            deltaWheel: vec3.create(),
            wheel: vec3.create(),
        },
        wireframe: properties.wireframe || false,
        fieldOfView: Math.PI / 4,
        zNear: 0.1,
        zFar: 1000,
        splitScreen: properties.splitScreen || false,
        gpuApi: 'webgpu',
        window: {
            width: properties['window.width'] as number || window.innerWidth / 2,
            height: window.innerHeight - 80,
            leftOffset: 0,
            topOffset: 0,
            hide: false,
        },
    }, 'webgpu');


    const canvas = new Canvas(document.getElementById('webgpu-canvas') as HTMLElement,
        webGpuProps,
        'webgpu');
    canvas.addToDOM();
    SdiPerformance.log('Added canvas to DOM')

    const layout = new UILayout(canvas.parent);

    const graphics = await WebGPUGraphics.initWebGPU(canvas, webGpuProps);
    SdiPerformance.log('Initialized graphics')

    // @ts-ignore
    const webgpuEngine = await createEngine('WebGPU', webGpuProps, canvas, graphics, layout);

    return { webGpuProps, webgpuEngine };
}

function createProperties(sharedProperties: PartialProperties, currentProperties: Record<Property, PropertyValue>, name: string = 'engine') {
    return new PropertiesManager(currentProperties, sharedProperties, name)
}

async function createEngine(
    label: string,
    properties: PropertiesManager,
    canvas: Canvas,
    graphics: Graphics,
    uiLayout: UILayout): Promise<Engine> {

    const entityManager = new EntityManager();
    const projectionMatrix = new ProjectionMatrix(properties);

    const fpsCounter = new FpsCounter(uiLayout);
    const entityControl = new EntityTweakPane(entityManager, uiLayout);
    const resourceManager = new ResourceManager(graphics);
    const materialFactory = new MaterialTweakPane(new MaterialFactory(resourceManager), uiLayout);
    const topMenu = new TopMenu(materialFactory, entityControl);

    const engine = new Engine(
        label,
        graphics,
        canvas,
        properties,
        entityControl,
        new EntityComponentSystem(),
        projectionMatrix,
        resourceManager,
        materialFactory,
        [onRender, fpsCounter.tick.bind(fpsCounter)],
    );

    await resourceManager.init()
        .then(engine.initializeScene.bind(engine));

    return engine;
}

class GlobalPropertiesControl {

    private splitScreenToggle;

    constructor(private properties: PropertiesManager) {
        const pane = UILayout.createPane(document.querySelector('.gpu-api-switch')!, 'GPU Api');
        FpsCounter.counter = pane.addBlade({ view: 'fpsgraph', label: 'fps', rows: 2 });
        properties.subscribeToAnyPropertyChange(['gpuApi'], props => {
            pane.title = props.getString('gpuApi');
        });

        const isSplitScreenEnabled = properties.getBoolean('splitScreen');
        const apis = {
            active: properties.getString('gpuApi'),
            available: [
                ['Split Screen', ''],
                ['Web gpu', 'Webgl 2']
            ],
            onSelect: [
                [this.setSplitScreen.bind(this)],
                [() => this.setGpuApi('webgpu'), () => this.setGpuApi('webgl2')]],
        }

        const radioGrid = pane.addBinding(apis, 'active', {
            label: undefined,
            view: 'radiogrid',
            groupName: 'grp',
            size: [2, 2],
            cells: (x: number, y: number) => ({
                title: apis.available[y][x],
                value: apis.onSelect[y][x],
            }),
        }).on('change', (ev) => (ev.value as any)());

        const valueController = radioGrid.controller.valueController as RadioGridController<any>;
        const splitScreenBtn = valueController.cellControllers[0];
        const webGpuApiBtn = valueController.cellControllers[2];
        const webglApiBtn = valueController.cellControllers[3];

        const currentApi = properties.getString('gpuApi');
        splitScreenBtn.view.element.style.gridColumn = 'span 2';
        splitScreenBtn.view.inputElement.checked = isSplitScreenEnabled;
        webGpuApiBtn.view.inputElement.checked = !isSplitScreenEnabled && currentApi === 'webgpu';
        webglApiBtn.view.inputElement.checked = !isSplitScreenEnabled && currentApi === 'webgl2';
        valueController.cellControllers[1].viewProps.set("hidden", true);

        this.splitScreenToggle = splitScreenBtn;
    }

    private setGpuApi(api: string) {
        this.properties.updateProperty('gpuApi', api);
        this.properties.updateProperty('splitScreen', false);
        localStorage.setItem('gpuApi', api);
        localStorage.removeItem('splitScreen');
        SdiPerformance.reset();
    }

    private setSplitScreen() {
        const oldValue = this.properties.getBoolean('splitScreen');
        this.properties.updateProperty('splitScreen', !oldValue);
        if (oldValue) {
            localStorage.removeItem('splitScreen');
        } else {
            localStorage.setItem('splitScreen', 'true');
        }
    }
}