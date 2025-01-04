import { vec3 } from "gl-matrix";


export function quatToEuler(outEuler: vec3, quat: quat): vec3 {
    const [x, y, z, w] = quat;

    // Roll (X-axis rotation)
    const sinr_cosp = 2 * (w * x + y * z);
    const cosr_cosp = 1 - 2 * (x * x + y * y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    // Pitch (Y-axis rotation)
    const sinp = 2 * (w * y - z * x);
    let pitch;
    if (Math.abs(sinp) >= 1) {
        pitch = Math.sign(sinp) * Math.PI / 2; // Gimbal lock at 90 degrees
    } else {
        pitch = Math.asin(sinp);
    }

    // Yaw (Z-axis rotation)
    const siny_cosp = 2 * (w * z + x * y);
    const cosy_cosp = 1 - 2 * (y * y + z * z);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    if (outEuler) {
        outEuler[0] = roll;
        outEuler[1] = pitch;
        outEuler[2] = yaw;
        return outEuler;
    }
    return [roll, pitch, yaw];
}