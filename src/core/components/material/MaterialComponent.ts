import Component from "core/components/Component";
import { VertexShaderName } from 'core/resources/cpu/CpuShaderData';
import Texture from "core/texture/Texture";
import { vec3 } from "gl-matrix";
import ObjectUtils from 'util/ObjectUtils';

export interface MaterialProps {
    shaderName: VertexShaderName,
    textures: Texture[],
    texturesOffset?: number,            // The offset in binding groups where texture mapping begins. Applicable only if textures are present
    color?: vec3,

    label: string,

    ambient: vec3;                      // Ka
    diffuse: vec3;                      // Kd
    specular: vec3;                     // Ks
    shininess: number;                  // Ns
    indexOfRefraction?: number;         // Ni
    transparency?: number;              // d
    illuminationModel: number;          // illum
}

export const defaultMaterialProps: MaterialProps = {
    shaderName: VertexShaderName.LIT_GEOMETRY,
    // ambient: vec3.fromValues(1.0, 0.15, 0.15),
    ambient: vec3.fromValues(0.15, 0.15, 0.15),
    illuminationModel: 0,
    shininess: 10.0,
    specular: vec3.fromValues(0.9, 0.9, 0.9),
    label: 'n/a',
    diffuse: vec3.fromValues(0.2, 0.45, 0.47),
    textures: []
}

export default class MaterialComponent implements Component {
    public static readonly ID = Symbol('MaterialComponent');
    id: symbol = MaterialComponent.ID;

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
    }
}
