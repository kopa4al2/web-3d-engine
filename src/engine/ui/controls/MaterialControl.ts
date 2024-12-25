import UILayout from '../UILayout';
import Material from 'core/mesh/material/Material';
import MaterialFactory from 'core/factories/MaterialFactory';
import MaterialProperties, { PBRMaterialProperties } from 'core/mesh/material/MaterialProperties';
import { PipelineOptions } from 'core/resources/gpu/GpuShaderData';
import { wrapArrayAsXY } from '../utils';
import { BindingApi } from '@tweakpane/core';

export default class MaterialControl extends MaterialFactory {

    private readonly materialPane;

    private readonly materialLabels = new Map<string, Material>();

    constructor(matFactory: MaterialFactory, layout: UILayout) {
        // @ts-ignore
        super(matFactory.resourceManager);
        this.materialPane = layout.addFolder('Material');
    }

    pbrMaterial(label: string = 'PBRMaterial', data: MaterialProperties, overrides: Partial<PipelineOptions> = {}): Material {
        const material = super.pbrMaterial(label, data, overrides);
        if (this.materialLabels.has(label)) {
            // console.warn('Material already exists', label, this.materialLabels.get(label));
            // console.log('Current: ', data, overrides)
            // return this.materialLabels.get(label)!;
        } else {
            this.addMaterial(material);
            this.materialLabels.set(label, material);
        }
        return material;
    }

    addMaterial(material: Material) {
        const folder = this.materialPane.addFolder({ title: material.label, expanded: false });
        const pbrProps = material.properties as PBRMaterialProperties;
        this.forceUpdateOnChange(folder.addBinding(pbrProps.albedo, 'textureLayer', {
            label: 'layer',
            step: 1,
            min: 0,
            max: 20
        }), material);
        this.forceUpdateOnChange(folder.addBinding(wrapArrayAsXY(pbrProps.albedo.textureUvOffset), 'xy', {
            label: 'uvOffset',
            // picker: 'inline',
            expanded: false,
            step: 0.5,
            min: 0, max: 1
        }), material);
        this.forceUpdateOnChange(folder.addBinding(wrapArrayAsXY(pbrProps.albedo.textureUvScale), 'xy', {
            label: 'uvScale',
            // picker: 'inline',
            expanded: false,
            step: 0.5,
            min: 0, max: 1
        }), material);
    }

    private forceUpdateOnChange(binding: BindingApi<any>, material: Material) {
        binding.on('change', e => material.update(() => {
        }));
    }

    public static wrapFactory(materialFactory: MaterialFactory): MaterialFactory {
        return new MaterialControl(materialFactory, new UILayout(document.querySelector('.menu')!));
    }
}
