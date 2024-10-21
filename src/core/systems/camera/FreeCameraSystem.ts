import CameraComponent from "core/components/camera/CameraComponent";
import Input from "core/components/Input";
import Transform from "core/components/Transform";
import EntityManager from "core/EntityManager";
import PropertiesManager from "core/PropertiesManager";
import { UpdateSystem } from "core/systems/EntityComponentSystem";
import { InputFlags } from "core/systems/InputSystem";
import { glMatrix, mat4, vec2, vec3 } from "gl-matrix";
import log, { rateLimitedLog } from "util/Logger";
import MathUtil from "util/MathUtil";
import ThrottleUtil from "util/ThrottleUtil";

export default class FreeCameraSystem implements UpdateSystem {

    private lastDeltaY = 0;
    constructor(private entityManager: EntityManager, private properties: PropertiesManager) {
    }

    update(deltaTime: number): void {
        const entities = this.entityManager.getEntitiesHavingAll(CameraComponent.ID, Input.ID);
        entities.forEach(entity => {
            const camera = this.entityManager.getComponent<CameraComponent>(entity, CameraComponent.ID);
            const inputComponent = this.entityManager.getComponent<Input>(entity, Input.ID);

            const { inputState: { inputFlags: input, mouseDelta, mousePos, deltaWheel } } = inputComponent;


            if (inputComponent.inputState.inputFlags['MouseDown']) {
                let xOffset = mouseDelta[0] * camera.sensitivity;
                let yOffset = -mouseDelta[1] * camera.sensitivity;
                // let xOffset = (mousePos[0] - camera.lastMousePos[0]) * camera.sensitivity;
                // let yOffset = (camera.lastMousePos[1] - mousePos[1]) * camera.sensitivity; // Invert y-axis

                let yawOffset = camera.targetEuler.yaw + xOffset;
                let pitchOffset = MathUtil.clamp(camera.targetEuler.pitch + yOffset, -89, 89);
                vec3.copy(camera.targetEuler.asVec3(), vec3.fromValues(yawOffset, pitchOffset, 0));
            }

            let smoothFactor = 10.0;
            vec3.lerp(camera.euler.asVec3(), camera.euler.asVec3(), camera.targetEuler.asVec3(), smoothFactor * deltaTime);
            this.updateCameraVectors(camera); // Update the forward, right, and up vectors
            const accelerationVector = vec3.create();

            if (isForwardPressed(input)) {
                // vec3.scaleAndAdd(camera.position, camera.position, camera.forward, velocity);
                vec3.scaleAndAdd(accelerationVector, accelerationVector, camera.forward, camera.acceleration * deltaTime);
            }
            if (isBackPressed(input)) {
                // vec3.scaleAndAdd(camera.position, camera.position, camera.forward, -velocity);
                vec3.scaleAndAdd(accelerationVector, accelerationVector, camera.forward, -camera.acceleration * deltaTime);
            }
            if (isLeftPressed(input)) {
                let right = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), camera.forward, camera.up));
                // vec3.scaleAndAdd(camera.position, camera.position, right, -velocity);
                vec3.scaleAndAdd(accelerationVector, accelerationVector, right, -camera.acceleration * deltaTime);
            }
            if (isRightPressed(input)) {
                let right = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), camera.forward, camera.up));
                // vec3.scaleAndAdd(camera.position, camera.position, right, velocity);
                vec3.scaleAndAdd(accelerationVector, accelerationVector, right, camera.acceleration * deltaTime);
            }
            if (input[' ']) {
                vec3.scaleAndAdd(camera.position, camera.position, camera.up, 5.0 * deltaTime);
                // vec3.scaleAndAdd(accelerationVector, accelerationVector, camera.up, camera.acceleration * deltaTime * 30.0);
            }
            if (input['shift']) {
                vec3.scaleAndAdd(camera.position, camera.position, camera.up, -5.0 * deltaTime);
                // vec3.scaleAndAdd(accelerationVector, accelerationVector, camera.up, -camera.acceleration * deltaTime * 30.0);
            }


            // Clamp the velocity to the maximum speed
            vec3.add(camera.velocity, camera.velocity, accelerationVector);
            if (vec3.length(camera.velocity) > camera.maxSpeed) {
                vec3.scale(camera.velocity, vec3.normalize(camera.velocity, camera.velocity), camera.maxSpeed);
            }

            // Decelerate (slow down) the camera if no movement keys are pressed
            if (!isForwardPressed(input) && !isBackPressed(input)
                && !isLeftPressed(input) && !isRightPressed(input)) {

                vec3.scale(camera.velocity, camera.velocity, Math.max(0, 1 - camera.deceleration * deltaTime));
            }

            // Update the camera's position based on the velocity
            // vec3.add(camera.position, camera.position, vec3.scale(camera.velocity, camera.velocity, deltaTime));
            vec3.scaleAndAdd(camera.position, camera.position, camera.velocity, deltaTime);

            if (deltaWheel[1] !== this.lastDeltaY) {
                const minFov = Math.PI / 9;
                const maxFov = Math.PI / 2;
                const deltaY = deltaWheel[1] > 0 ? 1 : -1;

                this.properties.updatePropertyFn('fieldOfView', prev => {
                    // @ts-ignore
                    return MathUtil.clamp(prev - deltaY * 0.05 * camera.zoomSpeed, minFov, maxFov);
                } );
                this.lastDeltaY = deltaWheel[1];
            }
        });
    }

    updateCameraVectors(camera: CameraComponent) {
        let forward = vec3.create();

        forward[0] = Math.cos(glMatrix.toRadian(camera.euler.yaw)) * Math.cos(glMatrix.toRadian(camera.euler.pitch));
        forward[1] = Math.sin(glMatrix.toRadian(camera.euler.pitch));
        forward[2] = Math.sin(glMatrix.toRadian(camera.euler.yaw)) * Math.cos(glMatrix.toRadian(camera.euler.pitch));

        camera.forward = vec3.normalize(vec3.create(), forward);
    }


    getViewMatrix(camera: CameraComponent): mat4 {
        let target = vec3.add(vec3.create(), camera.position, camera.forward); // The point the camera is looking at
        return mat4.lookAt(mat4.create(), camera.position, target, camera.up); // Create view matrix from position, forward, up
    }
};

function isForwardPressed(input: InputFlags): boolean{
    return input['W'] || input['w'] || input['ArrowUp'];
}

function isBackPressed(input: InputFlags): boolean{
    return input['S'] || input['s'] || input['ArrowDown'];
}
function isLeftPressed(input: InputFlags): boolean{
    return input['A'] || input['a'] || input['ArrowLeft'];
}

function isRightPressed(input: InputFlags): boolean{
    return input['D'] || input['d'] || input['ArrowRight'];
}

function easeInOutSine(t: number) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
}