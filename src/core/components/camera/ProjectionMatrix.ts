import PropertiesManager from "core/PropertiesManager";
import { mat4 } from "gl-matrix";
import DebugUtil from 'util/DebugUtil';

export default class ProjectionMatrix {

    public projectionMatrix: mat4;

    constructor(private properties: PropertiesManager) {
        DebugUtil.addToWindowObject('projectionMatrix', this);
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
            mat4.perspectiveZO(projectionMatrix,
                fov,
                aspectRatio,
                near,
                far);

            return perspectiveZ0(mat4.create(), fov, aspectRatio, near, far);
        }

        mat4.perspectiveNO(projectionMatrix,
            fov,
            aspectRatio,
            near,
            far);

        return perspective(mat4.create(), fov, aspectRatio, near, far);
    }
}

function perspective(out: mat4, fov: number, aspect: number, near: number, far: number) {
    const f = 1 / Math.tan(fov / 2);
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
    out[10] = (far + near) / (near - far)
    out[11] = -1

    out[12] = 0;
    out[13] = 0;
    out[14] = (2 * far * near) / (near - far)
    out[15] = 0;

    return out;
}

function perspectiveZ0(out: mat4, fov: number, aspect: number, near: number, far: number) {
    const f = 1 / Math.tan(fov / 2);
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
    out[10] = (near + far) / (near - far);
    // out[10] = -far / (far - near);
    out[11] = -1

    out[12] = 0;
    out[13] = 0;
    // out[14] = (2 * near * far) / (near - far)
    out[14] = (-near * far) / (far - near);
    out[15] = 0;

    return out;
}
