import PropertiesManager from "core/PropertiesManager";
import { glMatrix, mat4 } from "gl-matrix";

export default class ProjectionMatrix {

    public projectionMatrix: mat4;

    constructor(private properties: PropertiesManager) {
        this.projectionMatrix = this.setProjectionMatrix(this.properties);
        properties.subscribeToAnyPropertyChange(
            ['gpuApi', 'fieldOfView', 'zNear', 'zFar', 'window.width', 'window.height'],
            props => this.projectionMatrix = this.setProjectionMatrix(props));
    }

    public get() {
        return this.projectionMatrix;
    }

    private setProjectionMatrix(properties: PropertiesManager) {
        const isWebGl = properties.getString('gpuApi') === 'webgl2';

        const fov = properties.get<number>('fieldOfView');
        const far = properties.get<number>('zFar');
        const near = properties.get<number>('zNear');

        const aspectRatio = properties.get<number>('window.width') / properties.get<number>('window.height');

        const projectionMatrix = mat4.create();
        if (!isWebGl) {
            // mat4.perspective(projectionMatrix,
            mat4.perspectiveZO(projectionMatrix,
                fov,
                aspectRatio,
                near,
                far);
            return projectionMatrix;
        }

        mat4.perspective(projectionMatrix,
            fov,
            aspectRatio,
            near,
            far);

        return projectionMatrix;
    }
}


function perspectiveLH(out: mat4, fovy: number, aspect: number, near: number, far: number) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1.0 / (near - far);

    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;

    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;

    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) * nf; // flip the Z-axis here
    out[11] = -1;  // This remains the same

    out[12] = 0;
    out[13] = 0;
    out[14] = (2 * far * near) * nf;  // Adjust to keep near/far planes correct
    out[15] = 0;

    return out;
}