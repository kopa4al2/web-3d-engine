import UILayout from '../UILayout';
import Material from 'core/mesh/material/Material';
import MaterialFactory from 'core/factories/MaterialFactory';
import MaterialProperties, { PBRMaterialProperties } from 'core/mesh/material/MaterialProperties';
import { PipelineOptions } from 'core/resources/gpu/GpuShaderData';
import { wrapArrayAsColor, wrapArrayAsXY } from '../utils';
import { BindingApi, BladeApi, ButtonApi, FolderApi } from '@tweakpane/core';
import ResourceManager from 'core/resources/ResourceManager';
import DebugCanvas from '../../../util/debug/DebugCanvas';
import Texture from 'core/texture/Texture';
import TextureManager from 'core/resources/TextureManager';

export default class MaterialControl extends MaterialFactory {

    private readonly materialPane;

    private readonly materialLabels = new Map<string, Material>();
    private readonly hideBtn: ButtonApi;

    constructor(matFactory: MaterialFactory, layout: UILayout) {
        // @ts-ignore
        super(matFactory.resourceManager);
        
        this.materialPane = layout.getTopLevelContainer('MATERIALS');
        this.hideBtn = this.materialPane.addButton({ title: 'hide', hidden: true }).on('click', () => {
            DebugCanvas.hide();
            this.hideBtn.hidden = true;
        });
    }

    pbrMaterial(label: string = 'PBRMaterial', data: MaterialProperties, overrides: Partial<PipelineOptions> = {}): Material {
        if (this.materialLabels.has(label)) {
            console.debug(`Reusing material: ${label}`);
            return this.materialLabels.get(label)!;
        } else {
            const material = super.pbrMaterial(label, data, overrides);
            this.addMaterial(material);
            this.materialLabels.set(label, material);
            return material;
        }
    }

    addMaterial(material: Material) {
        const folder = this.materialPane.addFolder({ title: material.label, expanded: false });
        const pbrProps = material.properties as PBRMaterialProperties;
        
        this.forceUpdateOnChange(folder.addBinding(wrapArrayAsColor(pbrProps.baseColorFactor), 'color', {
            color: { type: 'float' },
            picker: 'inline',
            label: 'Base color factor'
        }), material);
        
        this.addTextureView('Albedo', folder, pbrProps.albedo, fn => this.forceUpdateOnChange(fn, material))
        this.addTextureView('Normal', folder, pbrProps.normalMap, fn => this.forceUpdateOnChange(fn, material))
        this.addTextureView('MetallicRoughness', folder, pbrProps.metallicRoughnessMap, fn => this.forceUpdateOnChange(fn, material))
    }

    private addTextureView(label: string, folder: FolderApi, texture: Texture, wrap: (blade: BindingApi) => void) {
        folder.addBlade({ view: 'text', parse: (v: any) => String(v), disabled: true, label: `${label} dimensions`, value: `${texture.size.width}x${texture.size.height}` });
        folder.addButton({ title: 'Visualize' }).on('click', e => {
            DebugCanvas.show();
            DebugCanvas.debugTexture(texture);
            this.hideBtn.hidden = false;
        });
        wrap(folder.addBinding(texture.index, 'textureLayer', {
            label: 'layer',
            step: 1,
            min: 0,
            max: TextureManager.TEXTURE_ARRAY_LAYERS
        }));
        wrap(folder.addBinding(wrapArrayAsXY(texture.index.textureUvOffset), 'xy', {
            label: 'uvOffset',
            // picker: 'inline',
            expanded: false,
            step: 0.1,
            min: 0, max: 1
        }));
        wrap(folder.addBinding(wrapArrayAsXY(texture.index.textureUvScale), 'xy', {
            label: 'uvScale',
            // picker: 'inline',
            expanded: false,
            step: 0.1,
            min: 0, max: 1
        }));
    }

    private forceUpdateOnChange(binding: BindingApi<any>, material: Material) {
        binding.on('change', e => material.update(() => {
        }));
    }
}
