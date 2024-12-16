import DirectionalLight from "core/light/DirectionalLight";
import PointLight from "core/light/PointLight";
import UILayout from "../UILayout";

export class LightControl {

    private readonly dirLightsTab;
    private readonly pointLightsTab;

    constructor(layout: UILayout) {
        // const tabs = layout.addTabs('Directional lights', 'Point lights');
        // this.dirLightsTab = tabs.pages[0];
        // this.pointLightsTab = tabs.pages[1];
        this.dirLightsTab = layout.addFolder('Dir');
        this.pointLightsTab = layout.addFolder('Point');
    }

    addDirLight(title: string, light: DirectionalLight) {
        const folder = this.dirLightsTab.addFolder({ title });
        // folder.addBinding(light.direction, 0, { min: -1, max: 1, step: 0.01, label: 'X' });
        // folder.addBinding(light.direction, 1, { min: -1, max: 1, step: 0.01, label: 'Y' });
        // folder.addBinding(light.direction, 2, { min: -1, max: 1, step: 0.01, label: 'Z' });
        folder.addBinding(light.direction, 'xyzw', {
            picker: 'inline',
            expanded: true,
            label: 'Direction',
            x: { min: -1, max: 1, step: 0.01, label: 'X' },
            y: { min: -1, max: 1, step: 0.01, label: 'Y' },
            z: { min: -1, max: 1, step: 0.01, label: 'Z' },
            w: { min: -1, max: 1, step: 0.01, label: 'W' },
        })
        folder.addBinding(light.color, 'rgba', {
            color: { type: 'float' },
            label: 'color', picker: 'inline'
        });
        folder.addBinding(light.props, 'intensity', { min: 0, max: 10.0, step: 0.01, label: 'Intensity' });
    }

    addPointLight(title: string, light: PointLight) {
        const folder = this.pointLightsTab.addFolder({ title });
        folder.addBinding(light.data, 'linearAttenuation', {
            min: 0.001,
            max: 0.1,
            step: 0.001,
            label: 'Linear Attenuation'
        })
        folder.addBinding(light.data, 'quadraticAttenuation', {
            min: 0.00001,
            max: 0.01,
            step: 0.001,
            label: 'Quad Attenuation'
        })
        folder.addBinding(light.color, 'rgba', {
            x: { min: 0, max: 1 },
            y: { min: 0, max: 1 },
            z: { min: 0, max: 1 },
            w: { min: 0, max: 1 },
        });
        // folder.addBinding(light.color, 'rgba', {
        //     color: { type: 'float' },
        //     label: 'color',
        //     picker: 'popup'
        // });
        // folder.addBinding(light.data, 'position', { label: 'Position' });


    }
}