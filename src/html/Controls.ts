import * as CamerakitPlugin from '@tweakpane/plugin-camerakit';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import DirectionalLight from "core/light/DirectionalLight";
import directionalLight from "core/light/DirectionalLight";
import PointLight from "core/light/PointLight";
import PropertiesManager from "core/PropertiesManager";
import SdiPerformance from "core/utils/SdiPerformance";
import { vec3 } from "gl-matrix";
import { EntitySelectPayload } from 'html/entity-select/EntitySelect';
import { Pane } from "tweakpane";
import { SdiColor } from "../types/engine-types/EngineTypes";
import { addEventListener } from './CustomEvents';

export function enableWireframeSwitch(properties: PropertiesManager, attachTarget?: Element) {
    const parent = attachTarget?.querySelector('.controls') || document.querySelector('.controls') as Element;
    const element = document.createElement('div');
    element.innerHTML = `
        <div>
            <label for="wireframe">Wireframe</label>
            <input type="checkbox" name="wireframe" id="wireframe" />
        </div>
    `;

    parent.append(element);
    const wireframeEnabledCb = element.querySelector('#wireframe') as HTMLInputElement;


    let wireframeEnabled = properties.getBoolean('wireframe');
    if (wireframeEnabled) {
        wireframeEnabledCb.checked = true;
    }
    wireframeEnabledCb.addEventListener('change', e => {
        const enabled = (e.target as HTMLInputElement).checked;
        properties.updateProperty('wireframe', enabled);
    })
}

export function enableSplitScreenSwitch(properties: PropertiesManager, attachTarget: Element) {
    const parent = attachTarget;
    const element = document.createElement('div');
    element.innerHTML = `
        <div>
            <label for="split-screen">Split screen</label>
            <input type="checkbox" name="split-screen" id="split-screen" />
        </div>
    `;

    parent.append(element);
    const splitScreenEnabledCb = element.querySelector('#split-screen') as HTMLInputElement;

    splitScreenEnabledCb.checked = properties.getBoolean('splitScreen');

    splitScreenEnabledCb.addEventListener('change', e => {
        const enabled = (e.target as HTMLInputElement).checked;
        properties.updateProperty('splitScreen', enabled);
        if (enabled) {
            localStorage.setItem('splitScreen', 'true');
        } else {
            localStorage.removeItem('splitScreen');
        }
    });
}

export function enableGpuGraphicsApiSwitch(properties: PropertiesManager, attachTarget: Element) {
    const parent = attachTarget;
    const element = document.createElement('div');
    element.innerHTML = `
        <div>
            <label for="webgl-api">WebGL</label>
            <input type="radio" name="gpu-api-used" value="webgl2" id="webgl-api" />
            <label for="gpu-api">WebGPU</label>
            <input type="radio" name="gpu-api-used" value="webgpu" id="gpu-api" />
        </div>
    `;

    parent.append(element);
    properties.subscribeToPropertyChange('splitScreen', props => {
        element.style.display = !props.getBoolean('splitScreen') ? 'block' : 'none';
    })
    if (properties.getBoolean('splitScreen')) {
        element.style.display = 'none';
    }
    const webglCheckbox = element.querySelector('#webgl-api') as HTMLInputElement;
    const webGpuCheckbox = element.querySelector('#gpu-api') as HTMLInputElement;


    let currentApi = properties.getString('gpuApi');
    if (currentApi === 'webgl2') {
        webglCheckbox.checked = true;
    } else {
        webGpuCheckbox.checked = true;
    }

    [webglCheckbox, webGpuCheckbox].forEach(radio => {
        radio.addEventListener('change', e => {
            // @ts-ignore
            currentApi = e.target.value;
            properties.updateProperty('gpuApi', currentApi);
            localStorage.setItem('gpuApi', currentApi);
            SdiPerformance.reset();
        })
    });
}

export function createLightSourceControl(properties: PropertiesManager) {
    const parent = document.querySelector('.controls') as Element;
    const element = document.createElement('div');
    element.innerHTML = `
        <div>
            <div>Light source</div>
            <div style="display: flex">
                <div class="group">
                    <label for="light-source-x" id="label-x">X:</label>
                    <input type="text" id="light-source-x" />
                </div>
                <div class="group">
                    <label for="light-source-y" id="label-y">Y:</label>
                    <input type="text" id="light-source-y" /> 
                </div>
                <div class="group">
                    <label for="light-source-z" id="label-z">Z:</label>
                    <input type="text" id="light-source-z" />
                </div>                
            </div>
        </div>
    `;

    parent.append(element);
    const [xLabel, xInput] = [...element.querySelectorAll('#label-x, #light-source-x')] as [HTMLLabelElement, HTMLInputElement];
    const [yLabel, yInput] = [...element.querySelectorAll('#label-y, #light-source-y')] as [HTMLLabelElement, HTMLInputElement];
    const [zLabel, zInput] = [...element.querySelectorAll('#label-z, #light-source-z')] as [HTMLLabelElement, HTMLInputElement];

    [xInput, yInput, zInput].forEach((el, i) => {
        el.addEventListener('change', (e: Event) => {

            const sourceX = Number(xInput.value);
            const sourceY = Number(yInput.value);
            const sourceZ = Number(zInput.value);
            xLabel.textContent = `X: ${ sourceX }`;
            yLabel.textContent = `Y: ${ sourceY }`;
            zLabel.textContent = `Z: ${ sourceZ }`;
            properties.updateNestedProperty('light', { sourceX, sourceY, sourceZ, });
        })
    });
}

// export function enableEntitySelect(attachTarget: Element, entities: string[], onAdd: (entity: string) => void) {
export function enableEntitySelect(attachTarget: Element, entities: string[], onAdd: (entitySelect: EntitySelectPayload) => void) {
    const parent = attachTarget.querySelector('.controls') as Element;

    const element = document.createElement('sdi-entity-select');
    element.setAttribute('entities', entities.toString());
    addEventListener(element, 'add-entity', e => onAdd(e.detail));
    // const element = document.createElement('div');
    /*element.innerHTML = `
        <sdi-entity-select entities="${entities}"/>
    `;*/

    // element.querySelector('.add-entity')!.addEventListener('click', e => {
    //     onAdd(entities[0]);
    // })

    parent.append(element);
}


// export interface LightControls {
//     addDirLight(title: string, light: DirectionalLight): void,
//
//     addPointLight(title: string, light: PointLight): void,
// }
//
// export function enableLightControls(attachTarget: HTMLElement): LightControls {
//     const pane = new Pane({
//         title: 'Controls',
//         container: attachTarget.querySelector('.controls') as HTMLElement
//     });
//     pane.registerPlugin(EssentialsPlugin);
//     pane.registerPlugin(CamerakitPlugin);
//
//
//     const lights = pane.addTab({ pages: [{ title: 'Directional lights' }, { title: 'PointLights' }] });
//
//     function addDirLight(title: string, light: DirectionalLight) {
//         const tab = lights.pages[0];
//         const folder = tab.addFolder({ title });
//         folder.addBinding(light.direction, 0, { min: -1, max: 1, step: 0.01, label: 'X' });
//         folder.addBinding(light.direction, 1, { min: -1, max: 1, step: 0.01, label: 'Y' });
//         folder.addBinding(light.direction, 2, { min: -1, max: 1, step: 0.01, label: 'Z' });
//         folder.addBinding(light.color, 'rgba', {
//             color: { type: 'float' },
//             label: 'color', picker: 'inline'
//         });
//         folder.addBinding(light.props, 'intensity', { min: 0, max: 10.0, step: 0.01, label: 'Intensity' });
//     }
//
//     function addPointLight(title: string, light: PointLight) {
//         const tab = lights.pages[1];
//         const folder = tab.addFolder({ title });
//         folder.addBinding(light.data, 'linearAttenuation', { min: 0, max: 1, step: 0.001, label: 'Linear Attenuation' })
//         folder.addBinding(light.data, 'quadraticAttenuation', { min: 0, max: 1, step: 0.001, label: 'Quad Attenuation' })
//         folder.addBinding(light.color, 'rgba', {
//             color: { type: 'float' },
//             label: 'color',
//             picker: 'popup'
//         });
//         // folder.addBinding(light.data, 'position', { label: 'Position' });
//
//
//     }
//
//     return {
//         addDirLight, addPointLight
//     }
// }
