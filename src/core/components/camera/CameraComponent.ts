import { mat4, vec2, vec3 } from "gl-matrix";

export default class CameraComponent {
    static readonly ID: symbol = Symbol('Camera');
    readonly id = CameraComponent.ID;

    public acceleration = 50.0;
    public deceleration = 100.0;
    public maxSpeed = 25.0;
    public zoomSpeed = 1.0;

    constructor(
        public position: vec3,
        public forward: vec3,
        public up: vec3,
        public movementSpeed: number = 5.5,
        public sensitivity: number = 0.1,
        public velocity: vec3 = vec3.create(),
        public euler: EulerAngles = new EulerAngles(-90, 0.0, 0.0),
        public targetEuler: EulerAngles = new EulerAngles(-90, 0.0, 0.0)) {
    }

    viewMatrix(): mat4 {
        let target = vec3.add(vec3.create(), this.position, this.forward);
        return mat4.lookAt(mat4.create(), this.position, target, this.up);
    }
}

class EulerAngles {
    private readonly elements: vec3;

    constructor(yaw: number, pitch: number, roll: number) {
        this.elements = vec3.fromValues(yaw, pitch, roll);
    }

    get yaw() {
        return this.elements[0];
    }


    get pitch() {
        return this.elements[1];
    }

    asVec3(): vec3 {
        return this.elements;
    }
}