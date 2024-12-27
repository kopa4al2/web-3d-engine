import DirectionalLight from "core/light/DirectionalLight";
import PointLight from "core/light/PointLight";
import SpotLight from "core/light/SpotLight";

export default class LightsHelper {

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
        const dirLightsBfr = new Float32Array(lightDataBuffer, 0, floatsPerDirLightStruct * DirectionalLight.MAX_DIRECTION_LIGHTS);
        const pointLightsBfr = new Float32Array(lightDataBuffer, bytesForDirLight, floatsPerPointLightStruct * PointLight.MAX_POINT_LIGHTS);
        const spotLightsBfr = new Float32Array(lightDataBuffer, bytesForPointLights + bytesForDirLight, floatsPerSpotLightStruct * SpotLight.MAX_SPOT_LIGHTS);
        const metaDataBfr = new Uint32Array(lightDataBuffer, bytesForPointLights + bytesForDirLight + bytesForSpotLights, 4);
    }
}