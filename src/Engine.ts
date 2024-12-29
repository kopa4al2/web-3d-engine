import Canvas from 'Canvas';
import CameraComponent from 'core/components/camera/CameraComponent';
import ProjectionMatrix from 'core/components/camera/ProjectionMatrix';
import Component from 'core/components/Component';
import Input from 'core/components/Input';
import Mesh from 'core/components/Mesh';
import Transform, { defaultTransform, TransformBuilder } from 'core/components/Transform';
import EntityFactory from 'core/entities/EntityFactory';
import EntityManager, { EntityId, EntityName } from 'core/EntityManager';
import GeometryFactory from 'core/factories/GeometryFactory';
import MaterialFactory from 'core/factories/MaterialFactory';
import Graphics from 'core/Graphics';
import DirectionalLight from 'core/light/DirectionalLight';
import PointLight, { PointLightProps } from 'core/light/PointLight';
import SpotLight, { SpotLightProps } from "core/light/SpotLight";
import { GeometryData } from 'core/mesh/Geometry';
import Material from 'core/mesh/material/Material';
import BoundingSphere from 'core/physics/BoundingSphere';
import PropertiesManager from 'core/PropertiesManager';
import ModelRepository from 'core/repository/ModelRepository';
import { VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import ResourceManager from 'core/resources/ResourceManager';
import ShaderManager from 'core/resources/shader/ShaderManager';
import Scene from 'core/Scene';
import FreeCameraSystem from 'core/systems/camera/FreeCameraSystem';
import ViewFrustumSystem from 'core/systems/camera/ViewFrustumSystem';
import EntityComponentSystem from 'core/systems/EntityComponentSystem';
import InputSystem from 'core/systems/InputSystem';
import Renderer from 'core/systems/Renderer';
import SceneSystem from 'core/systems/SceneSystem';
import TerrainSystem from 'core/systems/terrain/TerrainSystem';
import TransformSystem from 'core/systems/TransformSystem';
import PromiseQueue from "core/utils/PromiseQueue";
import SdiPerformance from "core/utils/SdiPerformance";
import { glMatrix, mat4, quat, vec2, vec3, vec4 } from 'gl-matrix';
import { worldCoordinates } from "./html/Views";
// import { enableEntitySelect, LightControls } from 'html/Controls';
// import { worldCoordinates } from 'html/Views';
import { SdiColor, SdiDirection, SdiPoint3D } from './types/engine-types/EngineTypes';
import DebugCanvas from "./util/debug/DebugCanvas";
import DebugUtil from './util/debug/DebugUtil';
import ObjectUtils from './util/ObjectUtils';
import OrderComponent from 'core/components/OrderComponent';

export default class Engine {

    private isRunning = false;
    private frameRequest = 0;

    private lastFrame: number = 0;

    // private readonly resourceManager: ResourceManager;
    private readonly entityFactory: EntityFactory;
    // private readonly materialFactory: MaterialFactory;
    private readonly geometryFactory: GeometryFactory;
    private readonly modelRepository: ModelRepository;
    private readonly shaderManager: ShaderManager;
    private readonly scene: Scene;
    private readonly input: Input = this.createInput();
    private readonly freeCameraComponent: CameraComponent = this.createFreeCamera();

    constructor(
        private label: string,
        public graphicsApi: Graphics,
        public canvas: Canvas,
        public properties: PropertiesManager,
        public entityManager: EntityManager,
        public ecs: EntityComponentSystem,
        public projectionMatrix: ProjectionMatrix,
        public resourceManager: ResourceManager,
        public materialFactory: MaterialFactory,
        public onRenderPlugins: OnRenderPlugin[]) {

        this.entityFactory = new EntityFactory(this.entityManager);
        this.shaderManager = new ShaderManager(this.graphicsApi, this.resourceManager);
        this.geometryFactory = new GeometryFactory(this.resourceManager);
        this.modelRepository = new ModelRepository(this.geometryFactory, this.materialFactory, this.shaderManager, this.resourceManager, entityManager);

        const freeCameraEntity = this.createEntity('CAMERA', this.freeCameraComponent, this.input);
        this.scene = new Scene(this.freeCameraComponent, this.projectionMatrix, entityManager, [freeCameraEntity]);
        this.entityManager.scenes.push(this.scene);

        DebugUtil.addToWindowObject('Engine' + label, this);
    }

    start(): void {
        console.log('Engine starting...', this.label);
        this.isRunning = true;
        requestAnimationFrame(this.loop.bind(this));
    }

    stop(): void {
        console.log('Engine stopping...', this.label);
        cancelAnimationFrame(this.frameRequest);
        this.isRunning = false;
    }

    loop(now: number) {
        this.onRenderPlugins.forEach(plugin => plugin());
        this.properties.flushBuffer();
        if (this.isRunning) {
            const deltaTime = (now - this.lastFrame) / 1000;
            this.ecs.update(deltaTime);
            this.ecs.render();

            this.lastFrame = now;
            this.frameRequest = requestAnimationFrame(this.loop.bind(this));
        }
    }

    async initializeScene(): Promise<void> {
        // const renderLightBulb = (transform: vec3) => this.modelRepository.lightBulb()
        //     .then(mesh => {
        //         this.scene.addEntities(
        //             this.entityFactory.createEntityInstance('lightBulb', mesh, defaultTransform().scaleBy(10).translate(transform)),
        //         );
        //     })

        const entities = {
            // dragon: (coordinates: vec3) => renderDragon(coordinates),
            // lightBulb: (transform: vec3) => renderLightBulb(transform),
            // square: (transform: vec3) => renderCube(transform),
            // sphere: (transform: vec3) => renderSphere(transform),
            // grass: (transform: Transform) => renderWavefront('grass', transform),
            // bunny: (coordinates: Transform) => renderWavefront('bunny', coordinates),
            // camera: (coordinates: Transform) => renderWavefront('camera', coordinates),

            // wavefront: (transform: vec3, key: keyof typeof ModelRepository.wavefrontFiles) => renderWavefront(transform, key)
        }


        // this.createSpotLight('SPOT_LIGHT_2', {
        //     color: vec4.fromValues(1, 0, 1, 1),
        //     intensity: 5,
        //     innerCutoff: Math.cos(glMatrix.toRadian(30.0)),
        //     outerCutoff: Math.cos(glMatrix.toRadian(40.0)),
        //     quadraticAttenuation: 0.04
        // }, defaultTransform().translate(vec3.fromValues(0, 10, 0)).lookAt([0, 0, 10]));

        // this.createPointLight('Red', { color: PointLight.WARM_LIGHT }, defaultTransform().translate([10, 10, 0]));


        // this.loadAndAddMesh('crate 2', () => this.modelRepository.createCrate(), [0, -3, 0])
        // this.loadAndAddMesh(() => this.modelRepository.lightBulb(), [10, 15, -15])


        // const promiseQueue = new PromiseQueue();
        //
        // function flatMapTransform(transform: Transform, arr: Transform[] = []) {
        //     arr.push(transform);
        //
        //     for (const child of transform.children) {
        //         flatMapTransform(child, arr);
        //     }
        //
        //     return arr;
        // }
        //
        // function traverse(mesh: Mesh, onRender: (m: Mesh) => void) {
        //     promiseQueue.addTask(async () => onRender(mesh));
        //
        //     for (const subMesh of mesh.subMesh) {
        //         traverse(subMesh, onRender);
        //     }
        // }

        // this.modelRepository.lightBulb().then(meshes => {
        //     const lightTransform = defaultTransform();
        //     meshes.transform.children.push(lightTransform);
        //     lightTransform.parent = meshes.transform;
        //     mat4.targetTo(lightTransform.worldTransform.mat4, lightTransform.localTransform.position, meshes.transform, vec3.fromValues(0, 1, 0));
        //     traverse(meshes, mesh => {
        //         if (!mesh.pipelineId) {
        //             const entityId = this.entityFactory.createEntity(`no-transform`, mesh.transform);
        //             this.scene.addEntity(entityId);
        //             return;
        //         }
        //         const entityId = this.entityFactory.createEntityInstance(
        //             `${ mesh.geometry.vertexBuffer.toString() }`,
        //             mesh, mesh.transform);
        //         this.scene.addEntities(entityId);
        //     });
        //     promiseQueue
        //         .addTask(async () => this.createSpotLight('BulbLight', { color: vec4.fromValues(1.0, 0.2, 0.7, 1) }, lightTransform));
        // });

        // this.modelRepository.createSkyBox().then(m => {
        //     this.scene.addEntities(this.entityFactory.createEntity(`SKY_BOX`, m, new OrderComponent(1)));
        // });

        const sunLight = new DirectionalLight({
            direction: vec4.fromValues(0.0, -1.0, 1.0, 0.0),
            color: new SdiColor(1.0, 1.0, 1.0, 1.0),
            intensity: 1.0
        });

        const sunLightEntity = this.entityFactory.createEntity('Sun', sunLight);
        this.scene.addEntities(sunLightEntity);

        // this.createPointLight('BRIGHT_POINT',
        //     {
        //         color: new SdiColor([1, 0, 0]), quadraticAttenuation: 0.001,
        //         linearAttenuation: 0.01, intensity: 1
        //     },
        //     defaultTransform().translate([0, 5, 0]));
        //
        // this.createPointLight('WARM',
        //     {
        //         color: new SdiColor([0.5, 0, 0]), quadraticAttenuation: 0.01,
        //         linearAttenuation: 0.01, intensity: 2
        //     },
        //     defaultTransform().translate([-5, 1, 0]));

        //
        // this.createSpotLight('Orange Spotlight', {
        //         color: vec4.fromValues(1, 0.6, 0, 1),
        //         intensity: 2.0,
        //         innerCutoff: Math.cos(glMatrix.toRadian(30.0)),
        //         outerCutoff: Math.cos(glMatrix.toRadian(40.0)),
        //         linearAttenuation: 0.1,
        //         quadraticAttenuation: 0.0032
        //     }, TransformBuilder.position(vec3.fromValues(0, 5, 0)).lookAt([0, 5, -1]).build());
        
        this.createSpotLight('White', {
                color: vec4.fromValues(0.7, 0.85, 1.0, 1),
                intensity: 2.5,
                innerCutoff: Math.cos(glMatrix.toRadian(25.0)),
                outerCutoff: Math.cos(glMatrix.toRadian(25.0)),
                linearAttenuation: 0.1,
                quadraticAttenuation: 0.0032
            }, TransformBuilder.position(vec3.fromValues(3, 3, -1)).lookAt([0, 0, 0]).build());

        // defaultTransform().translate(vec3.fromValues(0, 5, 0)).lookAt([0, 5, -1])
        const skeletalTransform = new TransformBuilder()
            .reorient()
            .translate([4, 2, 0])
            .lookAt([4, 4, 0])
            .scaleBy(0.5)
            .build();

        // const skeletalTransform = Transform.fromMat4(lookAtWithOffset(vec3.fromValues(4, 2, 2), vec3.fromValues(2, 2, 0), Transform.UP));

        const e = this.entityManager.createEntity('TransformEntity')
        this.entityManager.addComponents(e, [skeletalTransform]);
        this.scene.addEntities(e)
        return Promise.all([
            this.addScene('Skeletal', () => this.modelRepository.midas(skeletalTransform)),
            // this.addScene('Sponza Atrium', this.modelRepository.sponzaAtriumGLB),
            this.loadAndAddMesh('Crate1', this.modelRepository.createCrate, [-2, 2, 0], 0.005),
        ])
            // .then(() => this.addScene('Skeletal', () => this.modelRepository.finalWarsMonster(skeletalTransform)))
            // .then(() => this.addScene('Monster', this.modelRepository.monster, defaultTransform().translate([3, 3, 0]).lookAt([0, 1, 0])))
            // .then(() => this.addScene('MonkeyHead', this.modelRepository.monkeyHead, defaultTransform().translate([-3, 3, 0])))
            // .then(() => this.loadAndAddMesh('Crate2', this.modelRepository.createCrate, [0, 0, 0], 0.005),)
            // .then(() => this.addScene('Porsche', this.modelRepository.test))
            // .then(() => this.addScene('Sponza Atrium', this.modelRepository.sponzaAtriumScene))
            .then(() => {
                this.ecs.registerUpdateSystems(
                    new SceneSystem(this.entityManager),
                    new InputSystem(this.entityManager, this.properties, this.canvas.htmlElement),
                    new TransformSystem(this.entityManager),
                    new FreeCameraSystem(this.entityManager, this.properties)
                );

                this.ecs.registerSystems(
                    new Renderer(this.graphicsApi, this.entityManager, this.resourceManager, this.shaderManager),
                    new ViewFrustumSystem(this.entityManager, this.graphicsApi, this.properties),
                    new TerrainSystem(this.graphicsApi));
            });

        // worldCoordinates(this.properties, this.freeCameraComponent, this.projectionMatrix, this.input, this.canvas.parent);
    }

    private async addScene(label = 'scene', scene: () => Promise<EntityId[]>, transform?: Transform): Promise<void> {
        console.time(`Loading ${label} took:`);
        const entities = await scene.bind(this.modelRepository)();
        if (transform) {
            const component = this.entityManager.getComponents<[Transform]>(entities[0], Transform.ID)[0];
            component.transformBy(transform);
        }
        this.scene.addEntities(...entities);
        console.timeEnd(`Loading ${label} took:`);
    }

    private createPointLight(label: string, props: Partial<PointLightProps>, transform?: Transform) {
        const defaultProps = {
            position: new SdiPoint3D(0, 0, 0),
            color: new SdiColor([1.0, 0.0, 1.0, 1.0]),
            intensity: 2.5,
            constantAttenuation: 1.0,
            linearAttenuation: 0.1,
            quadraticAttenuation: 0.02
        };
        const light = new PointLight(ObjectUtils.mergePartial(props, defaultProps));
        this.scene.addEntities(this.entityFactory.createEntity(label, light, transform || defaultTransform()));
    }

    private createSpotLight(label: string, props: Partial<SpotLightProps>, transform: Transform = defaultTransform()) {
        const defaultProps: SpotLightProps = {
            color: vec4.fromValues(1, 1, 1, 1),
            innerCutoff: Math.cos(glMatrix.toRadian(20.0)),
            outerCutoff: Math.cos(glMatrix.toRadian(30.0)),
            intensity: 5.0,
            constantAttenuation: 1.0,
            linearAttenuation: 0.09,
            quadraticAttenuation: 0.0032
        };
        const light = new SpotLight(ObjectUtils.mergePartial(props, defaultProps));
        this.scene.addEntities(this.entityFactory.createEntity(label, light, transform));
    }

    private initializeTerrain() {
        // const terrainMaterialProperties = new TerrainMaterialProperties(
        //     vec4.fromValues(0.2, 0.2, 0.3, 1.0),
        //     vec4.fromValues(0.0, 0.0, 0.0, 0.0),
        //     vec4.fromValues(0.2, 0.2, 0.2, 1.0));
        // const terrainMaterial = this.materialFactory.terrainMaterial('terrain', terrainMaterialProperties, {
        //     cullFace: 'back',
        //     depthWriteEnabled: true
        // });
        //
        // const terrainGeometryData = new TerrainGeometry();
        // const geometry = this.geometryFactory.createGeometry(`terrain-geometry`, VertexShaderName.TERRAIN, terrainGeometryData.GEOMETRY_DESCRIPTOR);

        // const terrainMesh = this.meshFactory.newMesh('Terrain', terrainMaterial, geometry);

        // const renderTerrain = (transform: vec3) => this.scene.addEntity(this.createEntity('Terrain', terrainMesh, defaultTransform()
        //     .translate(transform)
        //     .rotate(vec3.fromValues(0, 0, 0))));

        // renderTerrain(vec3.fromValues(
        //     -TerrainGeometry.WIDTH / 2, TerrainGeometry.MIN_HEIGHT, -TerrainGeometry.HEIGHT / 2));
    }

    /**
     * Intended for debugging, add 3 new meshes with different materials. Its expected for them to be rendered correctly.
     * In webgl2 this works as intended, however in webgpu it does not.
     * @private
     */
    private addMeshCopies() {
        /*    const cubeGeometry = this.geometryFactory.createGeometry('cube-geometry', VertexShaderName.UNLIT_GEOMETRY, CubeGeometry.GEOMETRY_DESCRIPTOR);
            const sphereGeometry = this.geometryFactory.createGeometry('sphere-geometry', VertexShaderName.UNLIT_GEOMETRY, new SphereGeometry().geometryData);
            const unlitProperties1 = new UnlitMaterial(
                [RenderFlags.OUTLINE, ShapeFlags.CUBE],
                vec4.fromValues(1.0, 0.0, 0.0, 1.0),
                vec4.fromValues(1.0, 0.0, 1.0, 1.0));
            const unlitProperties2 = new UnlitMaterial(
                [RenderFlags.FILL_ONLY, ShapeFlags.CUBE],
                vec4.fromValues(0.432, 0.23, 0.87, 0.5),
                vec4.fromValues(0.0, 0.0, 0.0, 0.0));
            const unlitProperties3 = new UnlitMaterial(
                [RenderFlags.OUTLINE, ShapeFlags.SPHERE],
                vec4.fromValues(0.0, 0.0, 0.98, 0.3),
                vec4.fromValues(1.0, 1.0, 1.0, 1.0));
            const mesh1 = this.meshFactory.newMesh('mesh1', this.materialFactory.unlit('material1', {}, unlitProperties1), cubeGeometry)
            const mesh2 = this.meshFactory.newMesh('mesh2', this.materialFactory.unlit('material2', { blendMode: BlendPresets.TRANSPARENT }, unlitProperties2), cubeGeometry)
            const mesh3 = this.meshFactory.newMesh('mesh3', this.materialFactory.unlit('material3', {
                cullFace: 'front',
                blendMode: BlendPresets.TRANSPARENT
            }, unlitProperties3), sphereGeometry)*/

        /*
                this.scene.addEntity(this.createEntity('Cube', mesh1, defaultTransform()
                    .translateBy(0, 10, -10)
                    .rotate(vec3.fromValues(0, 45, 0))
                    .scaleBy(5)));
                this.scene.addEntity(this.createEntity('Cube2', mesh2, defaultTransform()
                    .translateBy(-10, 10, 10)
                    .scaleBy(5)));
                this.scene.addEntity(this.createEntity('Sphere', mesh3, defaultTransform()
                    .translateBy(10, 10, 0)
                    .rotate(vec3.fromValues(45, 0, 0))
                    .scaleBy(5)));*/
    }

    private createEntityWithBoundingSphere(label: string,
                                           vertexShader: VertexShaderName,
                                           geometryData: GeometryData,
                                           material: Material,
                                           transformation: Transform) {
        const geometry = this.geometryFactory.createGeometry(`${label}-geometry`, vertexShader, geometryData);
        const boundingSphere = new BoundingSphere(geometryData.vertices, geometryData.indices);
        geometry.addBoundingVolume(BoundingSphere, boundingSphere);

        // const mesh = this.meshFactory.newMesh(label, material, geometry);

        // const boundingSphereMesh = this.createBoundingSphereMesh({
        //     center: boundingSphere.getCenter(),
        //     radius: boundingSphere.radius
        // });

        this.scene.addEntities(
            // this.entityFactory.createEntityInstance(label, mesh, transformation),
            // this.entityFactory.createEntityInstance(`${label}-bounding-sphere`, boundingSphereMesh, transformation),
        )
    }

    /*private createBoundingSphereMesh(properties: Partial<SphereProperties>) {
        const boundingSphereMaterialProperties = new UnlitMaterial(
            [RenderFlags.OUTLINE, ShapeFlags.SPHERE],
            vec4.fromValues(0.3234, 0.254, 0.889, 0.25),
            vec4.fromValues(1.0, 1.0, 1.0, 1.0));
        const boundingSphereMaterial = this.materialFactory.unlit(
            'BoundingSphere', {
                cullFace: 'front',
                blendMode: BlendPresets.TRANSPARENT,
                depthWriteEnabled: false,
                writeMask: 'ALL'
            },
            boundingSphereMaterialProperties);

        const geometryData = new SphereGeometry(properties).geometryData;
        const boundingSphereGeometry = this.geometryFactory.createGeometry(
            'Sphere', VertexShaderName.UNLIT_GEOMETRY, geometryData)

        return this.meshFactory.newMesh('bounding-sphere', boundingSphereMaterial, boundingSphereGeometry);

    }*/

    private createEntity(name: EntityName, ...components: Component[]): EntityId {
        const entity = this.entityManager.createEntity(name);

        this.entityManager.addComponents(entity, components)

        return entity;
    }

    private createFreeCamera() {
        const forward = vec3.fromValues(0, 0, -1);
        const up = vec3.fromValues(0, 1, 0);
        const rotation = quat.fromEuler(quat.create(), 0, 90, 10);
        const position = vec3.fromValues(5, 3, 0);
        return new CameraComponent(
            // vec3.fromValues(52, 12, -1.5),
            position,
            rotation,
            // quat.fromValues(-0.07, 0.7, 0.07, 0.7),
            0.3,
            15.0, // lerp factor
            10, // max speed
            10, // acceleration
            30, // deceleration
            forward,
            up,
            // vec3.fromValues(-1, 0.2, 0),
            // vec3.fromValues(0.2, 1, 0)
        );
    }

    private createInput() {
        const input = new Input();

        input.inputState = {
            mousePos: vec2.create(),
            mouseDelta: vec2.create(),
            wheel: vec3.create(),
            deltaWheel: vec3.create(),
            inputFlags: {}
        };
        return input;
    }

    /*  // TODO: This creates new meshes every time, while we should be creating new instances
      private createMesh(name: string,
                         shaderId: ShaderId,
                         geometry: GeometryComponent,
                         transform: Transform = defaultTransform(),
                         props: Partial<PipelineOptions> = DEFAULT_PIPELINE_OPTION,
                         data: Record<string, Float32Array | Texture> = {},
                         flags: number = 0) {
          const mesh = this.meshFactory.createFromCustomizedDefault(name, shaderId, geometry, props, data, flags);

          const radius = geometry.data.sphereBoundingBox.radius;
          const meshBoundingBox = this.meshFactory.createFromCustomizedDefault(
              `${name}-bound-sphere`,
              ShaderId.SPHERE,
              new SphereGeometry({ radius }),
              // new SphereGeometry({ wireframe: true, radius }),
              { cullFace: 'front' },
              {},
              // { 'Material': new Float32Array([0.7, 0.7, 0.5, 0.1, 1.0, 1.0, 1.0, 0.1]) },
              RenderFlags.OUTLINE, BasicShaderShapes.SPHERE)
          // RenderFlags.OUTLINE, BasicShaderShapes.SPHERE)


          this.scene.addEntity(this.createEntity(name), mesh, transform.createModelMatrix())
          this.scene.addEntity(this.createEntity(`${name}-bounding_sphere`), meshBoundingBox, transform.createModelMatrix())
      }*/

    // private createInstance(name: string ,mesh: MeshId, transform = defaultTransform()) {
    //     this.scene.addEntity(this.createEntity(name), mesh, transform.createModelMatrix())
    //     this.scene.addEntity(this.createEntity(`${name}-bounding_sphere`), meshBoundingBox, transform.createModelMatrix())
    // }
    private async loadAndAddMesh(label: string, meshCreator: (cache?: boolean) => Promise<Mesh>, translate: number[] = [0, 0, 0], scaleFactor: number = 1) {
        console.time(`Loading ${label} took:`);
        const mesh = await meshCreator.bind(this.modelRepository)();
        const entity = this.entityManager.createEntity(label);
        const transform = defaultTransform().scaleBy(scaleFactor).translate(translate);
        this.entityManager.addComponents(entity, [mesh, transform]);
        this.scene.addEntities(entity);
        console.timeEnd(`Loading ${label} took:`);
    }
}

export type OnRenderPlugin = () => void;

// let i = 0;
// traverse(meshes, mesh => {
//     i += 1;
//     if (!mesh.pipelineId) {
//         const entityId = this.entityFactory.createEntity(`${mesh.label}`, mesh.transform);
//         this.scene.addEntity(entityId);
//         return;
//     }
//
//     const entityId = this.entityFactory.createEntityInstance(`${mesh.label}`, mesh, mesh.transform);
//     this.scene.addEntities(entityId);
//     // SdiPerformance.log('Added the whole Sponza Atrium to the scene');
// });


function lookAtWithOffset(position: vec3, target: vec3, up: vec3): mat4 {
    // Compute forward vector
    const forward = vec3.create();
    vec3.subtract(forward, target, position);
    vec3.normalize(forward, forward);

    // Compute right vector
    const right = vec3.create();
    vec3.cross(right, up, forward);
    vec3.normalize(right, right);

    // Compute corrected up vector
    const correctedUp = vec3.create();
    vec3.cross(correctedUp, forward, right);
    vec3.normalize(correctedUp, correctedUp);

    // Build rotation matrix
    const rotation = mat4.create();
    mat4.set(rotation,
        right[0], correctedUp[0], -forward[0], 0,
        right[1], correctedUp[1], -forward[1], 0,
        right[2], correctedUp[2], -forward[2], 0,
        0, 0, 0, 1
    );

    // Build translation matrix
    const translation = mat4.create();
    mat4.translate(translation, translation, position);

    // Combine translation and rotation
    const modelMatrix = mat4.create();
    mat4.multiply(modelMatrix, translation, rotation);

    return modelMatrix;
}
