import Transform from "core/components/Transform";
import DirectionalLight from "core/light/DirectionalLight";
import PointLight from "core/light/PointLight";
import SpotLight from "core/light/SpotLight";
import { vec4 } from "gl-matrix";

export default class LightRenderer {

    public buffer: ArrayBuffer;
    public dirLightsView: Float32Array;
    public pointLightsView: Float32Array;
    public spotLightsView: Float32Array;
    public metaDataView: Uint32Array;
    public bufferView: Uint8Array;

    // get bufferView() {
    //     return new Uint8Array(this.buffer);
    // }

    public elementsPerDirLight;
    public elementsPerPointLight;
    public elementsPerSpotLight;

    constructor() {
        const floatsPerDirLightStruct = 12; // 9 + 3 padding
        const floatsPerPointLightStruct = 12;
        const floatsPerSpotLightStruct = 20; // 18 floats + 2 padding
        const padding = 4;
        const bytesForDirLight = Float32Array.BYTES_PER_ELEMENT * DirectionalLight.MAX_DIRECTION_LIGHTS * floatsPerDirLightStruct;
        const bytesForPointLights = Float32Array.BYTES_PER_ELEMENT * PointLight.MAX_POINT_LIGHTS * floatsPerPointLightStruct;
        const bytesForSpotLights = Float32Array.BYTES_PER_ELEMENT * SpotLight.MAX_SPOT_LIGHTS * floatsPerSpotLightStruct;
        const bytesForMetadata = Uint32Array.BYTES_PER_ELEMENT * 3 + padding;
        const lightDataBuffer = new ArrayBuffer(bytesForDirLight + bytesForPointLights + bytesForSpotLights + bytesForMetadata);

        this.bufferView = new Uint8Array(lightDataBuffer);
        this.elementsPerDirLight = floatsPerDirLightStruct;
        this.elementsPerPointLight = floatsPerPointLightStruct;
        this.elementsPerSpotLight = floatsPerSpotLightStruct;
        this.dirLightsView = new Float32Array(lightDataBuffer, 0, floatsPerDirLightStruct * DirectionalLight.MAX_DIRECTION_LIGHTS);
        this.pointLightsView = new Float32Array(lightDataBuffer, bytesForDirLight, floatsPerPointLightStruct * PointLight.MAX_POINT_LIGHTS);
        this.spotLightsView = new Float32Array(lightDataBuffer, bytesForPointLights + bytesForDirLight, floatsPerSpotLightStruct * SpotLight.MAX_SPOT_LIGHTS);
        this.metaDataView = new Uint32Array(lightDataBuffer, bytesForPointLights + bytesForDirLight + bytesForSpotLights, 4);

        this.buffer = lightDataBuffer;
    }

    bufferLights(dirLights: DirectionalLight[], pointLights: [PointLight, Transform][], spotLights: [SpotLight, Transform][]) {
        // this.buffer = new ArrayBuffer(624)
        for (let i = 0; i < dirLights.length; i++) {
            let dirLight = dirLights[i];
            this.dirLightsView.set(dirLight.data, i * this.elementsPerDirLight);
        }

        for (let i = 0; i < pointLights.length; i++) {
            const [pointLight, transform] = pointLights[i];
            const { x, y, z } = pointLight.position.xyz;
            const position = vec4.transformMat4(vec4.create(), vec4.fromValues(x, y, z, 1.0), transform.getMatrix());
            this.pointLightsView.set(
                [...position, ...pointLight.color.toArray(), pointLight.intensity, pointLight.constantAttenuation, pointLight.linearAttenuation, pointLight.quadraticAttenuation],
                this.elementsPerPointLight * i);
        }

        for (let i = 0; i < spotLights.length; i++) {
            const [spotLight, transform] = spotLights[i];
            const direction = vec4.transformQuat(vec4.create(), vec4.fromValues(0, 0, -1.0, 0.0), transform.worldTransform.rotation);
            vec4.normalize(direction, direction);

            const offset = i * this.elementsPerSpotLight;
            this.spotLightsView.set([...transform.worldTransform.position, 1.0, ...direction], offset);
            this.spotLightsView.set([
                ...spotLight.color, spotLight.data.innerCutoff, spotLight.data.outerCutoff, spotLight.intensity,
                spotLight.constantAttenuation, spotLight.linearAttenuation, spotLight.quadraticAttenuation,
                1, 1], offset + 8);
        }

        this.metaDataView[0] = dirLights.length;
        this.metaDataView[1] = pointLights.length;
        this.metaDataView[2] = spotLights.length;
    }
}