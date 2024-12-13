import CameraComponent from "core/components/camera/CameraComponent";
import Input from "core/components/Input";
import Mesh from 'core/components/Mesh';
import Transform from "core/components/Transform";
import EntityManager from "core/EntityManager";
import Graphics from 'core/Graphics';
import Frustum from 'core/physics/Frustum';
import PropertiesManager from "core/PropertiesManager";
import { RenderSystem, UpdateSystem } from "core/systems/EntityComponentSystem";
import { InputFlags } from "core/systems/InputSystem";
import { glMatrix, mat4, vec2, vec3, vec4 } from "gl-matrix";
import log, { rateLimitedLog } from "util/Logger";
import MathUtil from "util/MathUtil";
import ThrottleUtil from "util/ThrottleUtil";

export default class ViewFrustumSystem implements UpdateSystem, RenderSystem {

    constructor(private entityManager: EntityManager, private graphics: Graphics, private properties: PropertiesManager) {
    }

    render(): void {
        // const renderPass = this.graphics.beginRenderPass();
        //
        // // const scene = this.entityManager.scenes[0];
        // const entities = this.entityManager.getEntitiesHavingAll(Frustum.ID, Mesh.ID);
        // entities.forEach(entity => {
        //     const mesh = this.entityManager.getComponent<Mesh>(entity, Mesh.ID);
        //     renderPass.usePipeline(mesh.pipelineId)
        //     renderPass.setVertexBuffer(0, mesh.geometry.vertexBuffer);
        //     renderPass.drawSimple(24);
        // });
        // renderPass.submit();
    }

    update(deltaTime: number): void {
        const scene = this.entityManager.scenes[0];
        const entities = this.entityManager.getEntitiesHavingAll(Frustum.ID, Mesh.ID);
        entities.forEach(entity => {
            const frustum = this.entityManager.getComponent<Frustum>(entity, Frustum.ID);
            const mesh = this.entityManager.getComponent<Mesh>(entity, Mesh.ID);
            const viewProjMat = mat4.multiply(mat4.create(), scene.projectionMatrix.get(), scene.camera.viewMatrix());
            const inverseViewProjMatrix = mat4.invert(mat4.create(), viewProjMat);
            const inverseView = mat4.invert(mat4.create(), scene.camera.viewMatrix());
            frustum.update(viewProjMat);
            const corners = frustum.getFrustumCorners();
            // console.log('Projection matrix:\n ', MathUtil.prettyPrintMat4(scene.projectionMatrix.get()));
            // console.log('View matrix:\n ', MathUtil.prettyPrintMat4(scene.camera.viewMatrix()));
            // console.log('multiplied matrix:\n ', MathUtil.prettyPrintMat4(viewProjMat));

            const ndcCorners = corners.flatMap(point => {
                // const worldPoint = vec4.transformMat4(vec4.create(), vec4.fromValues(point[0], point[1], point[2], 1.0), inverseView);
                const clip = vec4.transformMat4(vec4.create(), vec4.fromValues(point[0], point[1], point[2], -1.0), viewProjMat);
                return [
                    clip[0] / clip[3],
                    clip[1] / clip[3],
                    clip[2] / clip[3]
                ];
            });
            // const transformedCorners = this.computeFrustumCorners(scene.projectionMatrix.get());
            // console.log(corners)
            // console.log(ndcCorners)
            // throw 'e'
            this.graphics.writeToBuffer(mesh.geometry.vertexBuffer, new Float32Array(ndcCorners));
            // this.graphics.writeToBuffer(mesh.geometry.vertexBuffer, new Float32Array(corners.flatMap(e => [...e].flat())));
        });
    }

    private computeFrustumCorners(viewProjMatrix: mat4) {
        const invMatrix = mat4.invert(mat4.create(), viewProjMatrix);

        const ndcCorners = [
            // Near
            vec4.fromValues(-1.0, -1.0, -1.0, 1.0), vec4.fromValues(1.0, -1.0, -1.0, 1.0), vec4.fromValues(1.0, 1.0, -1.0, 1.0), vec4.fromValues(-1.0, 1.0, -1.0, 1.0),
            // Far
            vec4.fromValues(-1.0, -1.0, 1.0, 1.0), vec4.fromValues(1.0, -1.0, 1.0, 1.0), vec4.fromValues(1.0, 1.0, 1.0, 1.0), vec4.fromValues(-1.0, 1.0, 1.0, 1.0),
        ];

        return ndcCorners.map((corner, i) => {
            try {
                const epsilon = 1e-6;
                const worldPos = vec4.transformMat4(vec4.create(), corner, invMatrix);
                // worldPos[3] = Math.abs(worldPos[3]) < epsilon ? epsilon : worldPos[3];

                if (Math.abs(worldPos[3]) < epsilon) worldPos[3] = epsilon;
                return [
                    worldPos[0] / worldPos[3],
                    worldPos[1] / worldPos[3],
                    worldPos[2] / worldPos[3],
                ]; // Normalize by W
                // vec4.normalize(worldPos, worldPos);
                // return [worldPos[0], worldPos[1], worldPos[2]];
            } catch (error) {
                console.error(`Error computing frustum corners:`, error);
                console.log(viewProjMatrix)
                return [0, 0, 0]; // Default to origin
            }
        }).flat();
    }
};
function convertToLocalSpace(vertices: number[]) {
    const zNear = 0.5;
    const zFar = 1000;
    return vertices.map((coord, i) => {
        if (i % 3 === 2) {
            // Scale z to normalized depth range (-1, 1)
            return (coord - zNear) / (zFar - zNear) * 2 - 1;
        }
        return coord;
    });
}
