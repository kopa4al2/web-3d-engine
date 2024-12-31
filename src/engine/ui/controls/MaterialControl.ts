// @ts-nocheck
import { BindingApi, ButtonApi, ContainerApi, FolderApi } from '@tweakpane/core';
import { ButtonGridApi } from "@tweakpane/plugin-essentials/dist/types/button-grid/api/button-grid";
import MaterialFactory from 'core/factories/MaterialFactory';
import Material, { MaterialDescriptor } from 'core/mesh/material/Material';
import MaterialProperties, { PBRMaterialProperties } from 'core/mesh/material/MaterialProperties';
import { PipelineOptions } from 'core/resources/gpu/GpuShaderData';
import TextureManager from 'core/resources/TextureManager';
import Texture, { Image } from 'core/texture/Texture';
import { ListBladeApi } from "tweakpane/dist/types/blade/list/api/list";
import DebugCanvas from '../../../util/debug/DebugCanvas';
import UILayout, { UiBladeWrapper } from '../UILayout';
import { wrapArrayAsColor } from '../utils';

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
            // this.addMaterial(material);
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
        const folder = container.addFolder({ title: label, expanded: false });
        const wrappedTexture = this.wrapTexture(texture, onChange);
        const texturePicker = this.createTexturePicker(folder, texture, `Select texture for: ${label}`);
        texturePicker.on('change', e => {
            wrappedTexture.changeTexture(e.value);
            if (!this.hideBtn.hidden) {
                DebugCanvas.debugTexture(e.value);
            }
        });

        const params = { file: '', myLabel: 'some text' };

        folder.addBinding(params, 'file', {
            view: 'file-input',
            lineCount: 2,
            extensions: ['.jpg', '.png'],
            invalidFiletypeMessage: "Please upload an image!",
            label: 'Upload texture:'
        }).on('change', (ev) => {
            const file = ev.value as unknown as File;
            if (!file) {
                return;
            }

            createImageBitmap(file)
                .then(bitmap => {
                    const created = this.resourceManager.textureManager.addPreloadedToGlobalTexture(file.name, bitmap);
                    wrappedTexture.changeTexture(created);
                    folder.refresh();
                });
        });

        const buttonGrid = this.createButtonGrid(folder, wrappedTexture, texturePicker, label);

        folder.addBinding(wrappedTexture, 'displayData', { readonly: true, rows: 5, multiline: true });
        folder.addBinding(wrappedTexture, 'layer',
            { label: 'layer', step: 1, min: 0, max: TextureManager.TEXTURE_ARRAY_LAYERS });
        folder.addBinding(wrappedTexture, 'offset', { label: 'uvOffset' });
        folder.addBinding(wrappedTexture, 'scale', { label: 'uvScale' });
    }

    private createButtonGrid(folder: FolderApi,
                             textureWrapper: { texture: Texture },
                             texturePicker: UiBladeWrapper<any>,
                             label: string) {
        const buttons = {
            text: [
                ['Visualize', 'Sync'],
                ['Upload to GPU', 'Refresh'],
                ['Export state', 'Import state'],
            ],
            actions: [
                [this.visualizeTexture(textureWrapper.texture), this.sync()],
                [this.uploadToGpu(textureWrapper.texture), this.refreshTextureDropdown(texturePicker)],
                [() => {
                    const state = folder.exportState();
                    console.log('Exporting state: ', state);
                    DebugCanvas.debugTexture(textureWrapper.texture);
                    const base64Img = DebugCanvas.getCurrentImageAsBase64();
                    console.log(base64Img);
                    state.texture = base64Img;
                    const json = JSON.stringify(state);
                    localStorage.setItem(label, json);
                }, () => {
                    const state = localStorage.getItem(label)!;
                    if (!state) {
                        console.warn(`No state present with key: ${label}`);
                        return
                    }
                    const parsedState = JSON.parse(state);
                    console.log('Importing state: ', parsedState);
                    folder.importState(parsedState);
                }],
            ]
        }
        const buttonGrid = UILayout.createBladeApi<ButtonGridApi>(folder, {
            view: 'buttongrid',
            size: [buttons.text.length, buttons.text[0].length],
            cells: (x: number, y: number) => ({
                title: buttons.text[x][y],
            }),
        }).on('click', e => {
            const row = e.index[1];
            const col = e.index[0];
            buttons.actions[col][row]();
        });

        folder.on('fold', e => {
            if (e.expanded) {
                buttonGrid.controller.valueController.cellControllers[5].viewProps.set('disabled', localStorage.getItem(label) === null);
            }
        });
        buttonGrid.controller.valueController.cellControllers[5].viewProps.set('disabled', localStorage.getItem(label) === null);

        return buttonGrid;
    }

    private refreshTextureDropdown(texturePicker: UiBladeWrapper<any>) {
        return () => {
            console.log('Refresh');
            texturePicker.refresh();
        };
    }

    private uploadToGpu(texture: Texture) {
        return () => {
            console.log('Upload to GPU');
            this.resourceManager.textureManager.updateTexture(texture);
        };
    }

    private sync() {
        return () => {
            console.log('Sync not working')
        };
    }

    private visualizeTexture(texture: Texture) {
        return () => {
            DebugCanvas.show();
            DebugCanvas.debugTexture(texture);
            this.hideBtn.hidden = false;
        };
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

    private createTexturePicker(folder: ContainerApi, selected: Texture, label = 'textures') {
        const texturePicker = UILayout.createBladeApi<ListBladeApi<Texture>>(folder, {
            view: 'list',
            label,
            options: [...this.allTextures.values()].map(tex => ({ text: tex.path, value: tex })),
            value: selected,
        });
        texturePicker.refresh = () => {
            // @ts-ignore
            texturePicker.options = [...this.allTextures.values()].map(tex => ({ text: tex.path, value: tex }));
        }

        return texturePicker;
    }

    private forceUpdateOnChange(binding: BindingApi<any>, material: Material, folder: FolderApi) {
        binding.on('change', e => material.update(() => {
            folder.refresh();
        }));
    }
}

class PBRMaterialControl {

    private readonly albedoTexture;
    private readonly normalTexture;
    private readonly metallicRoughnessTexture;
    constructor(private name: string,
                private container: FolderApi,
                private properties: PBRMaterialProperties,
                private descriptor: MaterialDescriptor,
                private textureManager: TextureManager,
                private onUpdate: () => void,
                private onSaveState: () => void) {
        this.albedoTexture = this.wrapTexture(properties.albedo, onUpdate);
        this.normalTexture = this.wrapTexture(properties.normalMap, onUpdate);
        this.metallicRoughnessTexture = this.wrapTexture(properties.metallicRoughnessMap, onUpdate);
    }

    init() {
        const texturePicker = this.createTexturePicker(this.container, texture, `Select texture for: ${label}`)
        this.addTextureView('Albedo', this.container, this.albedoTexture);
        this.addTextureView('Albedo', this.container, this.normalTexture);
        this.addTextureView('Albedo', this.container, this.metallicRoughnessTexture);
    }

    private addTextureView(label: string, container: FolderApi, texture: Texture, onChange: (value: any) => void) {
        const folder = container.addFolder({ title: label, expanded: false });
        const wrappedTexture = this.wrapTexture(texture, onChange);
        const texturePicker = this.createTexturePicker(folder, texture, `Select texture for: ${label}`);
        texturePicker.on('change', e => {
            wrappedTexture.changeTexture(e.value);
            if (!this.hideBtn.hidden) {
                DebugCanvas.debugTexture(e.value);
            }
        });

        const params = { file: '' };

        folder.addBinding(params, 'file', {
            view: 'file-input',
            lineCount: 2,
            extensions: ['.jpg', '.png'],
            invalidFiletypeMessage: "Please upload an image!",
            label: 'Upload texture:'
        }).on('change', (ev) => {
            const file = ev.value as unknown as File;
            if (!file) {
                return;
            }

            createImageBitmap(file)
                .then(bitmap => {
                    const created = this.resourceManager.textureManager.addPreloadedToGlobalTexture(file.name, bitmap);
                    wrappedTexture.changeTexture(created);
                    folder.refresh();
                });
        });

        const buttonGrid = this.createButtonGrid(folder, wrappedTexture, texturePicker, label);

        folder.addBinding(wrappedTexture, 'displayData', { readonly: true, rows: 5, multiline: true });
        folder.addBinding(wrappedTexture, 'layer',
            { label: 'layer', step: 1, min: 0, max: TextureManager.TEXTURE_ARRAY_LAYERS });
        folder.addBinding(wrappedTexture, 'offset', { label: 'uvOffset' });
        folder.addBinding(wrappedTexture, 'scale', { label: 'uvScale' });
    }

    private createButtonGrid(folder: FolderApi,
                             textureWrapper: { texture: Texture },
                             texturePicker: UiBladeWrapper<any>,
                             label: string) {
        const buttons = {
            text: [
                ['Visualize', 'Sync'],
                ['Upload to GPU', 'Refresh'],
                ['Export state', 'Import state'],
            ],
            actions: [
                [this.visualizeTexture(textureWrapper.texture), this.sync()],
                [this.uploadToGpu(textureWrapper.texture), this.refreshTextureDropdown(texturePicker)],
                [() => {
                    const state = folder.exportState();
                    console.log('Exporting state: ', state);
                    DebugCanvas.debugTexture(textureWrapper.texture);
                    const base64Img = DebugCanvas.getCurrentImageAsBase64();
                    console.log(base64Img);
                    state.texture = base64Img;
                    const json = JSON.stringify(state);
                    localStorage.setItem(label, json);
                }, () => {
                    const state = localStorage.getItem(label)!;
                    if (!state) {
                        console.warn(`No state present with key: ${label}`);
                        return
                    }
                    const parsedState = JSON.parse(state);
                    console.log('Importing state: ', parsedState);
                    folder.importState(parsedState);
                }],
            ]
        }
        const buttonGrid = UILayout.createBladeApi<ButtonGridApi>(folder, {
            view: 'buttongrid',
            size: [buttons.text.length, buttons.text[0].length],
            cells: (x: number, y: number) => ({
                title: buttons.text[x][y],
            }),
        }).on('click', e => {
            const row = e.index[1];
            const col = e.index[0];
            buttons.actions[col][row]();
        });

        folder.on('fold', e => {
            if (e.expanded) {
                buttonGrid.controller.valueController.cellControllers[5].viewProps.set('disabled', localStorage.getItem(label) === null);
            }
        });
        buttonGrid.controller.valueController.cellControllers[5].viewProps.set('disabled', localStorage.getItem(label) === null);

        return buttonGrid;
    }

    private refreshTextureDropdown(texturePicker: UiBladeWrapper<any>) {
        return () => {
            console.log('Refresh');
            texturePicker.refresh();
        };
    }

    private uploadToGpu(texture: Texture) {
        return () => {
            console.log('Upload to GPU');
            this.resourceManager.textureManager.updateTexture(texture);
        };
    }

    private sync() {
        return () => {
            console.log('Sync not working')
        };
    }

    private visualizeTexture(texture: Texture) {
        return () => {
            DebugCanvas.show();
            DebugCanvas.debugTexture(texture);
            this.hideBtn.hidden = false;
        };
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

    private createTexturePicker(folder: ContainerApi, selected: Texture, label = 'textures') {
        const texturePicker = UILayout.createBladeApi<ListBladeApi<Texture>>(folder, {
            view: 'list',
            label,
            options: [...this.allTextures.values()].map(tex => ({ text: tex.path, value: tex })),
            value: selected,
        });
        texturePicker.refresh = () => {
            // @ts-ignore
            texturePicker.options = [...this.allTextures.values()].map(tex => ({ text: tex.path, value: tex }));
        }

        return texturePicker;
    }
}

/*

        folder.addBinding(params, 'placeholder', {
            view: 'input-image',
            extensions: ['.jpeg', '.png'],
            label: 'Upload texture',
            // clickCallback: (e: any, input: any) => { console.log(e) input.click();}
        }).on('change', e => {
            console.log('Changed: ', e)
            // @ts-ignore
            createImageBitmap(e.value)
                .then(bitmap => {
                    const created = this.resourceManager.textureManager.addPreloadedToGlobalTexture(`e.value`, bitmap);
                    wrappedTexture.changeTexture(created);
                });
        })

 */