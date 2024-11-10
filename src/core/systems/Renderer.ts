import { defaultTransform, randomTransform } from 'core/components/Transform';
import EntityManager from "core/EntityManager";
import MeshManager from 'core/resources/MeshManager';
import { System } from "core/systems/EntityComponentSystem";
import { mat4 } from "gl-matrix";
import { rateLimitedLog } from 'util/Logger';
import Graphics from "../../core/Graphics";


export default class Renderer implements System {

    private projectionViewMatrix: mat4 = mat4.create();

    constructor(private graphics: Graphics,
                private entityManager: EntityManager,
                private meshFactory: MeshManager) {
    }

    public update(deltaTime: number): void {
        const scene = this.entityManager.scenes[0];
        scene.update();

        const viewMatrix = mat4.create();
        mat4.lookAt(viewMatrix, [-1, 3, -2], [0, 0, 0], [0, 1, 0])

        mat4.multiply(this.projectionViewMatrix, scene.projectionMatrix.get(), scene.camera.viewMatrix());
        scene.updateFrustum(this.projectionViewMatrix);
    }

    render(): void {
        const scene = this.entityManager.scenes[0];
        const { camera, lightSource } = scene;


        if (!camera) {
            console.error('No camera present in the scene. Will not attempt render anything');
            return;
        }
        const entitiesToRender = scene.getVisibleEntities();
        const globalBuffer = this.meshFactory.globalBuffer;
        const globalBufferBg = this.meshFactory.globalBufferBG;

        const lightData = lightSource.getLightData(1)
        const viewPosition = new Float32Array([...camera.position, 1])

        this.graphics.writeToBuffer(globalBuffer, this.projectionViewMatrix as Float32Array);
        this.graphics.writeToBuffer(globalBuffer, viewPosition, 64, 0);
        this.graphics.writeToBuffer(globalBuffer, lightData, 64 + 16, 0, 4);
        this.graphics.writeToBuffer(globalBuffer, lightData, 64 + 32, 4, 4);

        const renderPass = this.graphics.beginRenderPass();
        renderPass.setBindGroup(0, globalBufferBg);

        for (const [pipeline, meshes] of entitiesToRender) {
            renderPass.usePipeline(pipeline);
            // pipeline.setAllBindGroups();
            rateLimitedLog.logMax(entitiesToRender.size, `Using pipeline: ${pipeline.toString()} for ${meshes.size} meshes`);
            for (const [mesh, entities] of meshes) {
                renderPass.setVertexBuffer(0, mesh.geometry.vertexBuffer);
                mesh.update(renderPass);
                mesh.render(renderPass);

                renderPass.setBindGroup(0, mesh.instanceBuffer[1]);
                for (let index = 0; index < entities.length; index++) {
                    const [_, transform] = entities[index];

                    this.graphics.writeToBuffer(
                        mesh.instanceBuffer[0]!,
                        transform as Float32Array,
                        index * (64 + 64)
                    );
                    const modelInverseTranspose = mat4.create();
                    mat4.invert(modelInverseTranspose, transform);
                    mat4.transpose(modelInverseTranspose, modelInverseTranspose);

                    this.graphics.writeToBuffer(
                        mesh.instanceBuffer[0]!,
                        modelInverseTranspose as Float32Array,
                        index * 128 + 64
                    );
                }

                rateLimitedLog.logMax(meshes.size, `Batching instanced draw for ${entities.length} instances`);
                renderPass.drawInstanced(mesh.geometry.indexBuffer, mesh.geometry.indices, entities.length);
            }
        }

        renderPass.submit();
        return;
    }
}
