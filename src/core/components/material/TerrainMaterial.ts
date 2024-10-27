// @ts-nocheck
import TerrainGeometry from "core/components/geometry/TerrainGeometry";
import BasicMaterial from "core/components/material/BasicMaterial";
import MaterialComponent, { defaultProps, MaterialProps } from "core/components/material/MaterialComponent";
import TextureLoader from "core/loader/TextureLoader";
import GPUResourceFactory from "core/resources/gpu/GPUResourceFactory";
import { ShaderType } from "core/shaders/GPUShader";
import Texture from "core/texture/Texture";
import { vec2, vec3, vec4 } from "gl-matrix";
import log from "util/Logger";
import MathUtil from "util/MathUtil";
import ObjectUtils from "util/ObjectUtils";

export default class TerrainMaterial extends MaterialComponent {

    constructor(partialProps: Partial<MaterialProps> = defaultProps) {
        const properties: MaterialProps = ObjectUtils.mergePartial(partialProps, defaultProps);
        const {
            textures = [],
            texturesOffset = 2,
            ambient,
            diffuse = partialProps.color || partialProps.diffuse || defaultProps.diffuse,
            illuminationModel,
            indexOfRefraction,
            shininess,
            specular,
            transparency,
            fragmentShaderSource
        } = properties;

        const shaderSource = fragmentShaderSource;
        console.log('SEA LEVEL NORMALIZED: ', (TerrainGeometry.SEA_LEVEL - TerrainGeometry.MIN_HEIGHT) / (TerrainGeometry.MIN_HEIGHT + TerrainGeometry.HEIGHT_FACTOR - TerrainGeometry.MIN_HEIGHT))
        const materialBindGroup = BasicMaterial.createBindGroup(1, 'Material', 0, ShaderType.FRAGMENT,
            [
                MathUtil.vec4(ambient, 1.0),
                MathUtil.vec4(diffuse, 1.0),
                MathUtil.vec4(specular, 1.0),
                vec4.fromValues(shininess,
                    TerrainGeometry.MIN_HEIGHT + TerrainGeometry.HEIGHT_FACTOR, // uMaxHeight
                    TerrainGeometry.MIN_HEIGHT,   // uMinHeight
                    (TerrainGeometry.SEA_LEVEL - TerrainGeometry.MIN_HEIGHT) / (TerrainGeometry.MIN_HEIGHT + TerrainGeometry.HEIGHT_FACTOR - TerrainGeometry.MIN_HEIGHT))   // uSeaLevel
            ]);

        textures.forEach((texture, index) => {
            if (!texture || !texture.imageData) {
                console.error("NO TEXTURE: ", texture)
            }
            materialBindGroup.push({
                    type: 'texture',
                    binding: (index + 1) * texturesOffset,
                    group: 1,
                    name: `texture-${texture.name}`,
                    visibility: ShaderType.FRAGMENT,
                    value: texture,
                },
                {
                    type: 'sampler',
                    binding: (index + 1) * texturesOffset + 1,
                    group: 1,
                    name: `sampler-${texture.name}`,
                    visibility: ShaderType.FRAGMENT,
                    value: texture,
                });
        })

        super({ uniforms: materialBindGroup, shaderSource }, properties);
    }

}