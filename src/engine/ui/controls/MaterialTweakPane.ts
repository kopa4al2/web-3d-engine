import { Bindable, BindingApi, BindingParams, ButtonApi, ContainerApi, FolderApi } from '@tweakpane/core';
import { ButtonGridApi } from '@tweakpane/plugin-essentials/dist/types/button-grid/api/button-grid';
import MaterialFactory from 'core/factories/MaterialFactory';
import Material, { MaterialDescriptor } from 'core/mesh/material/Material';
import { PBRMaterialProperties } from 'core/mesh/material/MaterialProperties';
import TextureManager from 'core/resources/TextureManager';
import Texture from 'core/texture/Texture';
import { ListBladeApi } from 'tweakpane/dist/types/blade/list/api/list';
import DebugCanvas from 'utils/debug/DebugCanvas';
import RightMenu, { UiBladeWrapper } from 'engine/ui/menus/RightMenu';
import { wrapArrayAsColor } from '../utils';
import { TabPageApi } from 'tweakpane';
import DebugUtil from 'utils/debug/DebugUtil';
import FilterWidget from 'engine/ui/widgets/FilterWidget';

export default class MaterialTweakPane extends MaterialFactory {

  private materialPane?: TabPageApi;
  private hideBtn?: ButtonApi;
  private allTextures?: Map<string, Texture>;

  private added = new WeakSet<Material>();
  private added2: PBRMaterialControl[] = [];

  constructor(matFactory: MaterialFactory, private layout: RightMenu) {
    // @ts-ignore
    super(matFactory.resourceManager);
    DebugUtil.addToWindowObject('matTweakPane', this);
    // this.materialLabels = matFactory.materialLabels;
  }

  showMaterials() {
    if (!this.materialPane) {
      this.materialPane = this.layout.createTab('MATERIALS');
      const filterWidget = new FilterWidget(this.materialPane, {
        label: 'Filter materials',
        onFilter: input =>
          this.added2.forEach(el => el.name.toLowerCase().includes(input.toLowerCase()) ? el.show() : el.hide()),
        // filterValues: {
        //   allValues: this.added2,
        //   onFiltered: (filtered) => {
        //     console.log(filtered);
        //     console.log(this.added2);
        //   },
        //   filterPredicate: (material, filterText) => {
        //     console.log('Material', material, 'filterText', filterText);
        //     return material.name.toLowerCase().includes(filterText.toLowerCase());
        //   }
        // }
      });
      this.hideBtn = this.materialPane.addButton({ title: 'hide', hidden: true })
                         .on('click', () => {
                           DebugCanvas.hide();
                           this.hideBtn!.hidden = true;
                         });
    }

    this.layout.setActive('MATERIALS');
    this.allTextures = this.resourceManager.textureManager.getAllTextures();
    for (const material of this.materialLabels.values()) {
      if (!this.added.has(material)) {
        if (material.properties instanceof PBRMaterialProperties) {
          const pbrMaterialControl = new PBRMaterialControl(
            this.materialPane, material.label, material.properties as PBRMaterialProperties,
            material.descriptor, this.resourceManager.textureManager,
            () => {
              material.refresh();
            },
            state => {
            });

          this.added2.push(pbrMaterialControl);
          pbrMaterialControl.init();
        }

        this.added.add(material);
      }
    }
  }

  addMaterial(material: Material) {
    const pbrProps = material.properties as PBRMaterialProperties;
    if (!pbrProps.albedo) {
      return;
    }

    const folder = this.materialPane!.addFolder({ title: material.label, expanded: false });


    this.forceUpdateOnChange(folder.addBinding(wrapArrayAsColor(pbrProps.albedo.baseColor!), 'color', {
      color: { type: 'float' },
      picker: 'popup',
      label: 'Base color factor'
    }), material, folder);

    this.addTextureView('Albedo', folder, pbrProps.albedo.texture, value => material.update<PBRMaterialProperties>(t => t.albedo = value));
    this.addTextureView('Normal', folder, pbrProps.normalMap, value => material.update<PBRMaterialProperties>(t => t.normalMap = value));
    this.addTextureView('MetallicRoughness', folder, pbrProps.metallicRoughnessMap, value => material.update<PBRMaterialProperties>(t => t.metallicRoughnessMap = value));
  }

  private addTextureView(label: string, container: FolderApi, texture: Texture, onChange: (value: any) => void) {
    const folder = container.addFolder({ title: label, expanded: false });
    const wrappedTexture = this.wrapTexture(texture, onChange);
    const texturePicker = this.createTexturePicker(folder, texture, `Select texture for: ${label}`);
    texturePicker.on('change', e => {
      wrappedTexture.changeTexture(e.value);
      if (!this.hideBtn!.hidden) {
        DebugCanvas.debugTexture(e.value);
      }
    });

    const params = { file: '', myLabel: 'some text' };

    folder.addBinding(params, 'file', {
      view: 'file-input',
      lineCount: 2,
      extensions: ['.jpg', '.png'],
      invalidFiletypeMessage: 'Please upload an image!',
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
            return;
          }
          const parsedState = JSON.parse(state);
          console.log('Importing state: ', parsedState);
          folder.importState(parsedState);
        }],
      ]
    };
    const buttonGrid = RightMenu.createBladeApi<ButtonGridApi>(folder, {
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
      console.log('Sync not working');
    };
  }

  private visualizeTexture(texture: Texture) {
    return () => {
      DebugCanvas.show();
      DebugCanvas.debugTexture(texture);
      this.hideBtn!.hidden = false;
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
    const texturePicker = RightMenu.createBladeApi<ListBladeApi<Texture>>(folder, {
      view: 'list',
      label,
      options: [...this.allTextures!.values()].map(tex => ({ text: tex.path, value: tex })),
      value: selected,
    });
    texturePicker.refresh = () => {
      // @ts-ignore
      texturePicker.options = [...this.allTextures.values()].map(tex => ({ text: tex.path, value: tex }));
    };

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
  private readonly emissiveTexture;
  private readonly normalTexture;
  private readonly metallicRoughnessTexture;
  private container!: ContainerApi;

  constructor(private parentContainer: ContainerApi,
              public name: string,
              private properties: PBRMaterialProperties,
              private descriptor: MaterialDescriptor,
              private textureManager: TextureManager,
              private onUpdate: () => void,
              private onSaveState: (state: Record<any, any>) => void) {
    // @ts-ignore
    const textureUpdate = (props, key) => (texture) => {
      props[key] = texture;
      console.log('update');
      onUpdate();
    };
    this.albedoTexture = this.wrapTexture(properties.albedo.texture, textureUpdate(properties.albedo, 'texture'));
    this.emissiveTexture = this.wrapTexture(properties.emissive.texture, onUpdate);
    this.normalTexture = this.wrapTexture(properties.normalMap, textureUpdate(properties, 'normalMap'));
    this.metallicRoughnessTexture = this.wrapTexture(properties.metallicRoughnessMap, textureUpdate(properties, 'metallicRoughnessMap'));
  }

  init() {
    this.container = this.parentContainer.addFolder({ title: this.name, expanded: false });
    this.addAlbedoTexture();
    this.addNormalTexture();
  }

  hide() {
    // @ts-ignore
    this.container.hidden = true;
  }

  show() {
    // @ts-ignore
    this.container.hidden = false;
  }

  addAlbedoTexture() {
    const folder = this.container.addFolder({ title: 'Albedo', expanded: false });
    const texturePicker = this.createTexturePicker(folder, this.albedoTexture.texture, `Change albedo texture`);
    texturePicker.on('change', e => {
      this.albedoTexture.changeTexture(e.value);
    });

    this.addBinding(folder, wrapArrayAsColor(this.properties.albedo.baseColor!), 'color', {
      color: { type: 'float' },
      picker: 'popup',
      label: 'Base color'
    });
    this.addBinding(folder, this.properties.albedo, 'alphaCutoff', {
      min: 0,
      max: 1,
      step: 0.01,
      label: 'Alpha cutoff'
    });
    this.addFileUpload(folder);
    this.addTextureArrayPicker(folder, this.albedoTexture, texturePicker, 'albedo');
  }

  private addNormalTexture() {
    const folder = this.container.addFolder({ title: 'Normal', expanded: false });
    const texturePicker = this.createTexturePicker(folder, this.normalTexture.texture, `Change normal texture`);
    texturePicker.on('change', e => {
      this.albedoTexture.changeTexture(e.value);
    });

    this.addFileUpload(folder);
    this.addTextureArrayPicker(folder, this.normalTexture, texturePicker, 'normal');
  }

  private addFileUpload(folder: FolderApi) {
    folder.addBinding({ file: '' }, 'file', {
      view: 'file-input',
      lineCount: 1,
      extensions: ['.jpg', '.png'],
      invalidFiletypeMessage: 'Please upload an image!',
      label: 'Upload texture:'
    }).on('change', (ev) => {
      const file = ev.value as unknown as File;
      if (!file) {
        return;
      }

      createImageBitmap(file)
        .then(bitmap => {
          const created = this.textureManager.addPreloadedToGlobalTexture(file.name, bitmap);
          this.container.refresh();
        });
    });
  }

  private addTextureArrayPicker(folder: FolderApi, wrappedTexture: WrappedTexture, texturePicker: UiBladeWrapper<any>, cacheKey: string) {
    const buttonGrid = this.createButtonGrid(folder, wrappedTexture, texturePicker, `${this.name}-${cacheKey}`);
    folder.addBinding(wrappedTexture, 'displayData', { readonly: true, rows: 6, multiline: true, label: undefined });
    folder.addBinding(wrappedTexture, 'layer',
      { step: 1, min: 0, max: TextureManager.TEXTURE_ARRAY_LAYERS });
    // min: 0, max: TextureManager.MAX_TEXTURE_ARRAY_SIZE.width - wrappedTexture.texture.size.width
    folder.addBinding(wrappedTexture, 'offset', { label: 'uvOffset', });
    folder.addBinding(wrappedTexture, 'scale', { label: 'uvScale', min: 0.00, max: 1.00 });
  }

  private createButtonGrid(folder: FolderApi,
                           textureWrapper: WrappedTexture,
                           texturePicker: UiBladeWrapper<any>,
                           label: string) {
    const buttons = {
      text: [
        ['Visualize', 'Hide'],
        ['Revert texture', 'Refresh'],
        ['Export state', 'Import state'],
      ],
      actions: [
        [this.visualizeTexture(textureWrapper), this.hideDebugCanvas()],
        [this.revertTexture(textureWrapper), this.refreshTextureDropdown(texturePicker)],
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
            return;
          }
          const parsedState = JSON.parse(state);
          console.log('Importing state: ', parsedState);
          folder.importState(parsedState);
        }],
      ]
    };
    const buttonGrid = RightMenu.createBladeApi<ButtonGridApi>(folder, {
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
    buttonGrid.controller.valueController.cellControllers[1].viewProps.set('disabled', DebugCanvas.isShown());

    return buttonGrid;
  }

  private refreshTextureDropdown(texturePicker: UiBladeWrapper<any>) {
    return () => {
      console.log('Refresh dropdown');
      texturePicker.refresh();
    };
  }

  private revertTexture(wrappedTexture: WrappedTexture) {
    return () => {
      console.log('Upload to GPU texture: ', wrappedTexture);
      wrappedTexture.restore();
      this.textureManager.updateTexture(wrappedTexture.texture);
      this.container.refresh();
    };
  }

  private hideDebugCanvas() {
    return () => {
      console.log('Sync not working');
      this.container.refresh();

    };
  }

  private visualizeTexture(wrapper: WrappedTexture) {
    return () => {
      DebugCanvas.show();
      DebugCanvas.debugTexture(wrapper.texture);
      // this.hideBtn.hidden = false;
    };
  }

  private wrapTexture(initial: Texture, onChange: (texture: Texture) => void): WrappedTexture {
    let currentTexture = initial;
    const originalTextureId = initial.path;
    return {
      get displayData() {
        return `Path: ${currentTexture.path}
Width: ${currentTexture.size.width}
Height: ${currentTexture.size.height}
Layer: ${currentTexture.index.textureLayer}
Offset: [X:${currentTexture.index.textureUvOffset[0]},Y:${currentTexture.index.textureUvOffset[1]}]
Scale: [X:${currentTexture.index.textureUvScale[0]},Y:${currentTexture.index.textureUvScale[1]}]
`;
      },
      changeTexture: (newTexture: Texture) => {
        if (newTexture === currentTexture) {
          console.warn('Changing the current texture with the same one');
        }
        currentTexture = newTexture;
        onChange(newTexture);
      },
      restore: () => {
        console.log('Restore');
        currentTexture = this.textureManager.getTexture(originalTextureId);
        onChange(currentTexture);
      },
      // @ts-ignore
      // get textureOld() {
      //   return texture;
      // },
      get texture() {
        return currentTexture;
      },
      offset: {
        get x() {
          return currentTexture.index.textureUvOffset[0];
        },
        set x(val: number) {
          onChange(currentTexture);
          currentTexture.index.textureUvOffset[0] = val;
        },
        get y() {
          return currentTexture.index.textureUvOffset[1];
        },
        set y(val: number) {
          onChange(currentTexture);
          currentTexture.index.textureUvOffset[1] = val;
        },
      },
      scale: {
        get x() {
          return currentTexture.index.textureUvScale[0];
        },
        set x(val: number) {
          onChange(currentTexture);
          currentTexture.index.textureUvScale[0] = val;
        },
        get y() {
          return currentTexture.index.textureUvScale[1];
        },
        set y(val: number) {
          onChange(currentTexture);
          currentTexture.index.textureUvScale[1] = val;
        },
      },
      get layer() {
        return currentTexture.index.textureLayer;
      },
      set layer(num: number) {
        onChange(currentTexture);
        currentTexture.index.textureLayer = num;
      },
    };
  }

  private createTexturePicker(folder: ContainerApi, selected: Texture, label = 'textures') {
    const texturePicker = RightMenu.createBladeApi<ListBladeApi<Texture>>(folder, {
      view: 'list',
      label,
      options: [...this.textureManager.getAllTextures().values()].map(tex => ({ text: tex.path, value: tex })),
      value: selected,
    });
    texturePicker.refresh = () => {
      // @ts-ignore
      texturePicker.options = [...this.textureManager.getAllTextures().values()].map(tex => ({ text: tex.path, value: tex }));
    };

    return texturePicker;
  }

  private addBinding(folder: ContainerApi, obj: Bindable, key: keyof Bindable, params?: BindingParams) {
    const bindingApi = folder.addBinding(obj, key, params);
    bindingApi.on('change', e => this.onUpdate());
    return bindingApi;
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
interface WrappedTexture {
  displayData: string;
  changeTexture: (newTexture: Texture) => void;
  restore: () => void;
  texture: Texture;
  // texture: () => Texture;
  offset: {
    x: number;
    y: number;
  },
  scale: {
    x: number;
    y: number;
  },
  layer: number;
}