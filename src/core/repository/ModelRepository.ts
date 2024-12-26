import Mesh from 'core/components/Mesh';
import Transform, { defaultTransform } from "core/components/Transform";
import GeometryFactory from 'core/factories/GeometryFactory';
import MaterialFactory from 'core/factories/MaterialFactory';
import Cube from "core/geometries/Cube";
import { PBRMaterialProperties, PhongMaterialProperties } from 'core/mesh/material/MaterialProperties';
import GLTFParser from "core/parser/gltf/GLTFParser";
import ObjParser from 'core/parser/ObjParser';
import { VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import { BufferUsage } from "core/resources/gpu/BufferDescription";
import ResourceManager from 'core/resources/ResourceManager';
import ShaderManager from 'core/resources/shader/ShaderManager';
import TextureManager from "core/resources/TextureManager";
import Texture from "core/texture/Texture";
import { vec4 } from "gl-matrix";
import MathUtil from 'util/MathUtil';
import BufferUtils from "../../util/BufferUtils";


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
            return new Mesh(existing.pipelineId, existing.geometry, existing.material, Transform.copyOf(existing.transform), existing.instanceBuffers, existing.subMesh);
        }

        const obj = await cacheablePromise(ObjParser.parseObjFile('assets/advanced/crate/crate.obj'))();
        // const geometryData = MathUtil.calculateTBNV(obj.meshes[0]);
        // const geometry = this.geometryFactory.createGeometry(`crate-geometry`, VertexShaderName.LIT_GEOMETRY, geometryData);
        const geometryData = MathUtil.calculateTangentsVec4(obj.meshes[0]);
        const geometry = this.geometryFactory.createGeometry(`crate-geometry`, VertexShaderName.LIT_TANGENTS_VEC4, geometryData);
        const [metallicRoughnessMap, albedo, normal] = await Promise.all([
            this.resourceManager.textureManager.create1x1Texture(Texture.DEFAULT_METALLIC_ROUGHNESS_MAP,
                new Uint8ClampedArray([255,
                Math.floor(255), // G = Roughness
                Math.floor(255), // B = Metallic
                255,])),
            this.resourceManager.textureManager.addToGlobalTexture('assets/advanced/crate/crate.png'),
            this.resourceManager.textureManager.addToGlobalTexture('assets/advanced/crate/crateNormal.png')]);
        const material = this.materialFactory.pbrMaterial('CrateMaterial',
            new PBRMaterialProperties(albedo, normal, metallicRoughnessMap.index, vec4.fromValues(1, 1, 1, 1)));

        const vertexInstancedBuffer = this.resourceManager.createBuffer({
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
        const mesh = new Mesh(pipeline, geometry, material, defaultTransform().scaleBy(0.005), [{
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

        const vertexInstancedBuffer = this.resourceManager.createBuffer({
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

        console.log('Loaded light bulb: ', obj);
        const vertexInstancedBuffer = this.resourceManager.createBuffer({
            label: `${ obj.name }-instance-buffer`,
            byteLength: 4096,
            usage: BufferUsage.STORAGE | BufferUsage.COPY_DST
        });

        const vertexInstancedLayout = this.resourceManager.getOrCreateLayout(ShaderManager.INSTANCE_BUFFER_GROUP);
        const vertexBindGroup = this.resourceManager.createBindGroup(vertexInstancedLayout, {
            label: `${ obj.name }-instance-bind-group`,
            entries: [{
                binding: 0,
                bufferId: vertexInstancedBuffer,
                name: 'InstanceData',
                type: 'storage'
            }]
        })

        let parent: Mesh | undefined;
        // let parent: Transform = defaultTransform().scaleBy(10);
        for (const objMesh of obj.meshes) {
            const transform: Transform = defaultTransform();


            const geometry = this.geometryFactory.createGeometry(`${ objMesh.groupName }-geometry`, VertexShaderName.LIT_GEOMETRY, MathUtil.calculateTBNV(objMesh));
            const albedo = await this.resourceManager.textureManager.addToGlobalTexture('assets/DALL·E-tex-1.webp');
            const data = BufferUtils.parseVertexAttribToImage(objMesh.normals!, 3);
            const normalTexture = this.resourceManager.textureManager.addPreloadedToGlobalTexture('lightBulbNormal', data);
            const material = this.materialFactory.pbrMaterial(
                `${ objMesh.groupName }-material`,
                new PBRMaterialProperties(
                    albedo,
                    // normalTexture.index,
                    this.resourceManager.textureManager.getTexture(Texture.DEFAULT_NORMAL_MAP).index,
                    this.resourceManager.textureManager.getTexture(Texture.DEFAULT_METALLIC_ROUGHNESS_MAP).index,
                    vec4.fromValues(1.0, 0.0, 1.0, 1.0)
                ));

            const pipeline = this.shaderManager.createPipeline(geometry, material);

            if (!parent) {
                transform.scaleBy(10);
                parent = new Mesh(pipeline, geometry, material, transform, [{
                    bindGroupId: vertexBindGroup,
                    bufferId: vertexInstancedBuffer
                }]);
            } else {
                parent.transform.children.push(transform);
                transform.parent = parent.transform;
                parent.subMesh.push(new Mesh(pipeline, geometry, material, transform, [{
                    bindGroupId: vertexBindGroup,
                    bufferId: vertexInstancedBuffer
                }]));
            }

            this.models.set('lightBulb', parent);
        }

        console.log(parent)
        // const normal = await this.resourceManager.textureManager.addToGlobalTexture('assets/DALL·E-tex-1.webp');
        // const material = this.materialFactory.litMaterial('LightBulb', new PhongMaterialProperties(
        //     vec4.fromValues(0.2, 0.2, 0.2, 1.0),
        //     vec4.fromValues(0.2, 0.2, 1.0, 1.0),
        //     vec4.fromValues(1.0, 0.2, 0.5, 1.0),
        // ));
        //
        //
        // const pipeline = this.shaderManager.createPipeline(geometry, material);
        // const mesh = new Mesh(pipeline, geometry, material, defaultTransform().scaleBy(5), [{
        //     bindGroupId: vertexBindGroup,
        //     bufferId: vertexInstancedBuffer
        // }]);
        // this.models.set('lightBulb', mesh);
        return this.models.get('lightBulb')!;
    }

    async drawScene(cache: boolean = true): Promise<Mesh> {
        if (cache && this.models.has('sponza')) {
            return this.models.get('sponza')!;
        }

        const sponzaScene = await ModelRepository.cacheables.sponzaAtrium(this.resourceManager.textureManager)()
            .then(gltf => gltf
                .createMeshes(this.shaderManager, this.geometryFactory, this.materialFactory, this.resourceManager));

        this.models.set('sponza', sponzaScene);
        // sponzaScene.transform.scaleBy(10);
        return sponzaScene;
    }

    static cacheables = {
        sponzaAtrium: (textureManager: TextureManager) => cacheablePromise(GLTFParser.parseGltf('assets/scene/sponza_atrium/gltf/', 'scene.gltf', 'scene.bin', textureManager)),
        sponzaAtriumGLB: () => cacheablePromise(GLTFParser.parseGlb('assets/scene/sponza_atrium/', 'sponza_atrium_3.glb')),
        fox: () => cacheablePromise(GLTFParser.parseGlb('assets/scene/fox/', 'Fox.glb')),
        // cube: () => cacheablePromise(GLTFParser.parseGltf('assets/scene/simple/cube/', 'Cube.gltf', 'Cube.bin')),
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
