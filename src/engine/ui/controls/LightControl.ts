import DirectionalLight from "core/light/DirectionalLight";
import PointLight from "core/light/PointLight";
import UILayout from "../UILayout";
import MathUtil from '../../../util/MathUtil';
import { ContainerApi } from '@tweakpane/core';

export class LightControl {

    private readonly dirLightsTab;
    private readonly pointLightsTab;

    constructor(layout: UILayout) {
        // const tabs = layout.addTabs('Directional lights', 'Point lights');
        // this.dirLightsTab = tabs.pages[0];
        // this.pointLightsTab = tabs.pages[1];
        // this.dirLightsTab = layout.addFolder('Dir');
        // this.pointLightsTab = layout.addFolder('Point');
        this.dirLightsTab = layout.newPane('Directional lights');
        this.pointLightsTab = layout.newPane('Point lights');
    }

    addDirLight(title: string, light: DirectionalLight) {
        const folder = this.dirLightsTab.addFolder({ title });
        folder.addBinding(light.direction, 'xyzw', {
            picker: 'inline',
            label: 'Direction',
            view: 'rotation',
            rotationMode: 'euler',
            x: { min: -1, max: 1, step: 0.01, label: 'X' },
            y: { min: -1, max: 1, step: 0.01, label: 'Y' },
            z: { min: -1, max: 1, step: 0.01, label: 'Z' },
        })
        folder.addBinding(light.color, 'rgba', { label: 'color', color: { type: 'float' }, picker: 'inline' });
        folder.addBinding(light.props, 'intensity', { min: 0.1, max: 10.0, step: 0.1, label: 'Intensity' });
    }

    addPointLight(title: string, light: PointLight) {
        const folder = this.pointLightsTab.addFolder({ title });
        folder.addBinding(light.data, 'linearAttenuation', {
            // format: val => (Number(val.toFixed(3))) * 100,
            min: 0.0,
            max: 1.0,
            step: 0.01,
            keyScale: 10,
            pointerScale: 10,
            label: 'Linear Attenuation'
        })
        folder.addBinding(light.data, 'quadraticAttenuation', {
            format: val => (Number(val.toFixed(3))) * 100,
            min: 0.0001,
            max: 0.1,
            step: 0.0001,
            keyScale: 1,
            pointerScale: 100,
            label: 'Quad Attenuation'
        })
        folder.addBinding(light.position, 'xyz', {
            label: 'position',
            x: { min: -100, max: 100, step: 1, label: 'X' },
            y: { min: -100, max: 100, step: 1, label: 'Y' },
            z: { min: -100, max: 100, step: 1, label: 'Z' },
        });
        folder.addBinding(light.color, 'rgba', {
            color: { type: 'float' },
            label: 'color',
            picker: 'inline'
        });

        folder.addBinding(light.data, 'intensity', { min: 0.1, max: 50.0, step: 0.1, label: 'Intensity' });

    }

    static addDirectionalLight(folder: ContainerApi, light: DirectionalLight) {
        folder.addBinding(light.direction, 'xyzw', {
            label: 'Direction',
            picker: 'inline',
            view: 'rotation',
            rotationMode: 'euler',
            x: { min: -1, max: 1, step: 0.01, label: 'X' },
            y: { min: -1, max: 1, step: 0.01, label: 'Y' },
            z: { min: -1, max: 1, step: 0.01, label: 'Z' },
        });
        folder.addBinding(light.color, 'rgba', { label: 'color', color: { type: 'float' }, picker: 'inline' });
        folder.addBinding(light.props, 'intensity', { label: 'Intensity', min: 0.1, max: 10.0, step: 0.1 });
    }

    static addPointLight(container: ContainerApi, light: PointLight) {
        container.addBinding(light.data, 'linearAttenuation', {
            label: 'Linear Attenuation',
            min: 0.0,
            max: 1.0,
            step: 0.01,
            format: val => (val * 100).toFixed(2),
        });
        container.addBinding(light.data, 'quadraticAttenuation', {
            label: 'Quad Attenuation',
            min: 0.0001,
            max: 0.1,
            step: 0.0001,
            format: val => (Number(val.toFixed(3))) * 100,
        })
        container.addBinding(light.position, 'xyz', {
            label: 'position',
            x: { min: -999, max: 999, step: 1, label: 'X' },
            y: { min: -999, max: 999, step: 1, label: 'Y' },
            z: { min: -999, max: 999, step: 1, label: 'Z' },
        });
        container.addBinding(light.color, 'rgba', { color: { type: 'float' }, label: 'color', picker: 'inline' });

        container.addBinding(light.data, 'intensity', { min: 0.1, max: 50.0, step: 0.1, label: 'Intensity' });

    }
}
