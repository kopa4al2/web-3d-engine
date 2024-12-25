// @ts-nocheck
import MaterialComponent, { defaultMaterialProps, MaterialProps } from "core/components/material/MaterialComponent";
import { VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import ObjectUtils from "util/ObjectUtils";

export default class TerrainMaterial extends MaterialComponent {

    constructor(partialProps: Partial<MaterialProps> = defaultMaterialProps) {
        const properties: MaterialProps = ObjectUtils.mergePartial(partialProps, defaultMaterialProps);
        const {
            textures = [],
            texturesOffset = 2,
            ambient,
            diffuse = partialProps.color || partialProps.diffuse || defaultMaterialProps.diffuse,
            illuminationModel,
            indexOfRefraction,
            shininess,
            specular,
            transparency,
            shaderName = VertexShaderName.TERRAIN
        } = properties;

        // console.log('SEA LEVEL NORMALIZED: ', (TerrainGeometry.SEA_LEVEL - TerrainGeometry.MIN_HEIGHT) / (TerrainGeometry.MIN_HEIGHT + TerrainGeometry.HEIGHT_FACTOR - TerrainGeometry.MIN_HEIGHT))
        // const materialBindGroup = LightedMaterial.createBindGroup(1, 'Material', 0, UniformVisibility.FRAGMENT,
        //     [
        //         MathUtil.vec4(ambient, 1.0),
        //         MathUtil.vec4(diffuse, 1.0),
        //         MathUtil.vec4(specular, 1.0),
        //         vec4.fromValues(shininess,
        //             TerrainGeometry.MIN_HEIGHT + TerrainGeometry.HEIGHT_FACTOR, // uMaxHeight
        //             TerrainGeometry.MIN_HEIGHT,   // uMinHeight
        //             (TerrainGeometry.SEA_LEVEL - TerrainGeometry.MIN_HEIGHT) / (TerrainGeometry.MIN_HEIGHT + TerrainGeometry.HEIGHT_FACTOR - TerrainGeometry.MIN_HEIGHT))   // uSeaLevel
        //     ]);

        // textures.forEach((texture, index) => {
        //     if (!texture || !texture.imageData) {
        //         console.error("NO TEXTURE: ", texture)
        //     }
        //     materialBindGroup.push({
        //             type: 'texture',
        //             binding: (index + 1) * texturesOffset,
        //             group: 1,
        //             name: `texture-${texture.name}`,
        //             visibility: UniformVisibility.FRAGMENT,
        //             value: texture,
        //         },
        //         {
        //             type: 'sampler',
        //             binding: (index + 1) * texturesOffset + 1,
        //             group: 1,
        //             name: `sampler-${texture.name}`,
        //             visibility: UniformVisibility.FRAGMENT,
        //             value: texture,
        //         });
        // })

        // super(properties);
    }

}

// OLD MATERIAL COMPONENT
/*

public readonly properties: MaterialProps;

public constructor(public partialProps: Partial<MaterialProps>) {

    const properties: MaterialProps = ObjectUtils.mergePartial(partialProps, defaultMaterialProps);
    const {
        label,
        textures = [],
        texturesOffset = 1,
        // texture = TextureLoader.textures['noop'],
        ambient,
        diffuse = partialProps.color || partialProps.diffuse || defaultMaterialProps.diffuse,
        illuminationModel,
        indexOfRefraction,
        shininess,
        specular,
        transparency,
        shaderName
    } = properties;

    // const materialBindGroup = MaterialComponent.createBindGroup(1, 'Material', 0, UniformVisibility.FRAGMENT,
    //     [
    //         MathUtil.vec4(ambient, 1.0),
    //         MathUtil.vec4(diffuse, 1.0),
    //         MathUtil.vec4(specular, 1.0),
    //         // shininess
    //     ])
    //
    // textures.forEach((texture, index) => {
    //     if (!texture || !texture.imageData) {
    //         console.error("NO TEXTURE: ", texture)
    //     }
    //     materialBindGroup.push({
    //             type: 'texture',
    //             binding: (index + 1) * texturesOffset,
    //             group: 1,
    //             name: `texture-${texture.name}`,
    //             visibility: UniformVisibility.FRAGMENT,
    //             value: texture,
    //         },
    //         {
    //             type: 'sampler',
    //             binding: (index + 1) * texturesOffset + 1,
    //             group: 1,
    //             name: `sampler-${texture.name}`,
    //             visibility: UniformVisibility.FRAGMENT,
    //             value: texture,
    //         });
    // })

    // this.fragmentData = { uniforms: materialBindGroup, shaderName };
    this.properties = properties;
}*/
