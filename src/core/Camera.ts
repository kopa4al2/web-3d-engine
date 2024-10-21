import { mat4, vec3 } from "gl-matrix";



export interface ProjectionMatrixProperties {
    fieldOfView: number;
    aspectRatio: number;
    zNear: number;
    zFar: number;
}

export default class Camera {

    private readonly projectionMatrix: mat4;
    private readonly viewMatrix: mat4;

    constructor(private position: vec3 = vec3.create(), private rotation: vec3 = vec3.create()) {
        this.projectionMatrix = mat4.create();
        this.viewMatrix = mat4.create();
    }

    getViewMatrix() {
        return this.viewMatrix;
    }

    getViewMatrixPos() {
        const viewMatrix = mat4.create();
        mat4.identity(viewMatrix);
        mat4.rotateX(viewMatrix, viewMatrix, this.rotation[0]);
        mat4.rotateY(viewMatrix, viewMatrix, this.rotation[1]);
        mat4.rotateZ(viewMatrix, viewMatrix, this.rotation[2]);
        mat4.translate(viewMatrix, viewMatrix, [-this.position[0], -this.position[1], -this.position[2]]);

        return viewMatrix;
    }

    getProjectionMatrix() {
        return this.projectionMatrix;
    }

    setPerspective(fov: number, aspect: number, near: number, far: number) {
        mat4.perspective(this.projectionMatrix, fov, aspect, near, far);
    }

    setPerspectiveProps(projectionProps: ProjectionMatrixProperties) {
        mat4.perspective(this.projectionMatrix,
            projectionProps.fieldOfView,
            projectionProps.aspectRatio,
            projectionProps.zNear,
            projectionProps.zFar);
    }

    setView(eye: vec3, center: vec3, up: vec3) {
        mat4.lookAt(this.viewMatrix, eye, center, up);
    }
}