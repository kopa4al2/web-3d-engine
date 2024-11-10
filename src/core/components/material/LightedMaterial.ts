import BasicMaterial from 'core/components/material/BasicMaterial';
import MaterialComponent, { defaultMaterialProps, MaterialProps } from "core/components/material/MaterialComponent";
import { VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import { UniformVisibility } from 'core/resources/gpu/GpuShaderData';
import Texture from 'core/texture/Texture';
import MathUtil from 'util/MathUtil';
import ObjectUtils from 'util/ObjectUtils';

export default class LightedMaterial extends MaterialComponent {

    constructor(partialProps: Partial<MaterialProps> = defaultMaterialProps) {
        if (!partialProps.textures || partialProps.textures.length === 0) {
            partialProps.textures = [Texture.OPAQUE_TEXTURE]
        }
        super({ ...partialProps, shaderName: VertexShaderName.BASIC_WITH_LIGHT });
    }
}

export const BasicLightMaterial = () => {}