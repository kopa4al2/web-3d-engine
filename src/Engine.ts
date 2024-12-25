import Canvas from 'Canvas';
import CameraComponent from 'core/components/camera/CameraComponent';
import ProjectionMatrix from 'core/components/camera/ProjectionMatrix';
import Component from 'core/components/Component';
import Input from 'core/components/Input';
import Mesh from 'core/components/Mesh';
import Transform, { defaultTransform } from 'core/components/Transform';
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
import { glMatrix, quat, vec2, vec3, vec4 } from 'gl-matrix';
// import { enableEntitySelect, LightControls } from 'html/Controls';
// import { worldCoordinates } from 'html/Views';
import { SdiColor, SdiDirection, SdiPoint3D } from './types/engine-types/EngineTypes';
import DebugUtil from './util/DebugUtil';
import ObjectUtils from './util/ObjectUtils';
import MaterialControl from './engine/ui/controls/MaterialControl';

export default class Engine {

    private isRunning = false;
    private frameRequest = 0;

    private lastFrame: number = 0;

    private readonly resourceManager: ResourceManager;
    private readonly entityFactory: EntityFactory;
    private readonly materialFactory: MaterialFactory;
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
        public onRenderPlugins: OnRenderPlugin[]) {

        this.resourceManager = new ResourceManager(graphicsApi);
        this.entityFactory = new EntityFactory(this.entityManager);
        this.shaderManager = new ShaderManager(this.graphicsApi, this.resourceManager);
        this.materialFactory = MaterialControl.wrapFactory(new MaterialFactory(this.resourceManager));
        this.geometryFactory = new GeometryFactory(this.resourceManager);
        this.modelRepository = new ModelRepository(this.geometryFactory, this.materialFactory, this.shaderManager, this.resourceManager);

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

    initializeScene(): void {

        // this.initializeTerrain();


        const renderLightBulb = (transform: vec3) => this.modelRepository.lightBulb()
            .then(mesh => {
                this.scene.addEntities(
                    this.entityFactory.createEntityInstance('lightBulb', mesh, defaultTransform().scaleBy(10).translate(transform)),
                );
            })

        const entities = {
            // dragon: (coordinates: vec3) => renderDragon(coordinates),
            lightBulb: (transform: vec3) => renderLightBulb(transform),
            // square: (transform: vec3) => renderCube(transform),
            // sphere: (transform: vec3) => renderSphere(transform),
            // grass: (transform: Transform) => renderWavefront('grass', transform),
            // bunny: (coordinates: Transform) => renderWavefront('bunny', coordinates),
            // camera: (coordinates: Transform) => renderWavefront('camera', coordinates),

            // wavefront: (transform: vec3, key: keyof typeof ModelRepository.wavefrontFiles) => renderWavefront(transform, key)
        }

        // renderWavefront('barrel', defaultTransform().translate([-5, 10, -5]));

        // this.modelRepository.createSkyBox().then(m => {
        //     this.scene.addEntities(this.entityFactory.createEntity(`SKY_BOX`, m, new OrderComponent(1)));
        // });
        const sunLight = new DirectionalLight({
            direction: new SdiDirection(-0.13, -0.2, -0.1, 1.0),
            color: new SdiColor(1.0, 1.0, 1.0, 1.0),
            intensity: 1.0
        });
        const sunLightEntity = this.entityFactory.createEntity('Sun', sunLight);
        this.scene.addEntities(sunLightEntity);

        this.createPointLight('BRIGHT_POINT',
            {
                color: PointLight.MOON_LIGHT, quadraticAttenuation: 0.001,
                linearAttenuation: 0.001, intensity: 4
            },
            defaultTransform().translate([0, 30, 0]));


        // this.createSpotLight('SPOT_LIGHT_2', {
        //     color: vec4.fromValues(0, 1, 1, 1),
        //     intensity: 20,
        //     innerCutoff: Math.cos(glMatrix.toRadian(60.0))
        // });
        // this.createPointLight('Red', { color: PointLight.WARM_LIGHT }, defaultTransform().translate([10, 10, 0]));


        // this.loadAndAddMesh(() => this.modelRepository.createCrate(), [10, 15, -15])
        // this.loadAndAddMesh(() => this.modelRepository.lightBulb(), [10, 15, -15])


        const promiseQueue = new PromiseQueue();

        function traverse(mesh: Mesh, onRender: (m: Mesh) => void) {
            promiseQueue.addTask(async () => onRender(mesh));

            for (const subMesh of mesh.subMesh) {
                traverse(subMesh, onRender);
            }
        }

        // this.modelRepository.lightBulb().then(meshes => {
        //     const lightTransform = defaultTransform();
        //     meshes.modelMatrix.children.push(lightTransform);
        //     lightTransform.parent = meshes.modelMatrix;
        //     mat4.targetTo(lightTransform.worldTransform.mat4, lightTransform.localTransform.position, meshes.modelMatrix, vec3.fromValues(0, 1, 0));
        //     traverse(meshes, mesh => {
        //         if (!mesh.pipelineId) {
        //             const entityId = this.entityFactory.createEntity(`no-transform`, mesh.modelMatrix);
        //             this.scene.addEntity(entityId);
        //             return;
        //         }
        //         const entityId = this.entityFactory.createEntityInstance(
        //             `${ mesh.geometry.vertexBuffer.toString() }`,
        //             mesh, mesh.modelMatrix);
        //         this.scene.addEntities(entityId);
        //     });
        //     promiseQueue
        //         .addTask(async () => this.createSpotLight('BulbLight', { color: vec4.fromValues(1.0, 0.2, 0.7, 1) }, lightTransform));
        // });


        SdiPerformance.log('Begin loading Sponza Atrium');
        this.modelRepository.drawScene()
            .then(meshes => {
                SdiPerformance.log('Sponza atrium loaded in memory, about to load it in the scene');
                let i = 0;
                traverse(meshes, mesh => {
                    i += 1;
                    if (!mesh.pipelineId) {
                        const entityId = this.entityFactory.createEntity(`no-mesh-${i}`, mesh.transform);
                        this.scene.addEntity(entityId);
                        return;
                    }
                    // if (i > 10) {
                    //     return;
                    // }
                    const entityId = this.entityFactory.createEntityInstance(
                        `${i}-${mesh.geometry.vertexBuffer.toString()}`,
                        mesh, mesh.transform);
                    this.scene.addEntities(entityId);
                });
                SdiPerformance.log('Added the whole Sponza Atrium to the scene');
                this.loadAndAddMesh(() => this.modelRepository.createCrate(), [-5, 10, 10])
            });

        // this.modelRepository.lightBulb().then(mesh => {
        //     this.scene.addEntities(
        //         this.entityFactory.createEntityInstance('lightBulb', mesh, defaultTransform().scaleBy(10).translate([-8, -15, -5])),
        //     );
        // })
        // this.modelRepository.dragon().then(mesh => {
        //     this.scene.addEntities(
        //         this.entityFactory.createEntityInstance('dragon', mesh, defaultTransform().translate([-8, 15, -5])),
        //         this.entityFactory.createEntityInstance('dragon', mesh, defaultTransform().scaleBy(0.5).translate([0, 0, 0])),
        //     )
        // })
        // this.modelRepository.dragon().then(mesh => {
        //     this.scene.addEntities(
        //         this.entityFactory.createEntityInstance('dragon', mesh, defaultTransform().translate([-12, -15, 5])),
        //         this.entityFactory.createEntityInstance('dragon', mesh, defaultTransform().scaleBy(0.5).translate([10, 10, 10])),
        //     )
        // })
        /* this.modelRepository.createCrate(false)
             .then(mesh => {
                 this.scene.addEntities(
                     this.entityFactory.createEntityInstance('crate', mesh, defaultTransform().scaleBy(0.05).translate([-13, 35, 25])),
                     this.entityFactory.createEntityInstance('crate', mesh, defaultTransform().scaleBy([0.16, 0.08, 0.08]).translate([15, 15, -32]))
                 )
             })*/

        // const frustumGeometry = this.geometryFactory.createFrustumDescriptor(VertexShaderName.UNUSED_OLD_BASIC);
        // const frustumMaterial = this.materialFactory.viewFrustumMaterial();
        // const mesh = this.meshFactory.newNotInstancedMesh(frustumMaterial, frustumGeometry);
        // const frustumEntity = this.createEntity('ViewFrustum', new Frustum(), mesh);
        // this.scene.addEntity(frustumEntity);

        // this.addMeshCopies();

        // entities.dragon(vec3.fromValues(10, 15, -10));
        // entities.lightBulb(vec3.fromValues(-8, 4, 22));
        // entities.lightBulb(vec3.fromValues(-12, 9, 9));

        // enableEntitySelect(this.canvas.parent, Object.keys(entities),
        //     e => {
        //         console.log('ADD ', e);
        //         const { selectedEntity, coordinates } = e;
        //         // @ts-ignore
        //         entities[selectedEntity](coordinates, selectedEntity);
        //     })
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
        // worldCoordinates(this.properties, this.freeCameraComponent, this.projectionMatrix, this.input, this.canvas.parent);
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
            // position: vec4.fromValues(0, 0, 0, 1),
            // direction: quat.create(),
            color: vec4.fromValues(1, 1, 1, 1),
            innerCutoff: Math.cos(glMatrix.toRadian(20.0)),
            outerCutoff: Math.cos(glMatrix.toRadian(30.0)),
            intensity: 5.0,
            constantAttenuation: 1.0,
            linearAttenuation: 0.09,
            quadraticAttenuation: 0.032
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
        return new CameraComponent(
            vec3.fromValues(52, 12, -1.5),
            quat.fromValues(-0.07, 0.7, 0.07, 0.7),
            0.2,
            15.0,
            30,
            30,
            30,
            vec3.fromValues(-1, 0.2, 0),
            vec3.fromValues(0.2, 1, 0)
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
    private loadAndAddMesh(meshCreator: (cache?: boolean) => Promise<Mesh>, translate: number[] = [0, 0, 0]) {
        meshCreator()
            .then(mesh => {
                const transform = Transform.copyOf(mesh.transform).translate(translate);
                const transform2 = Transform.copyOf(mesh.transform).translate([3, 40, 5]);
                mesh.transform = transform;
                this.scene.addEntities(
                    this.entityFactory.createEntityInstance(`${mesh.material.label}`, mesh, transform),
                    this.entityFactory.createEntityInstance(`${mesh.material.label}`, mesh, transform2),
                    // this.entityFactory.createEntityInstance('crate', mesh, mesh.transform.scaleBy(0.05).translate([0, 0, 0])),
                    // this.entityFactory.createEntityInstance('crate', mesh, mesh.transform.scaleBy(0.1).translate([8, -41, -67])),
                    // this.entityFactory.createEntityInstance('crate', mesh, mesh.transform.scaleBy([0.16, 0.08, 0.08]).translate([15, 25, -2])),
                    // this.entityFactory.createEntityInstance('crate', mesh, mesh.transform.scaleBy(0.1).translate([-23, 51, 15])),
                )
            })
    }
}

export type OnRenderPlugin = () => void;
