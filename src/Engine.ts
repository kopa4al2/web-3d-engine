// @ts-nocheck
import Canvas from "Canvas";
import CameraComponent from "core/components/camera/CameraComponent";
import LightSource from "core/components/camera/LightSource";
import ProjectionMatrix from "core/components/camera/ProjectionMatrix";
import Component from "core/components/Component";
import GeometryComponent from "core/components/geometry/GeometryComponent";
import TerrainGeometry from "core/components/geometry/TerrainGeometry";
import { GPUMeshGroup } from "core/components/GPUMesh";
import Input from "core/components/Input";
import BasicMaterial from "core/components/material/BasicMaterial";
import TerrainMaterial from "core/components/material/TerrainMaterial";
import { Geometry } from "core/components/Mesh";
import { defaultTransform } from "core/components/Transform";
import EntityManager from "core/EntityManager";
import Graphics from "core/Graphics";
import TextureLoader from "core/loader/TextureLoader";
import { ObjectGroup, ObjFile } from "core/parser/ObjParser";
import PropertiesManager from "core/PropertiesManager";
import GPUResourceFactory from "core/resources/gpu/GPUResourceFactory";
import Scene from "core/Scene";
import FreeCameraSystem from "core/systems/camera/FreeCameraSystem";
import EntityComponentSystem from "core/systems/EntityComponentSystem";
import InputSystem from "core/systems/InputSystem";
import Renderer from "core/systems/Renderer";
import TerrainSystem from "core/systems/terrain/TerrainSystem";
import TransformSystem from "core/systems/TransformSystem";
import Texture from "core/texture/Texture";
import { vec2, vec3 } from "gl-matrix";
import { STATIC } from "index";
import WebGLGraphics from "webgl/WebGLGraphics";
import WebGPUGraphics from "webgpu/graphics/WebGPUGraphics";

export default class Engine {

    public isRunning = false;

    private swapBuffered: boolean = false;
    private lastFrame: number = 0;

    private gpuResourceFactory: GPUResourceFactory;

    constructor(
        public graphicsApi: Graphics,
        public canvas: Canvas,
        public properties: PropertiesManager,
        public entityManager: EntityManager,
        public ecs: EntityComponentSystem,
        public projectionMatrix: ProjectionMatrix,
        public lightSource: LightSource,
        public onRenderPlugins: OnRenderPlugin[]) {
        this.gpuResourceFactory = new GPUResourceFactory(graphicsApi);
    }

    init(): void {
        this.entityManager.clear();
        this.ecs.clear();


        let input = new Input();

        input.inputState = {
            mousePos: vec2.create(),
            mouseDelta: vec2.create(),
            wheel: vec3.create(),
            deltaWheel: vec3.create(),
            inputFlags: {}
        };
        // @ts-ignore
        window.input = input;

        const dragonEntity = this.createEntity('dragon',
            this.createMeshFromObj(STATIC['dragon'] as ObjFile),
            defaultTransform()
                .translate(vec3.fromValues(-10.0, 5.0, 15.0))
                .scaleBy(1)
        );

        const cubeEntity = this.createEntity(
            'cube',
            this.createMeshFromObj(STATIC['cube'] as ObjFile, TextureLoader.textures['texture']),
            defaultTransform()
                .translate(vec3.fromValues(22.0, 5.0, 1))
        );
        //
        //
        // const stanfordBunny = this.createEntity(
        //     this.createMeshFromObj(STATIC['bunny'] as ObjFile),
        //     defaultTransform()
        //         .scaleBy(10)
        //         .translate(vec3.fromValues(1, -2, 1))
        // );


        const terrainGeometry = new TerrainGeometry(this.gpuResourceFactory.getTerrainGeometryShader());
        const terrainEntity = this.createEntity('terrain',
            this.gpuResourceFactory.createMesh(
                terrainGeometry.vertexData,
                new TerrainMaterial({
                    fragmentShaderSource: this.gpuResourceFactory.getTerrainFragmentShader(),
                    textures: [
                        TextureLoader.textures['grass'],
                        TextureLoader.textures['mountain-1'],
                        TextureLoader.textures['snow-1'],
                        TextureLoader.textures['water-1'],
                    ],
                    diffuse: vec3.fromValues(1.0, 1.0, 1.0)
                }).shader),
            defaultTransform().translate(vec3.fromValues(-TerrainGeometry.WIDTH / 2, TerrainGeometry.MIN_HEIGHT, -TerrainGeometry.HEIGHT / 2)));

        const lightBulb = this.createEntity(
            'lightBulb',
            this.createMeshesFromObj(STATIC['lightBulb']),
            defaultTransform().translate(this.lightSource.lightDirection).scaleBy(24)
        )

        const freeCameraComponent = new CameraComponent(
            vec3.fromValues(0, 10, 10),
            vec3.fromValues(0, 0, 1),
            vec3.fromValues(0, 1, 0));
        const freeCameraEntity = this.createEntity('camera', freeCameraComponent, input);
        const cameraTransform = defaultTransform();
        cameraTransform.position[0] = -8;

        this.entityManager.scenes.push(new Scene(
            freeCameraComponent,
            this.projectionMatrix,
            this.lightSource,
            [lightBulb, terrainEntity, freeCameraEntity, dragonEntity, cubeEntity]));

        this.ecs.registerUpdateSystems(
            new InputSystem(this.entityManager, this.properties, this.canvas.htmlElement),
            new TransformSystem(this.entityManager),
            new FreeCameraSystem(this.entityManager, this.properties)
        );
        this.ecs.registerRenderSystem(new Renderer(this.graphicsApi, this.entityManager));
        this.ecs.registerSystem(new TerrainSystem(this.graphicsApi))
    }

    private createMeshFromObj(obj: ObjFile, texture?: Texture) {
        // const { material, ...geometryProps } = obj.meshes[0]; // TODO: Handle multiple
        return this.createGpuMeshFromRaw(obj.meshes[0], texture);
    }

    private createMeshesFromObj(obj: ObjFile, texture?: Texture): GPUMeshGroup {
        return new GPUMeshGroup(obj.meshes.map(mesh => this.createGpuMeshFromRaw(mesh, texture)));
    }

    private createGpuMeshFromRaw(group: ObjectGroup, texture?: Texture) {
        const { material, ...geometryProps } = group
        const geometry = new GeometryComponent({
            ...geometryProps,
            shaderSource: this.gpuResourceFactory.getGeometryShader()
        });
        const basicMaterial = new BasicMaterial({
            fragmentShaderSource: this.gpuResourceFactory.getMaterialShader(),
            textures: texture ? [texture] : [new Texture('noop', new ImageData(new Uint8ClampedArray([1.0, 0.0, 1.0, 0.0]), 1))],
            ...material
        });
        return this.gpuResourceFactory.createMesh(geometry.vertexData, basicMaterial.shader);
    }

    start(): void {
        console.log('Engine starting...');
        this.isRunning = true;
        requestAnimationFrame(this.loop.bind(this));
    }

    async loop(now: number) {
        if (this.isRunning) {
            const deltaTime = (now - this.lastFrame) / 1000;  // Convert deltaTime to seconds
            this.onRenderPlugins.forEach(plugin => plugin());
            this.properties.flushBuffer();
            this.ecs.update(deltaTime);
            this.ecs.render();

            this.lastFrame = now;
        }

        requestAnimationFrame(this.loop.bind(this));
    }

    private createEntity(name: string, ...components: Component[]) {
        const entity = this.entityManager.createEntity(name);

        this.entityManager.addComponents(entity, components)

        return entity;
    }
}

export type OnRenderPlugin = () => void;


/*
import Canvas from "Canvas";
import CameraComponent from "core/components/camera/CameraComponent";
import LightSource from "core/components/camera/LightSource";
import ProjectionMatrix from "core/components/camera/ProjectionMatrix";
import Component from "core/components/Component";
import GeometryComponent from "core/components/geometry/GeometryComponent";
import TerrainGeometry from "core/components/geometry/TerrainGeometry";
import Input from "core/components/Input";
import BasicMaterial from "core/components/material/BasicMaterial";
import { Geometry } from "core/components/Mesh";
import { defaultTransform } from "core/components/Transform";
import EntityManager from "core/EntityManager";
import Graphics from "core/Graphics";
import TextureLoader from "core/loader/TextureLoader";
import { ObjFile } from "core/parser/ObjParser";
import PropertiesManager from "core/PropertiesManager";
import GPUResourceFactory from "core/resources/gpu/GPUResourceFactory";
import Scene from "core/Scene";
import FreeCameraSystem from "core/systems/camera/FreeCameraSystem";
import EntityComponentSystem from "core/systems/EntityComponentSystem";
import InputSystem from "core/systems/InputSystem";
import Renderer from "core/systems/Renderer";
import TerrainSystem from "core/systems/terrain/TerrainSystem";
import TransformSystem from "core/systems/TransformSystem";
import Texture from "core/texture/Texture";
import { vec2, vec3 } from "gl-matrix";
import { STATIC } from "index";
import WebGLGraphics from "webgl/WebGLGraphics";
import WebGPUGraphics from "webgpu/graphics/WebGPUGraphics";

export default class Engine {

    public static activeGraphicsApi: Graphics;

    public isRunning = false;
    private webGlGraphics: WebGLGraphics | undefined;
    public webGlCanvas: Canvas | undefined;
    private webGpuGraphics: WebGPUGraphics | undefined;
    public webGpuCanvas: Canvas | undefined;

    private swapBuffered: boolean = false;
    private lastFrame: number = 0;

    constructor(
        public properties: PropertiesManager,
        public entityManager: EntityManager,
        public ecs: EntityComponentSystem,
        public projectionMatrix: ProjectionMatrix,
        public lightSource: LightSource,
        public onRenderPlugins: OnRenderPlugin[]) {

        properties.subscribeToPropertyChange('gpuApi', props => this.swapBuffered = true)
        // properties.subscribeToPropertyChange('splitScreen', props => this.handleSplitScreen(properties.getBoolean("splitScreen")));
        // this.handleSplitScreen(properties.getBoolean('splitScreen'));
    }

    init(): void {
        this.entityManager.clear();
        this.ecs.clear();


        let input = new Input();
        // let input = observer.deepObserve(new Input());
        input.inputState = {
            mousePos: vec2.create(),
            mouseDelta: vec2.create(),
            wheel: vec3.create(),
            deltaWheel: vec3.create(),
            inputFlags: {}
        };
        // @ts-ignore
        window.input = input;
        // const dragonEntity = this.createEntity(
        //     this.createMeshFromObj(STATIC['dragon'] as ObjFile),
        //     defaultTransform()
        //         .scaleBy(0.4)
        // );
        //
        // const cubeEntity = this.createEntity(
        //     this.createMeshFromObj(STATIC['cube'] as ObjFile, TextureLoader.textures['texture']),
        //     defaultTransform()
        //         .translate(vec3.fromValues(-2, -2, 1))
        // );
        //
        //
        // const stanfordBunny = this.createEntity(
        //     this.createMeshFromObj(STATIC['bunny'] as ObjFile),
        //     defaultTransform()
        //         .scaleBy(10)
        //         .translate(vec3.fromValues(1, -2, 1))
        // );


        const terrainGeometry = new TerrainGeometry();
        const terrainEntity = this.createEntity(
            GPUResourceFactory.instance.createMesh(
                terrainGeometry.vertexData,
                new BasicMaterial({
                    fragmentShaderSource: GPUResourceFactory.instance.getTerrainFragmentShader(),
                    textures: [TextureLoader.textures['grass'], TextureLoader.textures['mountain-1'], TextureLoader.textures['snow-1']],
                    diffuse: vec3.fromValues(0.0, 1.0, 0.0) }).shader),
            defaultTransform().translate(vec3.fromValues(-50, -3, -50)));


        const freeCameraComponent = new CameraComponent(
            vec3.fromValues(0, 0, 10),
            vec3.fromValues(0, 0, 1),
            vec3.fromValues(0, 1, 0));
        const freeCameraEntity = this.createEntity(freeCameraComponent, input);
        const cameraTransform = defaultTransform();
        cameraTransform.position[0] = -8;

        // const freeCamera = this.createEntity(new Input(), cameraTransform, freeCameraComponent);
        this.entityManager.scenes.push(new Scene(
            freeCameraComponent,
            this.projectionMatrix,
            this.lightSource,
            [terrainEntity, freeCameraEntity]));
            // [terrainEntity, dragonEntity, cubeEntity, freeCameraEntity]));


        this.ecs.registerUpdateSystems(
            new InputSystem(this.entityManager, this.properties, (this.webGlCanvas || this.webGpuCanvas)!.htmlElement),
            new TransformSystem(this.entityManager),
            new FreeCameraSystem(this.entityManager, this.properties)
        );
        this.ecs.registerRenderSystem(new Renderer(Engine.activeGraphicsApi, this.entityManager));
        this.ecs.registerSystem(new TerrainSystem(Engine.activeGraphicsApi))
    }

    private createMeshFromObj(obj: ObjFile, texture?: Texture) {
        const { material, ...geometryProps } = obj.meshes[0]; // TODO: Handle multiple
        const geometry = new GeometryComponent(geometryProps);
        const basicMaterial = new BasicMaterial({
            textures: texture ? [texture] : [new Texture('noop', new ImageData(new Uint8ClampedArray([1.0, 0.0, 1.0, 0.0]), 1))],
            ...material });
        return GPUResourceFactory.instance.createMesh(geometry.vertexData, basicMaterial.shader);
    }

    start(): void {
        console.log('Engine starting...');
        this.isRunning = true;
        requestAnimationFrame(this.loop.bind(this));
    }

    async loop(now: number) {
        if (this.isRunning) {
            const deltaTime = (now - this.lastFrame) / 1000;  // Convert deltaTime to seconds
            this.onRenderPlugins.forEach(plugin => plugin());
            this.properties.flushBuffer();
            if (this.swapBuffered) {
                await this.changeApi(this.properties.getString('gpuApi'));
                GPUResourceFactory.instance.graphics = Engine.activeGraphicsApi;
                this.init();
                this.swapBuffered = false;
            }
            this.ecs.update(deltaTime);
            this.ecs.render();

            this.lastFrame = now;
        }

        requestAnimationFrame(this.loop.bind(this));
    }

    public async changeApi(api: string) {
        if (api === 'webgpu') {
            if (!this.webGpuGraphics) {
                this.webGpuCanvas = new Canvas(this.properties, 'webgpu').addToDOM();
                this.webGpuGraphics = await WebGPUGraphics.initWebGPU(this.webGpuCanvas, this.properties);
            }

            if (Engine.activeGraphicsApi instanceof WebGLGraphics) {
                // @ts-ignore
                this.webGlCanvas?.htmlElement.style.opacity = "0"
            }
            // @ts-ignore
            this.webGpuCanvas?.htmlElement.style.opacity = '1';
            Engine.activeGraphicsApi = this.webGpuGraphics;
        } else if (api === 'webgl2') {
            if (!this.webGlGraphics) {
                this.webGlCanvas = new Canvas(this.properties, 'webgl').addToDOM();
                this.webGlGraphics = new WebGLGraphics(this.webGlCanvas, this.properties);
            }

            if (Engine.activeGraphicsApi instanceof WebGPUGraphics) {
                // @ts-ignore
                this.webGpuCanvas?.htmlElement.style.opacity = "0"
            }
            // @ts-ignore
            this.webGlCanvas?.htmlElement.style.opacity = '1';
            Engine.activeGraphicsApi = this.webGlGraphics;
        } else {
            console.error(`Unknown graphics: ${api} should be either 'webgl2' or 'webgpu'`);
        }
    }


    private createEntity(...components: Component[]) {
        const entity = this.entityManager.createEntity();

        this.entityManager.addComponents(entity, components)

        return entity;
    }
}

export type OnRenderPlugin = () => void;
// export interface OnRenderPlugin {
//     onRender(): void;
// }
 */