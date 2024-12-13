import Canvas from "Canvas";
import LightSource from "core/components/camera/LightSource";
import ProjectionMatrix from "core/components/camera/ProjectionMatrix";
import EntityManager from "core/EntityManager";
import Graphics from "core/Graphics";
import TextureLoader from "core/loader/TextureLoader";
import GLTFParserOld from 'core/parser/GLTFParserOld';
import GLTFParser from "core/parser/GLTFParser";
import PropertiesManager, { PartialProperties, Property, PropertyValue } from "core/PropertiesManager";
import EntityComponentSystem from "core/systems/EntityComponentSystem";
import Engine, { OnRenderPlugin } from "Engine";
import { glMatrix, mat4, vec2, vec3 } from "gl-matrix";
import { enableGpuGraphicsApiSwitch, enableSplitScreenSwitch, enableWireframeSwitch } from "html/Controls";
import { enableWebComponentEntitySelect } from 'html/entity-select/EntitySelect';
import { fpsCounter } from "html/Views";
import DebugUtil from 'util/DebugUtil';
import WebGLGraphics from "webgl/WebGLGraphics";
import WebGPUGraphics from "webgpu/graphics/WebGPUGraphics";

// OVERRIDE SYMBOL TO STRING FOR DEBUGGING
Symbol.prototype.toString = function () {
    return this.description || 'N/A';
}
DebugUtil.addToWindowObject('mat4', mat4);
DebugUtil.addToWindowObject('glMatrix', glMatrix);

enableWebComponentEntitySelect();

const loadTimer = 'LOAD_TIMER';
console.time(loadTimer);
const onRender: OnRenderPlugin = () => {
    screenProps.flushBuffer()
};

document.body.onload = async () => {
    console.timeLog(loadTimer, 'DOM loaded')

    await Promise.all([
        // new GLTFParser().parseGltf('assets/scene/sponza_atrium/gltf/scene.gltf', 'assets/scene/sponza_atrium/gltf/scene.bin'),
        // new GLTFParser().parseGlb('assets/scene/sponza_atrium/sponza_atrium_3.glb')
    ])

    console.timeLog(loadTimer, 'GLTF Loaded');

    // TODO: AWAIT!!!
    //  await Promise.all([
    //     TextureLoader.loadTexture('barrel', "assets/advanced/barrel/barrel.png"),
    //     TextureLoader.loadTexture('barrelNormal', "assets/advanced/barrel/barrelNormal.png"),
    //
    //     TextureLoader.loadTexture('crate', "assets/advanced/crate/crate.png"),
    //     TextureLoader.loadTexture('crateNormal', "assets/advanced/crate/crateNormal.png"),
    //
    //
    //     TextureLoader.loadTexture('noop', "assets/1x1texture.png"),
    //     TextureLoader.loadTexture('grassTexture1', "assets/terrain/grass.jpg"),
    //     TextureLoader.loadTexture('mountainTexture1', "assets/terrain/stone-1.png"),
    //     TextureLoader.loadTexture('waterTexture1', "assets/terrain/sea-water-1.jpg"),
    //     TextureLoader.loadTexture('snowTexture1', "assets/terrain/snow-1.jpg"),
    //     TextureLoader.loadTexture('texture', "assets/DALL·E-tex-1.webp"),
    //     TextureLoader.loadHeightMap('heightMap', "assets/terrain/heightmaps/render-dobrichx1.png"),
    // ]);
    console.timeLog(loadTimer, 'textures loaded');

    enableSplitScreenSwitch(screenProps, document.getElementById('global-controls')!);
    enableGpuGraphicsApiSwitch(screenProps, document.getElementById('global-controls')!);
    console.timeLog(loadTimer, 'HTML Controls enabled');

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

        const { webGl2Props, webGlEngine } = await initWebGlEngine({
            ...engineProps,
            'window.leftOffset': window.innerWidth / 2
        });
        glEngine = webGlEngine;
        glProps = webGl2Props;
    } else if (screenProps.get('gpuApi') !== 'webgl2') {
        const { webGpuProps, webgpuEngine } = await initWebGpu({
            'window.width': window.innerWidth,
            'window.leftOffset': 0,
            splitScreen: false,
        });
        gpuEngine = webgpuEngine;
        gpuProps = webGpuProps;
    } else if (screenProps.get('gpuApi') === 'webgl2') {
        const { webGl2Props, webGlEngine } = await initWebGlEngine({
            'window.width': window.innerWidth,
            'window.leftOffset': 0,
            splitScreen: false,
        });
        glEngine = webGlEngine;
        glProps = webGl2Props;
    }

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

            startedEngineProps.updateNestedProperty('window', {
                leftOffset: 0,
                width: window.innerWidth,
                hide: false,
            });

            stoppedEngineProps.updateNestedProperty('window', { width: 0, leftOffset: 0, hide: true });
            engineToStart.isRunning = true;
            engineToStop.isRunning = false;

            glProps.updateProperty('splitScreen', false);
            gpuProps.updateProperty('splitScreen', false);
            stoppedEngineProps.flushBuffer();
        } else {
            gpuEngine.isRunning = true;
            glEngine.isRunning = true;
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


    console.timeEnd(loadTimer)
    console.log("\n\n=============FINISHED ENGINE LOADING====================\n\n")
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
    const graphics = new WebGLGraphics(canvas, webGl2Props);
    const webGlEngine = await createEngine(webGl2Props, canvas, graphics, [onRender]);
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

    const graphics = await WebGPUGraphics.initWebGPU(canvas, webGpuProps);
    const webgpuEngine = await createEngine(webGpuProps, canvas, graphics, [onRender]);
    return { webGpuProps, webgpuEngine };
}

function createProperties(sharedProperties: PartialProperties, currentProperties: Record<Property, PropertyValue>, name: string = 'engine') {
    return new PropertiesManager(currentProperties, sharedProperties, name)
}

async function createEngine(properties: PropertiesManager,
                            canvas: Canvas,
                            graphics: Graphics,
                            onRender: OnRenderPlugin[]): Promise<Engine> {
    const projectionMatrix = new ProjectionMatrix(properties);
    const lightSource = new LightSource(properties);

    const engine = new Engine(
        graphics,
        canvas,
        properties,
        new EntityManager(),
        new EntityComponentSystem(),
        projectionMatrix,
        lightSource,
        [fpsCounter(properties, canvas.parent), ...onRender],
    );
    enableWireframeSwitch(properties, canvas.parent);

    engine.initializeScene();
    engine.start();

    return engine;
}
