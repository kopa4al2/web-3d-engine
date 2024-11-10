import Canvas from "Canvas";
import CameraComponent from "core/components/camera/CameraComponent";
import LightSource from "core/components/camera/LightSource";
import ProjectionMatrix from "core/components/camera/ProjectionMatrix";
import Component from "core/components/Component";
import CubeGeometry from 'core/components/geometry/CubeGeometry';
import SphereGeometry, { SphereProperties } from 'core/components/geometry/SphereGeometry';
import Input from "core/components/Input";
import Transform, { defaultTransform } from "core/components/Transform";
import EntityFactory from 'core/entities/EntityFactory';
import EntityManager, { EntityId, EntityName } from "core/EntityManager";
import GeometryFactory from 'core/factories/GeometryFactory';
import MaterialFactory from 'core/factories/MaterialFactory';
import Graphics from "core/Graphics";
import TextureLoader from 'core/loader/TextureLoader';
import { GeometryData } from 'core/mesh/Geometry';
import Material from 'core/mesh/Material';
import BoundingSphere from 'core/physics/BoundingSphere';
import PropertiesManager from "core/PropertiesManager";
import ModelRepository from 'core/repository/ModelRepository';
import { VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import { BlendPresets } from 'core/resources/gpu/Blend';
import { BufferUsage } from 'core/resources/gpu/BufferDescription';
import GPUResourceManager from 'core/resources/GPUResourceManager';
import MeshManager, { RenderFlags, ShapeFlags } from 'core/resources/MeshManager';
import Scene from "core/Scene";
import FreeCameraSystem from "core/systems/camera/FreeCameraSystem";
import EntityComponentSystem from "core/systems/EntityComponentSystem";
import InputSystem from "core/systems/InputSystem";
import Renderer from "core/systems/Renderer";
import SceneSystem from 'core/systems/SceneSystem';
import TerrainSystem from "core/systems/terrain/TerrainSystem";
import TransformSystem from "core/systems/TransformSystem";
import { vec2, vec3 } from "gl-matrix";
import { enableEntitySelect } from 'html/Controls';
import { worldCoordinates } from 'html/Views';

export default class Engine {

    public isRunning = false;

    private lastFrame: number = 0;

    private readonly gpuResourceFactory: GPUResourceManager;
    private readonly meshFactory: MeshManager;
    private readonly entityFactory: EntityFactory;
    private readonly materialFactory: MaterialFactory;
    private readonly geometryFactory: GeometryFactory;
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

        this.gpuResourceFactory = new GPUResourceManager(graphicsApi);
        this.meshFactory = new MeshManager(this.gpuResourceFactory);
        this.entityFactory = new EntityFactory(this.entityManager);
        this.materialFactory = new MaterialFactory(this.gpuResourceFactory);
        this.geometryFactory = new GeometryFactory(this.gpuResourceFactory);

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
        // const terrain = this.createEntity('TERRAIN',
        //     this.gpuResourceFactory.getMesh('TERRAIN'),
        //     defaultTransform()
        //         .translate(vec3.fromValues(
        //             -TerrainGeometry.WIDTH / 2,
        //             TerrainGeometry.MIN_HEIGHT,
        //             -TerrainGeometry.HEIGHT / 2)));


        const baseTexture = this.gpuResourceFactory.createTexture('BASIC', TextureLoader.textures['texture']);
        const textures = { 'uSampler': baseTexture };


        const texturedMaterial = this.materialFactory.litMaterial('Textured', {
            data: {
                'Material': new Float32Array(
                    [0.3, 0.3, 0.3, 1.0,
                        1.0, 1.0, 1.0, 1.0,
                        0.4, 0.4, 0.4, 1.0]),
                ...textures
            }
        });

        const litMaterial = this.materialFactory.litMaterial('ElectricGreen', {
            data: {
                'Material': new Float32Array(
                    [0.0, 0.2, 0.6, 1.0,
                        0.1, 0.8, 0.2, 1.0,
                        0.2, 0.2, 0.2, 1.0])
            }
        });
        const litColored = this.materialFactory.litMaterial('ColoredLitMaterial',
            {
                data: {
                    'Material': new Float32Array(
                        [0.2, 0.2, 0.2, 1.0,
                            0.0, 0.0, 0.5, 0.5,
                            0.5, 0.5, 0.5, 1.0])
                }
            });
        const unlitCubeMaterial = this.materialFactory.shapeMaterial(ShapeFlags.CUBE, 'CubeMaterial',
            { data: { 'Material': new Float32Array([0.5, 0.11, 1.0, 1.0]), }, });

        const renderCube = () => this.createEntityWithBoundingSphere('CubeLit',
            VertexShaderName.BASIC_WITH_LIGHT, CubeGeometry.GEOMETRY_DESCRIPTOR,
            litColored, defaultTransform().scaleBy(2).translate([-4, 5, 5]));


        const renderSphere = () => this.createEntityWithBoundingSphere('Sphere1',
            VertexShaderName.BASIC_WITH_LIGHT,
            new SphereGeometry().geometryData,
            texturedMaterial,
            defaultTransform().translate([-10, 2, 2]).scaleBy(2));

        const renderDragon = (coordinates: vec3) => ModelRepository.wavefrontFiles.dragon().then(obj => {
            obj.meshes.forEach(geometry => {
                this.createEntityWithBoundingSphere('DRAGON', VertexShaderName.BASIC_WITH_LIGHT,
                    geometry, litMaterial, defaultTransform().translate(coordinates));

                // this.createEntityWithBoundingSphere('TEXTURED', VertexShaderName.BASIC_WITH_LIGHT,
                //     geometry, texturedMaterial, defaultTransform().translate([0, -25, 5]));
            });
        })


        const renderLightBulb = () => ModelRepository.wavefrontFiles.lightBulb().then(obj => {
            obj.meshes.forEach(geometry => {
                this.createEntityWithBoundingSphere(`LightBulb-${geometry.groupName}`,
                    VertexShaderName.BASIC_WITH_LIGHT, geometry, texturedMaterial, defaultTransform().translate([0, 10, 15]).scaleBy(10));
            });
        })


        const entities = {
            dragon: (coordinates: vec3) => renderDragon(coordinates),
            lightBulb: renderLightBulb,
            square: renderCube,
            sphere: renderSphere
        }
        enableEntitySelect(this.canvas.parent, ['dragon', 'lightBulb', 'square', 'sphere'],
                e => {
            console.log('ADD ', e);
            const { selectedEntity, coordinates } = e;
            // @ts-ignore
            entities[selectedEntity](coordinates);
        })
        this.ecs.registerUpdateSystems(
            new SceneSystem(this.entityManager),
            new InputSystem(this.entityManager, this.properties, this.canvas.htmlElement),
            new TransformSystem(this.entityManager),
            new FreeCameraSystem(this.entityManager, this.properties)
        );

        this.ecs.registerSystems(
            new Renderer(this.graphicsApi, this.entityManager, this.meshFactory),
            new TerrainSystem(this.graphicsApi));
        worldCoordinates(this.properties, this.freeCameraComponent, this.projectionMatrix, this.input, this.canvas.parent);
    }

    private createEntityWithBoundingSphere(label: string,
                                           vertexShader: VertexShaderName,
                                           geometryData: GeometryData,
                                           material: Material,
                                           transformation: Transform) {

        const geometry = this.geometryFactory.createDescriptor(label, vertexShader, geometryData);
        const boundingSphere = new BoundingSphere(geometryData.vertices, geometryData.indices);
        geometry.addBoundingVolume(BoundingSphere, boundingSphere);

        const mesh = this.meshFactory.createMeshInstanced(label, material, geometry);
        const boundingSphereMesh = this.createBoundingSphereMesh({
            center: boundingSphere.getCenter(),
            radius: boundingSphere.radius
        });

        this.scene.addEntities(
            this.entityFactory.createEntityInstance(label, mesh, transformation),
            // this.entityFactory.createEntity(`${label}-bounding-sphere`, boundingSphereMesh, transformation),
        )
    }

    private createBoundingSphereMesh(properties: Partial<SphereProperties>) {
        if (this.meshFactory.getMeshByLabel('bounding-sphere') !== undefined) {
            // return this.meshFactory.getMeshByLabel('bounding-sphere');
        }
        // const boundingSphereMaterial = this.materialFactory.unlitMaterial(`BoundingSphere-${Math.random()}`, {
        const boundingSphereMaterial = this.materialFactory.unlitWithFlags([RenderFlags.OUTLINE, ShapeFlags.SPHERE], 'BoundingSphere', {
            properties: {
                cullFace: 'front',
                blendMode: BlendPresets.TRANSPARENT,
                depthWriteEnabled: false,
                writeMask: 'ALL'
            },
            data: {
                'Material': new Float32Array([
                    0.3, 0.3, 0.7, 0.3,
                    0.1, 0.0, 0.0, 1.0
                ]),
            }
        });

        const geometryData = new SphereGeometry(properties).geometryData;
        const boundingSphereGeometry = this.geometryFactory.createDescriptor(
            'Sphere', VertexShaderName.SPHERE, geometryData)

        return this.meshFactory.createMeshInstanced('bounding-sphere', boundingSphereMaterial, boundingSphereGeometry);
    }

    private createEntity(name: EntityName, ...components: Component[]): EntityId {
        const entity = this.entityManager.createEntity(name);

        this.entityManager.addComponents(entity, components)

        return entity;
    }

    private createFreeCamera() {
        const freeCameraComponent = new CameraComponent(
            // vec3.fromValues(-24, 19, -31),
            vec3.fromValues(-0, 25, 40),
            vec3.fromValues(0.1, -0.5, -0.9),
            vec3.fromValues(0, 1, 0));
        // Manually rotate the camera
        freeCameraComponent.euler.asVec3()[0] = -99;
        freeCameraComponent.euler.asVec3()[1] = -16
        freeCameraComponent.targetEuler.asVec3()[0] = -99;
        freeCameraComponent.targetEuler.asVec3()[1] = -16;
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
