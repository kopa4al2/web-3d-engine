import { mat4, vec2, vec3 } from "gl-matrix";
import MathUtil from "util/MathUtil";
import Component from "./Component";

export default class OrbitCamera implements Component {
    static readonly ID: symbol = Symbol('Camera');
    readonly id = OrbitCamera.ID;

    private yaw: number = 90;  // Horizontal rotation (around Y-axis)
    private pitch: number = 0; // Vertical rotation (around X-axis)
    private sensitivity: number = 0.5; // Mouse sensitivity

    public isDragging: boolean = false; // Track if the mouse is dragging
    public lastMousePos: vec2 = vec2.create();

    private radius = 5;

    constructor(public projectionMatrix: mat4 = mat4.create(),
                public readonly viewMatrix: mat4 = mat4.create(),
                public readonly position: vec3 = [0, 0, 5],
                public readonly center: vec3 = [0, 0, 0],
                public readonly up: vec3 = [0, 1, 0]) {
        this.updateViewMatrix();
    }

    updateMouseCoordinates(coordinates: vec2) {
        if (!this.isDragging) {
            // vec2.copy(this.lastMousePos, coordinates);
            return;
        }


        const deltaX = coordinates[0];
        const deltaY = coordinates[1];
        vec2.copy(this.lastMousePos, coordinates);

        if (deltaX === 0 && deltaY === 0) {
            return;
        }

        this.yaw += deltaX * this.sensitivity;
        this.pitch -= deltaY * this.sensitivity;

        // Clamp the pitch to prevent the camera from flipping over
        this.pitch = MathUtil.clamp(this.pitch, -89, 89);
        // this.pitch = Math.max(-89, Math.min(89, this.pitch));

        // Update the camera's forward vector based on yaw and pitch
        this.updateCameraDirection();

    }

    // Update the forward direction based on yaw and pitch
    private updateCameraDirection(): void {
        const yawRadians = this.yaw * Math.PI / 180;
        const pitchRadians = this.pitch * Math.PI / 180;

        this.position[0] = this.center[0] + this.radius * Math.cos(pitchRadians) * Math.cos(yawRadians);
        this.position[1] = this.center[1] + this.radius * Math.sin(pitchRadians);
        this.position[2] = this.center[2] + this.radius * Math.cos(pitchRadians) * Math.sin(yawRadians);

        // After adjusting the direction, update the view matrix
        this.updateViewMatrix();
    }

    // Update the view matrix using the current position and forward direction
    private updateViewMatrix(): void {
        mat4.lookAt(this.viewMatrix, this.position, this.center, [0, 1, 0]);
    }

    public getViewMatrix(): mat4 {
        return this.viewMatrix;
    }
}