import Component from 'core/components/Component';
import { mat4, quat, vec2, vec3, vec4 } from "gl-matrix";
import DebugUtil from 'util/DebugUtil';
import logger from 'util/Logger';
import MathUtil from 'util/MathUtil';

export default class CameraComponent implements Component {
    static readonly ID: symbol = Symbol('Camera');
    readonly id = CameraComponent.ID;


    public zoomSpeed = 1.0;
    public velocity: vec3;
    public right: vec3;

    constructor(
        public position: vec3,
        public orientation = quat.create(),
        public sensitivity: number = 0.3,
        public lerpFactor = 10.0,
        public maxSpeed = 30.0,
        public acceleration = 50.0,
        public deceleration = 50.0,
        public forward: vec3 = [0, 0, -1],
        public up: vec3 = [0, 1, 0],
        public targetPosition = vec3.copy(vec3.create(), position),
        public targetOrientation = quat.copy(quat.create(), orientation),
    ) {
        DebugUtil.addToWindowObject('camera', this);
        this.velocity = vec3.create();
        this.right = vec3.cross(vec3.create(), forward, up);
    }

    viewMatrix(): mat4 {
        const viewMat = mat4.create();

        const rotationMatrix = mat4.create();
        mat4.fromQuat(rotationMatrix, this.orientation);

        mat4.transpose(rotationMatrix, rotationMatrix);

        const translationMatrix = mat4.create();
        // mat4.fromTranslation(translationMatrix, this.position);
        mat4.fromTranslation(translationMatrix, vec3.negate(vec3.create(), this.position));

        // Combine rotation and translation to get the view matrix
        mat4.multiply(viewMat, rotationMatrix, translationMatrix);

        return viewMat;
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