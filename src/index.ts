import Canvas from 'Canvas';
import ProjectionMatrix from 'core/components/camera/ProjectionMatrix';
import EntityManager from 'core/EntityManager';
import Graphics from 'core/Graphics';
import PropertiesManager, { PartialProperties } from 'core/PropertiesManager';
import EntityComponentSystem from 'core/systems/EntityComponentSystem';
import Engine, { OnRenderPlugin } from 'Engine';
import { TopMenu } from 'engine/ui/menus/TopMenu';
import { glMatrix, mat4, quat, vec2, vec3 } from 'gl-matrix';
import DebugUtil from './utils/debug/DebugUtil';
import EntityTweakPane from 'engine/ui/controls/EntityTweakPane';
import RightMenu from 'engine/ui/menus/RightMenu';
import FpsCounter from './engine/ui/views/FpsCounter';
import ResourceManager from 'core/resources/ResourceManager';
import MaterialTweakPane from 'engine/ui/controls/MaterialTweakPane';
import MaterialFactory from 'core/factories/MaterialFactory';
import './styles/index.scss';
import './styles/top-menu/styles.scss';
import './styles/theme.scss';
import ThrottleUtil from 'utils/ThrottleUtil';
import GlobalPropertiesControl, { SplitScreenMode } from 'engine/GlobalPropertiesControl';

glMatrix.setMatrixArrayType(Float32Array);

// OVERRIDE SYMBOL TO STRING FOR DEBUGGING
Symbol.prototype.toString = function () {
  return this.description || 'N/A';
};

DebugUtil.addToWindowObject('quat', quat);
DebugUtil.addToWindowObject('vec3', vec3);
DebugUtil.addToWindowObject('mat4', mat4);
DebugUtil.addToWindowObject('glMatrix', glMatrix);


document.body.onload = async () => {
  const screenProps = createProps();

  window.addEventListener('resize', ThrottleUtil.debounce(() => {
    screenProps.updateNestedProperty('window', {
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }, 200));


  const onRender: OnRenderPlugin = () => {
    screenProps.flushBuffer();
  };


  let webGpuEngine: EngineWrapper, webGlEngine: EngineWrapper;
  const globalMenu = new GlobalPropertiesControl(screenProps);
  screenProps.subscribeToPropertyChange('splitScreen', props => updateState(props.getNum('splitScreen') as SplitScreenMode));
  screenProps.flushBuffer();

  async function updateState(state: SplitScreenMode) {
    if (state === SplitScreenMode.SplitScreen) {
      const engines = await Promise.all([getWebGPUEngine(), getGlEngine()]);
      await Promise.all(engines.map(e => e.canvas.show()))
        .then(() => engines.forEach(e => e.engine.start()));
    } else if (state === SplitScreenMode.WebGpu) {
      stop(webGlEngine);
      getWebGPUEngine().then(engine => engine.start());
    } else {
      stop(webGpuEngine);
      getGlEngine().then(engine => engine.start());
    }
  }

  async function getGlEngine(): Promise<EngineWrapper> {
    if (!webGlEngine) {
      const WebGLGraphics = (await import('webgl/WebGLGraphics')).default;
      const canvas = new Canvas(document.getElementById('webgl2-canvas')!, screenProps, 'webgl2');
      const layout = new RightMenu(canvas.parent);
      const graphics = new WebGLGraphics(canvas, screenProps);
      const engine = await createEngine('WebGl', screenProps, canvas, graphics, layout);

      webGlEngine = new EngineWrapper(canvas, engine);
    }

    return webGlEngine!;
  }

  async function getWebGPUEngine(): Promise<EngineWrapper> {
    if (!webGpuEngine) {
      const WebGPUGraphics = (await import('webgpu/graphics/WebGPUGraphics')).default;
      const canvas = new Canvas(document.getElementById('webgpu-canvas')!, screenProps, 'webgpu');
      const layout = new RightMenu(canvas.parent);
      const graphics = await WebGPUGraphics.initWebGPU(canvas, screenProps);
      const engine = await createEngine('WebGPU', screenProps, canvas, graphics, layout);

      webGpuEngine = new EngineWrapper(canvas, engine);
    }

    return webGpuEngine;
  }

  function stop(engine: EngineWrapper | null) {
    if (engine) {
      engine.stop();
    }
  }

  async function createEngine(
    label: string,
    properties: PropertiesManager,
    canvas: Canvas,
    graphics: Graphics,
    uiLayout: RightMenu): Promise<Engine> {

    const entityManager = new EntityManager();
    const projectionMatrix = new ProjectionMatrix(properties);

    const fpsCounter = new FpsCounter(uiLayout);
    const entityControl = new EntityTweakPane(entityManager, uiLayout);
    const resourceManager = new ResourceManager(graphics);
    const materialFactory = new MaterialFactory(resourceManager);
    const materialTweakPane = new MaterialTweakPane(materialFactory, uiLayout);
    const topMenu = new TopMenu(materialTweakPane, entityControl, entityManager, uiLayout);

    const engine = new Engine(
      label,
      graphics,
      canvas,
      properties,
      entityControl,
      new EntityComponentSystem(),
      projectionMatrix,
      resourceManager,
      materialTweakPane,
      // materialFactory,
      [onRender, fpsCounter.tick.bind(fpsCounter)],
    );

    await resourceManager.init()
      .then(engine.initializeScene.bind(engine));

    return engine;
  }

};

function createProps() {
  return new PropertiesManager({
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
    zFar: 1000,
    // splitScreen: false,
    splitScreen: localStorage.getItem('splitScreenMode')!,
    // splitScreen: !!localStorage.getItem('splitScreen'),
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
}

class EngineWrapper {
  constructor(public canvas: Canvas, public engine: Engine) {
  }

  start() {
    this.canvas.show();
    requestAnimationFrame(() => this.engine.start());
  }

  stop() {
    this.engine.stop();
    this.canvas.hide();
  }
}