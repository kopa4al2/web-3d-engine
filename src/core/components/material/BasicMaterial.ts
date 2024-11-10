import MaterialComponent, { defaultMaterialProps, MaterialProps } from "core/components/material/MaterialComponent";

export default class BasicMaterial extends MaterialComponent {

    constructor(partialProps: Partial<MaterialProps> = defaultMaterialProps) {
        // const properties: MaterialProps = ObjectUtils.mergePartial(partialProps, defaultProps);
        const {
            diffuse = partialProps.color || partialProps.diffuse || defaultMaterialProps.diffuse
        } = partialProps;


        super({});
    }

}