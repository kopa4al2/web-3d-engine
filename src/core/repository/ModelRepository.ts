import Mesh from 'core/components/Mesh';
import Transform, { defaultTransform } from "core/components/Transform";
import GeometryFactory from 'core/factories/GeometryFactory';
import MaterialFactory from 'core/factories/MaterialFactory';
import { PBRMaterialProperties, PhongMaterialProperties } from 'core/mesh/material/MaterialProperties';
import GLTFParser from "core/parser/GLTFParser";
import ObjParser from 'core/parser/ObjParser';
import { VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import { BufferUsage } from "core/resources/gpu/BufferDescription";
import ResourceManager from 'core/resources/ResourceManager';
import ShaderManager from 'core/resources/shader/ShaderManager';
import Texture from "core/texture/Texture";
import { vec4 } from "gl-matrix";
import MathUtil from 'util/MathUtil';
import Cube from "core/geometries/Cube";


const cacheablePromise = <T>(promise: Promise<T>): () => Promise<T> => {
    let data: T | null = null;
    let i = 0;
    return () => data
        ? Promise.resolve(data)
        : promise.then(result => {
            data = result;
            return data;
        })
}

class ModelRepository {

    private readonly models: Map<string, Mesh> = new Map();

    constructor(private geometryFactory: GeometryFactory,
                private materialFactory: MaterialFactory,
                private shaderManager: ShaderManager,
                private resourceManager: ResourceManager) {
        // this.resourceManager.textureManager.loadCubeMap('assets/environment-map/snow-4k-hdr/', ['px.hdr', 'nx.hdr', 'py.hdr', 'ny.hdr', 'pz.hdr', 'nz.hdr'], true);
        // this.resourceManager.textureManager.loadCubeMap('assets/environment-map/PureSkyCubemap/', ['px.hdr', 'nx.hdr', 'py.hdr', 'ny.hdr', 'pz.hdr', 'nz.hdr'], true);
        // this.resourceManager.textureManager.loadCubeMap('assets/environment-map/Forest1024hdr/', ['px.hdr', 'nx.hdr', 'py.hdr', 'ny.hdr', 'pz.hdr', 'nz.hdr'], true);
        // this.resourceManager.textureManager.loadCubeMap('assets/environment-map/forest-4k-png/', ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png']);
        // this.resourceManager.textureManager.loadCubeMap('assets/environment-map/snow-4k-png/', ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png']);

    }

    async createSkyBox() {
        const geometry = this.geometryFactory.createGeometry('skybox', VertexShaderName.SKY_BOX, Cube.geometry);
        const material = this.materialFactory.skybox();
        const pipeline = this.shaderManager.createPipeline(geometry, material);
        
        return new Mesh(pipeline, geometry, material, defaultTransform().scaleBy(30));
    }

    async createCrate(cache: boolean = true): Promise<Mesh> {
        if (cache && this.models.has('crate')) {
            const existing = this.models.get('crate')!;
            return new Mesh(existing.pipelineId, existing.geometry, existing.material, defaultTransform(), existing.instanceBuffers, existing.subMesh);
        }

        const obj = await cacheablePromise(ObjParser.parseObjFile('assets/advanced/crate/crate.obj'))();
        const geometryData = MathUtil.calculateTBNV(obj.meshes[0]);
        const geometry = this.geometryFactory.createGeometry(`crate-geometry`, VertexShaderName.LIT_GEOMETRY, geometryData);

        const metallicRoughnessMap = await this.resourceManager.textureManager
            .create1x1Texture(Texture.DEFAULT_METALLIC_ROUGHNESS_MAP, new Uint8ClampedArray([
                255,
                Math.floor(1.0 * 255), // G = Roughness
                Math.floor(1.0 * 255), // B = Metallic
                255,]));
        const albedo = await this.resourceManager.textureManager.addToGlobalTexture('assets/advanced/crate/crate.png');
        const normal = await this.resourceManager.textureManager.addToGlobalTexture('assets/advanced/crate/crateNormal.png');
        const material = this.materialFactory.pbrMaterial('CratePbr', new PBRMaterialProperties(albedo, normal, metallicRoughnessMap, vec4.fromValues(1, 1, 1, 1)));

        const vertexInstancedBuffer = this.resourceManager.createBufferV2({
            label: `crate-vertex-instance`,
            byteLength: 4096,
            usage: BufferUsage.STORAGE | BufferUsage.COPY_DST
        });
        const vertexInstancedLayout = this.resourceManager.getOrCreateLayout(ShaderManager.INSTANCE_BUFFER_GROUP);
        const vertexBindGroup = this.resourceManager.createBindGroup(vertexInstancedLayout, {
            label: 'instance',
            entries: [{
                binding: 0,
                bufferId: vertexInstancedBuffer,
                name: 'InstanceData',
                type: 'storage'
            }]
        })

        const pipeline = this.shaderManager.createPipeline(geometry, material);
        const mesh = new Mesh(pipeline, geometry, material, defaultTransform().scaleBy(0.05), [{
            bindGroupId: vertexBindGroup,
            bufferId: vertexInstancedBuffer
        }]);
        this.models.set('crate', mesh);
        return mesh;
    }

    async dragon(cache: boolean = true): Promise<Mesh> {
        if (cache && this.models.has('dragon')) {
            return this.models.get('dragon')!;
        }

        const obj = await cacheablePromise(ObjParser.parseObjFile('assets/advanced/dragon.obj'))();
        const geometry = this.geometryFactory.createGeometry(`dragon-geometry`, VertexShaderName.LIT_GEOMETRY, obj.meshes[0]);

        const normal = await this.resourceManager.textureManager.addToGlobalTexture('assets/DALL·E-tex-1.webp');
        const material = this.materialFactory.litMaterial('DragonPhong', new PhongMaterialProperties(
            vec4.fromValues(0.2, 0.2, 0.2, 1.0),
            vec4.fromValues(0.2, 0.2, 1.0, 1.0),
            vec4.fromValues(1.0, 0.2, 0.5, 1.0),
        ));

        const vertexInstancedBuffer = this.resourceManager.createBufferV2({
            label: `dragon-vertex-instance`,
            byteLength: 4096,
            usage: BufferUsage.STORAGE | BufferUsage.COPY_DST
        });

        const vertexInstancedLayout = this.resourceManager.getOrCreateLayout(ShaderManager.INSTANCE_BUFFER_GROUP);
        const vertexBindGroup = this.resourceManager.createBindGroup(vertexInstancedLayout, {
            label: 'instance',
            entries: [{
                binding: 0,
                bufferId: vertexInstancedBuffer,
                name: 'InstanceData',
                type: 'storage'
            }]
        })


        const pipeline = this.shaderManager.createPipeline(geometry, material);
        const mesh = new Mesh(pipeline, geometry, material, defaultTransform(), [{
            bindGroupId: vertexBindGroup,
            bufferId: vertexInstancedBuffer
        }]);
        this.models.set('dragon', mesh);
        return mesh;
    }

    async lightBulb(cache: boolean = true): Promise<Mesh> {
        if (cache && this.models.has('lightBulb')) {
            return this.models.get('lightBulb')!;
        }

        const obj = await cacheablePromise(ObjParser.parseObjFile('assets/advanced/light/lightBulb.obj', 'assets/advanced/light/lightBulb.mtl'))();
        console.log('light', obj);
        const geometry = this.geometryFactory.createGeometry(`light-bulb-geometry`, VertexShaderName.LIT_GEOMETRY, obj.meshes[0]);

        const normal = await this.resourceManager.textureManager.addToGlobalTexture('assets/DALL·E-tex-1.webp');
        const material = this.materialFactory.litMaterial('LightBulb', new PhongMaterialProperties(
            vec4.fromValues(0.2, 0.2, 0.2, 1.0),
            vec4.fromValues(0.2, 0.2, 1.0, 1.0),
            vec4.fromValues(1.0, 0.2, 0.5, 1.0),
        ));

        const vertexInstancedBuffer = this.resourceManager.createBufferV2({
            label: `lightBulb-vertex-instance`,
            byteLength: 4096,
            usage: BufferUsage.STORAGE | BufferUsage.COPY_DST
        });

        const vertexInstancedLayout = this.resourceManager.getOrCreateLayout(ShaderManager.INSTANCE_BUFFER_GROUP);
        const vertexBindGroup = this.resourceManager.createBindGroup(vertexInstancedLayout, {
            label: 'instance',
            entries: [{
                binding: 0,
                bufferId: vertexInstancedBuffer,
                name: 'InstanceData',
                type: 'storage'
            }]
        })

        const pipeline = this.shaderManager.createPipeline(geometry, material);
        const mesh = new Mesh(pipeline, geometry, material, Transform.scale(5), [{
            bindGroupId: vertexBindGroup,
            bufferId: vertexInstancedBuffer
        }]);
        this.models.set('lightBulb', mesh);
        return mesh;
    }

    // TODO: Dont accept parser
    // @ts-ignore
    async drawScene(cache: boolean = true): Promise<Mesh> {
        // const gltf = await ModelRepository.cacheables.cube()();
        const gltf = await ModelRepository.cacheables.sponzaAtrium()();
        return await gltf.createMeshes(this.shaderManager, this.geometryFactory, this.materialFactory, this.resourceManager);
    }

    static cacheables = {
        sponzaAtrium: () => cacheablePromise(GLTFParser.parseGltf('assets/scene/sponza_atrium/gltf/', 'scene.gltf', 'scene.bin')),
        // sponzaAtrium: () => cacheablePromise(GLTFParser.parseGlb('assets/scene/sponza_atrium/', 'sponza_atrium_3.glb')),
        fox: () => cacheablePromise(GLTFParser.parseGlb('assets/scene/fox/', 'Fox.glb')),
        cube: () => cacheablePromise(GLTFParser.parseGltf('assets/scene/simple/cube/', 'Cube.gltf', 'Cube.bin')),
    }

    static wavefrontFiles = {
        dragon: cacheablePromise(ObjParser.parseObjFile('assets/advanced/dragon.obj')),
        lightBulb: cacheablePromise(ObjParser.parseObjFile('assets/advanced/light/lightBulb.obj', 'assets/advanced/light/lightBulb.mtl')),
        bunny: cacheablePromise(ObjParser.parseObjFile('assets/advanced/stanford-bunny.obj')),
        camera: cacheablePromise(ObjParser.parseObjFile('assets/camera/camera-1.obj', 'assets/camera/camera-1.mtl')),
        grass: cacheablePromise(ObjParser.parseObjFile('assets/terrain/grassmodels.obj', 'assets/terrain/grassmodels.obj')),
        barrel: cacheablePromise(ObjParser.parseObjFile('assets/advanced/barrel/barrel.obj')),
        crate: cacheablePromise(ObjParser.parseObjFile('assets/advanced/crate/crate.obj')),
    }
}

export default ModelRepository;
