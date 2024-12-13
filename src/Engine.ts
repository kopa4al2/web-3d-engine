import Canvas from "Canvas";
import CameraComponent from "core/components/camera/CameraComponent";
import LightSource from "core/components/camera/LightSource";
import ProjectionMatrix from "core/components/camera/ProjectionMatrix";
import Component from "core/components/Component";
import TerrainGeometry from 'core/components/geometry/TerrainGeometry';
import Input from "core/components/Input";
import mesh from "core/components/Mesh";
import Mesh from "core/components/Mesh";
import Transform, { defaultTransform } from "core/components/Transform";
import EntityFactory from 'core/entities/EntityFactory';
import EntityManager, { EntityId, EntityName } from "core/EntityManager";
import GeometryFactory from 'core/factories/GeometryFactory';
import MaterialFactory from 'core/factories/MaterialFactory';
import Graphics from "core/Graphics";
import { GeometryData } from 'core/mesh/Geometry';
import Material from 'core/mesh/material/Material';
import { TerrainMaterialProperties } from 'core/mesh/material/MaterialProperties';
import BoundingSphere from 'core/physics/BoundingSphere';
import PropertiesManager from "core/PropertiesManager";
import entityRepository from "core/repository/EntityRepository";
import ModelRepository from 'core/repository/ModelRepository';
import { VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import ResourceManager from 'core/resources/ResourceManager';
// import MeshManager, { RenderFlags, ShapeFlags } from 'core/resources/MeshManager';
import ShaderManager from "core/resources/ShaderManager";
import Scene from "core/Scene";
import FreeCameraSystem from "core/systems/camera/FreeCameraSystem";
import ViewFrustumSystem from 'core/systems/camera/ViewFrustumSystem';
import EntityComponentSystem from "core/systems/EntityComponentSystem";
import InputSystem from "core/systems/InputSystem";
import Renderer from "core/systems/Renderer";
import SceneSystem from 'core/systems/SceneSystem';
import TerrainSystem from "core/systems/terrain/TerrainSystem";
import TransformSystem from "core/systems/TransformSystem";
import { vec2, vec3, vec4 } from "gl-matrix";
import { enableEntitySelect } from 'html/Controls';
import { worldCoordinates } from 'html/Views';

export default class Engine {

    public isRunning = false;

    private lastFrame: number = 0;

    private readonly resourceManager: ResourceManager;
    // private readonly meshFactory: MeshManager;
    private readonly entityFactory: EntityFactory;
    private readonly materialFactory: MaterialFactory;
    private readonly geometryFactory: GeometryFactory;
    private readonly modelRepository: ModelRepository;
    private readonly scene: Scene;
    private readonly input: Input = this.createInput();
    private readonly freeCameraComponent: CameraComponent = this.createFreeCamera();

    constructor(
        public graphicsApi: Graphics,
        public canvas: Canvas,
        public properties: PropertiesManager,
        public entityManager: EntityManager,
        public ecs: EntityComponentSystem,
        public projectionMatrix: ProjectionMatrix,
        public lightSource: LightSource,
        public onRenderPlugins: OnRenderPlugin[]) {

        this.resourceManager = new ResourceManager(graphicsApi);
        // this.meshFactory = new MeshManager(this.resourceManager);
        this.entityFactory = new EntityFactory(this.entityManager);
        this.materialFactory = new MaterialFactory(this.resourceManager);
        this.geometryFactory = new GeometryFactory(this.resourceManager);
        this.modelRepository = new ModelRepository(this.geometryFactory, this.materialFactory, new ShaderManager(this.graphicsApi, this.resourceManager), this.resourceManager);

        const freeCameraEntity = this.createEntity('CAMERA', this.freeCameraComponent, this.input);
        this.scene = new Scene(this.freeCameraComponent, this.projectionMatrix, this.lightSource, entityManager, [freeCameraEntity]);
        this.entityManager.scenes.push(this.scene);
    }

    start(): void {
        console.log('Engine starting...');
        this.isRunning = true;
        requestAnimationFrame(this.loop.bind(this));
    }

    loop(now: number) {
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

    initializeScene(): void {
        // this.modelRepository.createSkyBox()
        //     .then(m => this.scene.a)
        // this.initializeTerrain();


        // const baseTexture = this.gpuResourceFactory.createTexture('BASIC', TextureLoader.textures['texture']);
        // const waterTexture = this.gpuResourceFactory.createTexture('BASIC', TextureLoader.textures['waterTexture1']);
        // const textures = { 'uSampler': waterTexture };

        // const textured = this.materialFactory.litMaterial('Textured', {
        //     ambient: vec4.fromValues(0.3, 0.3, 0.3, 1.0),
        //     diffuse: vec4.fromValues(1.0, 1.0, 1.0, 1.0),
        //     specular: vec4.fromValues(0.4, 0.4, 0.4, 1.0),
        //     illuminationModel: 0,
        //     shininess: 0,
        //     // textures: [waterTexture],
        // });

        // const litElectricMaterial = this.materialFactory.litMaterial('LitElectric', new PhongMaterialProperties(
        //     vec4.fromValues(0.2, 0.2, 0.2, 1.0),
        //     vec4.fromValues(0.45, 1.0, 0.07, 1.0),
        //     vec4.fromValues(0.2, 0.2, 0.2, 1.0),
        //     // 1.0
        // ));
        //
        // const litMagenta = this.materialFactory.litMaterial('LitMagenta', new PhongMaterialProperties(
        //     vec4.fromValues(0.2, 0.2, 0.2, 1.0),
        //     vec4.fromValues(1.0, 0.0, 1.0, 1.0),
        //     vec4.fromValues(0.2, 0.2, 0.2, 1.0),
        //     // 20.0
        // ));

        // const renderCube = (transform: vec3) => this.createEntityWithBoundingSphere('CubeLit',
        //     VertexShaderName.LIT_GEOMETRY, CubeGeometry.GEOMETRY_DESCRIPTOR,
        //     litElectricMaterial, defaultTransform().scaleBy(2).translate(transform));
        //
        //
        // const renderSphere = (transform: vec3) => this.createEntityWithBoundingSphere('Sphere1',
        //     VertexShaderName.LIT_GEOMETRY,
        //     new SphereGeometry().geometryData,
        //     litMagenta,
        //     defaultTransform().translate(transform).scaleBy(2));
        //
        // const renderDragon = (coordinates: vec3) => ModelRepository.wavefrontFiles.dragon().then(obj => {
        //     obj.meshes.forEach(geometry => {
        //         this.createEntityWithBoundingSphere('DRAGON', VertexShaderName.LIT_GEOMETRY,
        //             geometry, litElectricMaterial, defaultTransform().translate(coordinates));
        //
        //         // this.createEntityWithBoundingSphere('TEXTURED', VertexShaderName.LIT_GEOMETRY,
        //         //     geometry, litMagenta, defaultTransform().translate([-10, -10, 0]).translate(coordinates));
        //     });
        // })


        const renderLightBulb = (transform: vec3) => this.modelRepository.lightBulb()
            .then(mesh => {
                this.scene.addEntities(
                    this.entityFactory.createEntityInstance('lightBulb', mesh, defaultTransform().scaleBy(10).translate(transform)),
                );
            })

        // const renderWavefront = (model: keyof typeof ModelRepository.wavefrontFiles, transform?: Transform) => ModelRepository.wavefrontFiles[model]().then(obj => {
        //     obj.meshes.forEach(objMesh => {
        //         console.log(objMesh)
        //         const objMaterial = objMesh.material;
        //         if (objMaterial) {
        //             console.log(`Obj file ${model} has its own material: `, objMaterial);
        //         }
        //         const material = objMaterial ? this.materialFactory.litMaterial(
        //                 `${model}-${objMesh.groupName}`,
        //                 new PhongMaterialProperties(
        //                     objMaterial.ambient ? MathUtil.vec4(objMaterial.ambient, 1.0) : vec4.fromValues(0.2, 0.2, 0.2, 1.0),
        //                     objMaterial.diffuse ? MathUtil.vec4(objMaterial.diffuse, 1.0) : vec4.fromValues(0.53, 0.11, 0.75, 1.0),
        //                     objMaterial.specular ? MathUtil.vec4(objMaterial.specular, 1.0) : vec4.fromValues(0.35, 0.35, 0.35, 1.0),
        //                     // objMaterial.shininess || 10.0
        //                 ))
        //             : litMagenta;
        //
        //         this.createEntityWithBoundingSphere(`${model}-${objMesh.groupName}`,
        //             VertexShaderName.LIT_GEOMETRY, objMesh, material, transform || defaultTransform());
        //     });
        // })


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

        this.loadAndAddMesh(() => this.modelRepository.createCrate(), [-5, 10, 10])
        // this.loadAndAddMesh(() => this.modelRepository.createCrate(), [10, 15, -15])


        function traverse(mesh: Mesh, onRender: (m: Mesh) => void) {
            if (mesh.pipelineId) {
                // setTimeout(() => {
                //     mesh.material.update(t => {
                //         // console.log(`Material: `, mesh.material.label, 'properties: ', t, mesh.material)
                //     });
                // }, 1000);
                onRender(mesh);
            }

            for (const subMesh of mesh.subMesh) {
                traverse(subMesh, onRender);
            }
        }
        this.modelRepository.drawScene()
            .then(meshes => {
                traverse(meshes, mesh => {
                    const entityId = this.entityFactory.createEntityInstance(mesh.geometry.vertexBuffer.toString(), mesh, mesh.transform.scaleBy(30));
                    this.scene.addEntities(entityId);
                });
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

        enableEntitySelect(this.canvas.parent, Object.keys(entities),
            e => {
                console.log('ADD ', e);
                const { selectedEntity, coordinates } = e;
                // @ts-ignore
                entities[selectedEntity](coordinates, selectedEntity);
            })
        this.ecs.registerUpdateSystems(
            new SceneSystem(this.entityManager),
            new InputSystem(this.entityManager, this.properties, this.canvas.htmlElement),
            new TransformSystem(this.entityManager),
            new FreeCameraSystem(this.entityManager, this.properties)
        );

        this.ecs.registerSystems(
            new Renderer(this.graphicsApi, this.entityManager, this.resourceManager),
            new ViewFrustumSystem(this.entityManager, this.graphicsApi, this.properties),
            new TerrainSystem(this.graphicsApi));
        worldCoordinates(this.properties, this.freeCameraComponent, this.projectionMatrix, this.input, this.canvas.parent);
    }

    private initializeTerrain() {
        const terrainMaterialProperties = new TerrainMaterialProperties(
            vec4.fromValues(0.2, 0.2, 0.3, 1.0),
            vec4.fromValues(0.0, 0.0, 0.0, 0.0),
            vec4.fromValues(0.2, 0.2, 0.2, 1.0));
        const terrainMaterial = this.materialFactory.terrainMaterial('terrain', terrainMaterialProperties, {
            cullFace: 'back',
            depthWriteEnabled: true
        });

        const terrainGeometryData = new TerrainGeometry();
        const geometry = this.geometryFactory.createGeometry(`terrain-geometry`, VertexShaderName.TERRAIN, terrainGeometryData.GEOMETRY_DESCRIPTOR);

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
        const freeCameraComponent = new CameraComponent(vec3.fromValues(0, 25, 46));

        // Manually rotate the camera
        freeCameraComponent.euler.asVec3()[0] = -99;
        freeCameraComponent.euler.asVec3()[1] = -16;
        freeCameraComponent.targetEuler.asVec3()[0] = -99;
        freeCameraComponent.targetEuler.asVec3()[1] = -16;

        // freeCameraComponent.targetEuler.asVec3()[0] = 0;
        // freeCameraComponent.targetEuler.asVec3()[1] = 0;
        return freeCameraComponent;
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
    private loadAndAddMesh(createCrate: (cache?: boolean) => Promise<Mesh>, translate: number[] = [0, 0, 0]) {
        createCrate()
            .then(mesh => {
                this.scene.addEntities(
                    this.entityFactory.createEntityInstance(`${mesh.material.label}`, mesh, mesh.transform.translate(translate)),
                    this.entityFactory.createEntityInstance(`${mesh.material.label}`, mesh, mesh.transform.translate([3, 40, 5])),
                    // this.entityFactory.createEntityInstance('crate', mesh, mesh.transform.scaleBy(0.05).translate([0, 0, 0])),
                    // this.entityFactory.createEntityInstance('crate', mesh, mesh.transform.scaleBy(0.1).translate([8, -41, -67])),
                    // this.entityFactory.createEntityInstance('crate', mesh, mesh.transform.scaleBy([0.16, 0.08, 0.08]).translate([15, 25, -2])),
                    // this.entityFactory.createEntityInstance('crate', mesh, mesh.transform.scaleBy(0.1).translate([-23, 51, 15])),
                )
            })
    }
}

export type OnRenderPlugin = () => void;

function interleaveGeometry(vertices: number[], textures: number[], normals: number[]) {
    return vertices.reduce((acc, _, i) => {
        if (i % 3 !== 0) {
            return acc;
        }
        acc.push(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
        acc.push(textures[i * 2] || 0, textures[i * 2 + 1] || 0);
        acc.push(normals[i * 3] || 0, normals[i * 3 + 1] || 0, normals[i * 3 + 2] || 1);
        return acc;
    }, [] as number []);
    // return [...material.properties.ambient, 1, ...material.properties.diffuse, 1, ...material.properties.specular, 1]
}

/*

public async initializeGpuBuffers() {
    return;
    this.gpuResourceFactory.createMeshFromWavefront('DRAGON', await ModelRepository.wavefrontFiles.dragon());
    this.gpuResourceFactory.createMeshFromWavefront('BUNNY', await ModelRepository.wavefrontFiles.bunny());
    this.gpuResourceFactory.createMeshFromWavefront('LIGHT_BULB', await ModelRepository.wavefrontFiles.lightBulb());
    this.gpuResourceFactory.createMesh('SPHERE',
        new SphereGeometry(), new LightedMaterial({ textures: [TextureLoader.textures['texture']], }));
    this.gpuResourceFactory.createMesh('BOX',
        new CubeGeometry(), new LightedMaterial({ diffuse: vec3.fromValues(1.0, 0.0, 1.0), }))
    this.gpuResourceFactory.createMesh('ARROW',
        new Cone(), new BasicMaterial({ diffuse: vec3.fromValues(1.0, 0.8, 0.2) }))
    this.gpuResourceFactory.createMesh('TERRAIN', new TerrainGeometry(), new TerrainMaterial({
        shaderName: ShaderName.TERRAIN,
        textures: [
            TextureLoader.textures['grassTexture1'],
            TextureLoader.textures['mountainTexture1'],
            TextureLoader.textures['snowTexture1'],
            TextureLoader.textures['waterTexture1'],
        ],
        diffuse: vec3.fromValues(1.0, 1.0, 1.0)
    }));
}*/
