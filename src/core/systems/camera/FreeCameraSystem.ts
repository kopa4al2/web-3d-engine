import CameraComponent from "core/components/camera/CameraComponent";
import Input from "core/components/Input";
import Transform from "core/components/Transform";
import EntityManager from "core/EntityManager";
import PropertiesManager from "core/PropertiesManager";
import {UpdateSystem} from "core/systems/EntityComponentSystem";
import {InputFlags} from "core/systems/InputSystem";
import {glMatrix, mat4, quat, vec2, vec3} from "gl-matrix";
import log, {rateLimitedLog} from "util/Logger";
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

            const {inputState: {inputFlags: input, mouseDelta, mousePos, deltaWheel}} = inputComponent;


            if (inputComponent.inputState.inputFlags['MouseDown']) {
                const xOffset = -mouseDelta[0] * camera.sensitivity;
                const yOffset = -mouseDelta[1] * camera.sensitivity;

                const pitchQuat = quat.create();
                const yawQuat = quat.create();
                quat.setAxisAngle(pitchQuat, [1, 0, 0], glMatrix.toRadian(yOffset));
                quat.setAxisAngle(yawQuat, [0, 1, 0], glMatrix.toRadian(xOffset));

                quat.multiply(camera.targetOrientation, yawQuat, camera.targetOrientation);
                quat.multiply(camera.targetOrientation, camera.targetOrientation, pitchQuat);

                quat.normalize(camera.targetOrientation, camera.targetOrientation);
            }

            quat.slerp(
                camera.orientation,
                camera.orientation,
                camera.targetOrientation,
                camera.lerpFactor * deltaTime
            );
            // const smoothFactor = 10.0;
            // vec3.lerp(camera.euler.asVec3(), camera.euler.asVec3(), camera.targetEuler.asVec3(), smoothFactor * deltaTime);
            this.updateCameraVectors(camera);
            const accelerationVector = vec3.create();

            if (isForwardPressed(input)) {
                vec3.scaleAndAdd(accelerationVector, accelerationVector, camera.forward, camera.acceleration * deltaTime);
            }
            if (isBackPressed(input)) {
                vec3.scaleAndAdd(accelerationVector, accelerationVector, camera.forward, -camera.acceleration * deltaTime);
            }
            if (isLeftPressed(input)) {
                // let right = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), camera.forward, camera.up));
                // vec3.scaleAndAdd(camera.position, camera.position, right, -velocity);
                vec3.scaleAndAdd(accelerationVector, accelerationVector, camera.right, -camera.acceleration * deltaTime);
            }
            if (isRightPressed(input)) {
                // let right = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), camera.forward, camera.up));
                // vec3.scaleAndAdd(camera.position, camera.position, right, velocity);
                vec3.scaleAndAdd(accelerationVector, accelerationVector, camera.right, camera.acceleration * deltaTime);
            }
            if (input[' ']) {
                vec3.scaleAndAdd(camera.position, camera.position, camera.up, camera.acceleration * deltaTime * 0.5);
            }
            if (input['shift']) {
                vec3.scaleAndAdd(camera.position, camera.position, camera.up, -camera.acceleration * deltaTime * 0.5);
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
                /*const minFov = Math.PI / 9;
                const maxFov = Math.PI / 2;
                const deltaY = deltaWheel[1] > 0 ? 1 : -1;

                this.properties.updatePropertyFn('fieldOfView', prev => {
                    // @ts-ignore
                    return MathUtil.clamp(prev - deltaY * 0.05 * camera.zoomSpeed, minFov, maxFov);
                } );
                this.lastDeltaY = deltaWheel[1];*/
            }
        });
    }

    updateCameraVectors(camera: CameraComponent) {
        const rotationMatrix = mat4.create();
        mat4.fromQuat(rotationMatrix, camera.orientation);

        // Extract forward, right, and up vectors
        camera.forward = [-rotationMatrix[8], -rotationMatrix[9], -rotationMatrix[10]];
        camera.right = [rotationMatrix[0], rotationMatrix[1], rotationMatrix[2]];
        camera.up = [rotationMatrix[4], rotationMatrix[5], rotationMatrix[6]];

        vec3.normalize(camera.forward, camera.forward);
        vec3.normalize(camera.right, camera.right);
        vec3.normalize(camera.up, camera.up);
    }

    /*
    updateCameraVectors(camera: CameraComponent) {
        camera.forward[0] = Math.cos(glMatrix.toRadian(camera.euler.yaw)) * Math.cos(glMatrix.toRadian(camera.euler.pitch));
        camera.forward[1] = Math.sin(glMatrix.toRadian(camera.euler.pitch));
        camera.forward[2] = Math.sin(glMatrix.toRadian(camera.euler.yaw)) * Math.cos(glMatrix.toRadian(camera.euler.pitch));
        vec3.normalize(camera.forward, camera.forward);

        if (Math.abs(vec3.dot(camera.forward, [0, 1, 0])) > 0.9999) { // Handle edge cases
            vec3.cross(camera.right, camera.forward, [0, 0, -1]); // Use Z-axis as fallback
        } else {
            vec3.cross(camera.right, camera.forward, [0, 1, 0]); // Cross with world up
        }
        vec3.normalize(camera.right, camera.right);

        vec3.cross(camera.up, camera.right, camera.forward); // Cross right with forward
        vec3.normalize(camera.up, camera.up);
    }*/
};

function isForwardPressed(input: InputFlags): boolean {
    return input['W'] || input['w'] || input['ArrowUp'];
}

function isBackPressed(input: InputFlags): boolean {
    return input['S'] || input['s'] || input['ArrowDown'];
}

function isLeftPressed(input: InputFlags): boolean {
    return input['A'] || input['a'] || input['ArrowLeft'];
}

function isRightPressed(input: InputFlags): boolean {
    return input['D'] || input['d'] || input['ArrowRight'];
}

function easeInOutSine(t: number) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
}
