import Canvas from "Canvas";
import ProjectionMatrix from "core/components/camera/ProjectionMatrix";
import EntityManager from "core/EntityManager";
import Graphics from "core/Graphics";
import PropertiesManager, { PartialProperties, Property, PropertyValue } from "core/PropertiesManager";
import EntityComponentSystem from "core/systems/EntityComponentSystem";
import SdiPerformance from "core/utils/SdiPerformance";
import Engine, { OnRenderPlugin } from "Engine";
import { glMatrix, mat4, quat, vec2, vec3 } from "gl-matrix";
import { enableGpuGraphicsApiSwitch, enableSplitScreenSwitch } from "html/Controls";
import { enableWebComponentEntitySelect } from 'html/entity-select/EntitySelect';
import DebugUtil from './util/debug/DebugUtil';
import WebGLGraphics from "webgl/WebGLGraphics";
import WebGPUGraphics from "webgpu/graphics/WebGPUGraphics";
import EntityControl from './engine/ui/controls/EntityControl';
import UILayout from "./engine/ui/UILayout";
import FpsCounter from "./engine/ui/views/FpsCounter";
import ResourceManager from 'core/resources/ResourceManager';
import MaterialControl from './engine/ui/controls/MaterialControl';
import MaterialFactory from 'core/factories/MaterialFactory';

// OVERRIDE SYMBOL TO STRING FOR DEBUGGING
Symbol.prototype.toString = function () {
    return this.description || 'N/A';
}
DebugUtil.addToWindowObject('quat', quat);
DebugUtil.addToWindowObject('vec3', vec3);
DebugUtil.addToWindowObject('mat4', mat4);
DebugUtil.addToWindowObject('glMatrix', glMatrix);

enableWebComponentEntitySelect();

SdiPerformance.begin();
// const loadTimer = 'LOAD_TIMER';
// console.time(loadTimer);
const onRender: OnRenderPlugin = () => {
    screenProps.flushBuffer()
};


document.body.onload = async () => {
    SdiPerformance.log('DOM loaded');
    // console.timeLog(loadTimer, 'DOM loaded');

    // const globalUI = new UILayout('GLOBAL', document.getElementById('global-controls')!);
    // const graphicsApiBlade = globalUI.pane.addBlade({
    //     view: 'list',
    //     label: 'Graphics API',
    //     options: [
    //         {text: 'WebGL2', value: 'webgl2'},
    //         {text: 'WebGPU', value: 'webgpu'},
    //         {text: 'Split screen', value: 'split-screen'},
    //     ],
    //     value: 'webgl2',
    // });
    // // graphicsApiBlade.on()
    enableSplitScreenSwitch(screenProps, document.getElementById('global-controls')!);
    enableGpuGraphicsApiSwitch(screenProps, document.getElementById('global-controls')!);

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
    SdiPerformance.log('Initialized engine');
    document.querySelector('canvas')!.focus();

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
    },
    light: {
        sourceX: 0,
        sourceY: 0,
        sourceZ: 0,
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
        },
        light: {
            sourceX: 0,
            sourceY: 0,
            sourceZ: 0
        }
    }, 'webgl2');

    const canvas = new Canvas(document.getElementById('webgl2-canvas') as HTMLElement,
        webGl2Props,
        'webgl2');
    canvas.addToDOM();
    const layout = new UILayout(canvas.parent, 'WebGL');

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
            height: window.innerHeight,
            leftOffset: 0,
            topOffset: 0,
            hide: false,
        },
        light: {
            sourceX: 0,
            sourceY: 0,
            sourceZ: 0
        }
    }, 'webgpu');


    const canvas = new Canvas(document.getElementById('webgpu-canvas') as HTMLElement,
        webGpuProps,
        'webgpu');
    canvas.addToDOM();
    SdiPerformance.log('Added canvas to DOM')

    const layout = new UILayout(canvas.parent, 'WebGPU');

    const graphics = await WebGPUGraphics.initWebGPU(canvas, webGpuProps);
    SdiPerformance.log('Initialized graphics')

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
    const entityControl = new EntityControl(entityManager, uiLayout);
    const resourceManager = new ResourceManager(graphics);
    const materialFactory = new MaterialControl(new MaterialFactory(resourceManager), uiLayout);

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
        .then(engine.initializeScene.bind(engine))

    return engine;
}
