import GeometryComponent from "core/components/geometry/GeometryComponent";
import MaterialComponent from "core/components/material/MaterialComponent";
import EntityManager from "core/EntityManager";
import Scene from "core/Scene";
import { mat4, mat3, vec3, vec4 } from "gl-matrix";
import MathUtil from "util/MathUtil";
import ThrottleUtil from "util/ThrottleUtil";
import GPUMesh, { GPUMeshGroup } from "../../core/components/GPUMesh";
import OrbitCamera from "../../core/components/OrbitCamera";
import Transform from "../../core/components/Transform";
import Graphics from "../../core/Graphics";
import EntityComponentSystem, { System } from "core/systems/EntityComponentSystem";


export default class Renderer implements System {

    constructor(private graphics: Graphics,
                private entityManager: EntityManager) {
    }

    render(): void {
        const { entities, camera, lightSource, projectionMatrix } = this.entityManager.scenes[0];

        const renderPass = this.graphics.beginRenderPass();


        for (const entity of entities) {
            const transform = <Transform>this.entityManager.getComponent<Transform>(entity, Transform.ID);
            const gpuMesh = <GPUMesh | GPUMeshGroup>this.entityManager.getComponent<GPUMesh>(entity, GPUMesh.ID);
            if (gpuMesh) {
                for (let mesh of gpuMesh.meshes) {
                    if (camera) {
                        // MVP
                        const modelMatrix = transform.createModelMatrix();
                        const mvpMatrix = mat4.create();
                        mat4.multiply(mvpMatrix, projectionMatrix.get(), camera.viewMatrix());
                        mat4.multiply(mvpMatrix, mvpMatrix, modelMatrix);

                        const modelInverseTranspose = mat4.create();
                        mat4.invert(modelInverseTranspose, modelMatrix);
                        mat4.transpose(modelInverseTranspose, modelInverseTranspose);

                        this.graphics.writeToBuffer(mesh.bufferGroups.vertexBuffer, mvpMatrix as Float32Array);
                        this.graphics.writeToBuffer(mesh.bufferGroups.vertexBuffer, modelMatrix as Float32Array, 64, 0);
                        this.graphics.writeToBuffer(mesh.bufferGroups.vertexBuffer, modelInverseTranspose as Float32Array, 128, 0);

                        let lightData = lightSource.getLightData(1);
                        this.graphics.writeToBuffer(mesh.bufferGroups.fragmentBuffer, lightData, 0, 0, 4);
                        this.graphics.writeToBuffer(mesh.bufferGroups.fragmentBuffer, lightData, 16, 4, 4);
                        this.graphics.writeToBuffer(mesh.bufferGroups.fragmentBuffer, new Float32Array([0.0, 0.0, 10.0]), 32, 0);
                    }
                    renderPass.draw(mesh.pipeline);
                }
            }
        }
        renderPass.submit();

        // this.renderer.render(this.scene);
    }
}


/**
 * This function calculates the normal matrix to transform normals into view space.
 * @param viewMatrix The view matrix (from the camera).
 * @param modelMatrix The model matrix (from the object transformations).
 * @returns A 3x3 normal matrix (inverse transpose of the model-view matrix).
 */
function getNormals(viewMatrix: mat4, modelMatrix: mat4): mat3 {
    const modelViewMatrix = mat4.create(); // Initialize the model-view matrix
    const normalMatrix = mat3.create();    // Initialize the normal matrix (3x3)

    // Multiply viewMatrix and modelMatrix to get the model-view matrix (M * V)
    mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix); // M * V matrix

    // Extract the 3x3 part of the model-view matrix (ignoring translation)
    mat3.fromMat4(normalMatrix, modelViewMatrix);

    // Invert and transpose the normal matrix (inverse transpose)
    mat3.invert(normalMatrix, normalMatrix);
    mat3.transpose(normalMatrix, normalMatrix);

    return normalMatrix; // Return the 3x3 normal matrix
}


/**
 * This function transforms a light direction vector from world space to view space.
 * @param viewMatrix The view matrix (from the camera).
 * @param lightDirectionWorld The light direction in world space (vec3).
 * @returns The transformed light direction in view space (vec3).
 */
function transformLightDirection(viewMatrix: mat4, lightDirectionWorld: vec3): vec3 {
    const lightDirectionView = vec3.create(); // This will hold the transformed light direction

    // Extract only the rotation part of the view matrix (upper-left 3x3) using mat3
    const rotationMatrix = mat3.create();
    mat3.fromMat4(rotationMatrix, viewMatrix);  // Get the 3x3 rotation part

    // Transform the light direction using only the rotation part of the view matrix
    vec3.transformMat3(lightDirectionView, lightDirectionWorld, rotationMatrix);

    // Normalize the resulting direction to ensure it's a unit vector
    vec3.normalize(lightDirectionView, lightDirectionView);

    return lightDirectionView; // Return the transformed direction
}