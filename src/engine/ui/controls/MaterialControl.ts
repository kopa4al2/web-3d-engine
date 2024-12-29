import UILayout, { UiBladeWrapper } from '../UILayout';
import Material from 'core/mesh/material/Material';
import MaterialFactory from 'core/factories/MaterialFactory';
import MaterialProperties, { PBRMaterialProperties } from 'core/mesh/material/MaterialProperties';
import { PipelineOptions } from 'core/resources/gpu/GpuShaderData';
import { wrapArrayAsColor } from '../utils';
import { BindingApi, ButtonApi, ContainerApi, FolderApi } from '@tweakpane/core';
import DebugCanvas from '../../../util/debug/DebugCanvas';
import Texture from 'core/texture/Texture';
import TextureManager from 'core/resources/TextureManager';
import { createDynamicInterceptor } from '../../../util/Interceptor';

export default class MaterialControl extends MaterialFactory {

    private readonly materialPane;

    private readonly materialLabels = new Map<string, Material>();
    private readonly hideBtn: ButtonApi;
    private allTextures;

    constructor(matFactory: MaterialFactory, layout: UILayout) {
        // @ts-ignore
        super(matFactory.resourceManager);

        this.materialPane = layout.getTopLevelContainer('MATERIALS');
        this.hideBtn = this.materialPane.addButton({ title: 'hide', hidden: true }).on('click', () => {
            DebugCanvas.hide();
            this.hideBtn.hidden = true;
        });
        this.allTextures = this.resourceManager.textureManager.getAllTextures()

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
            picker: 'popup',
            label: 'Base color factor'
        }), material, folder);

        this.addTextureView('Albedo', folder, pbrProps.albedo, value => material.update<PBRMaterialProperties>(t => t.albedo = value));
        this.addTextureView('Normal', folder, pbrProps.normalMap, value => material.update<PBRMaterialProperties>(t => t.normalMap = value))
        this.addTextureView('MetallicRoughness', folder, pbrProps.metallicRoughnessMap, value => material.update<PBRMaterialProperties>(t => t.metallicRoughnessMap = value))
    }

    private addTextureView(label: string, container: FolderApi, texture: Texture, onChange: (value: any) => void) {
        const folder = container.addFolder({ title: label, expanded: true });
        const wrappedTexture = this.wrapTexture(texture, onChange);
        const texturePicker = this.createTexturePicker(folder, texture, `Select texture for: ${label}`);
        texturePicker.on('change', e => {
            wrappedTexture.changeTexture(e.value);
            folder.refresh();
            if (!this.hideBtn.hidden) {
                DebugCanvas.debugTexture(e.value);
            }
        });

        const params = {
            placeholder: 'placeholder',
            // url: 'https://images.unsplash.com/photo-1631875182291-17e8310183ed?q=80&w=500',
            file: '',
            folder: '',
        };

        const pane = UILayout.createPane(document.querySelector('.test')!, 'testing')
        pane.addBinding(params, 'placeholder', {
            view: 'input-image',
            extensions: ['jpg', 'jpeg', 'png'],
            // clickCallback: (...args: any[]) => {
            //     console.log('Click callback', args)
            // }
        }).on('change', e => {
            console.log('change', e);
            console.log(typeof e.value)
            console.log(e.value)
        })

        pane.addBinding(params, 'file', {
                view: 'file-input',
                lineCount: 15,
                
                // filetypes: ['.png', '.jpg'],
                invalidFiletypeMessage: "We can't accept those filetypes!"
            })
            .on('change', (ev) => {
                console.log(ev.value);
                const file = ev.value as unknown as File;
                console.log(file);
                createImageBitmap(file)
                    .then(bitmap => {
                        DebugCanvas.debugTexture({ imageData: bitmap, size: { width: bitmap.width, height: bitmap.height } });
                    })
            });

        UILayout.createBladeApi(folder, {
            view: 'buttongrid',
            size: [2, 2],
            cells: (x: any, y: any) => ({
                title: [
                    ['Visualize', 'Sync'],
                    ['Upload to GPU', 'Refresh'],
                ][y][x],
            }),
            label: 'util',
        }).on('click', e => {
            if (e.index[0] === 0 && e.index[1] === 0) {
                DebugCanvas.show();
                DebugCanvas.debugTexture(wrappedTexture.texture);
                this.hideBtn.hidden = false;
            } else if (e.index[0] === 1 && e.index[1] === 0) {
            } else if (e.index[0] === 2 && e.index[1] === 0) {
                console.log('Upload to GPU');
                this.resourceManager.textureManager.updateTexture(wrappedTexture.texture);
            } else if (e.index[0] === 2 && e.index[1] === 1) {
                console.log('Refresh');
                texturePicker.refresh();
            }
        });
        folder.addBinding(wrappedTexture, 'displayData', { readonly: true, rows: 5, multiline: true });
        folder.addBinding(wrappedTexture, 'layer',
            { label: 'layer', step: 1, min: 0, max: TextureManager.TEXTURE_ARRAY_LAYERS });
        folder.addBinding(wrappedTexture, 'offset', { label: 'uvOffset' });
        folder.addBinding(wrappedTexture, 'scale', { label: 'uvScale' });
    }

    private wrapTexture(initial: Texture, onChange: (texture: Texture) => void) {
        let texture = initial;
        return {
            get displayData() {
                return `Width: ${texture.size.width}
Height: ${texture.size.height}
Layer: ${texture.index.textureLayer}
Offset: [X:${texture.index.textureUvOffset[0]},Y:${texture.index.textureUvOffset[1]}]
Scale: [X:${texture.index.textureUvScale[0]},Y:${texture.index.textureUvScale[1]}]`;
            },
            changeTexture: (newTexture: Texture) => {
                texture = newTexture;
                onChange(newTexture);
            },
            get texture() {
                return texture;
            },
            offset: {
                get x() {
                    return texture.index.textureUvOffset[0];
                },
                set x(val: number) {
                    onChange(texture);
                    texture.index.textureUvOffset[0] = val;
                },
                get y() {
                    return texture.index.textureUvOffset[1];
                },
                set y(val: number) {
                    onChange(texture);
                    texture.index.textureUvOffset[1] = val;
                },
            },
            scale: {
                get x() {
                    return texture.index.textureUvScale[0];
                },
                set x(val: number) {
                    onChange(texture);
                    texture.index.textureUvScale[0] = val;
                },
                get y() {
                    return texture.index.textureUvScale[1];
                },
                set y(val: number) {
                    onChange(texture);
                    texture.index.textureUvScale[1] = val;
                },
            },
            get layer() {
                return texture.index.textureLayer;
            },
            set layer(num: number) {
                onChange(texture);
                texture.index.textureLayer = num;
            },
        };
    }

    private createTexturePicker(folder: ContainerApi, selected: Texture, label = 'textures'): UiBladeWrapper {
        const texturePicker = this.getUiBladeWrapper(folder, label, selected, [...this.allTextures.values()]);
        texturePicker.refresh = () => {
            // @ts-ignore
            texturePicker.options = [...this.allTextures.values()].map(tex => ({ text: tex.path, value: tex }));
        }

        return texturePicker;
    }

    private getUiBladeWrapper(folder: ContainerApi, label: string, selected: Texture, allTextures: Texture[]) {
        return UILayout.createBladeApi(folder, {
            view: 'list',
            label,
            options: allTextures.map(tex => ({ text: tex.path, value: tex })),
            value: selected,
        });
    }

    private forceUpdateOnChange(binding: BindingApi<any>, material: Material, folder: FolderApi) {
        binding.on('change', e => material.update(() => {
            folder.refresh();
        }));
    }
}

/*

private addTextureView(label: string, folder: FolderApi, texture: Texture, wrap: (blade: BindingApi) => void) {
    folder.addBlade({
        view: 'text',
        parse: (v: any) => String(v),
        disabled: true,
        label: `${label} dimensions`,
        value: `${texture.size.width}x${texture.size.height}`
    });
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
}*/
