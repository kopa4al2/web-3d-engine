import { ContainerApi, TpChangeEvent } from '@tweakpane/core';
import DirectionalLight from "core/light/DirectionalLight";
import PointLight from "core/light/PointLight";
import SpotLight from "core/light/SpotLight";
import { glMatrix } from "gl-matrix";
import UILayout from "../UILayout";
import { wrapArrayAsColor } from "../utils";

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
            expanded: true,
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
            format: val => val.toFixed(2),
        });
        console.log(light.data.quadraticAttenuation)
        container.addBinding(light.data, 'quadraticAttenuation', {
            label: 'Quad Attenuation',
            min: 0.001,
            max: 0.1,
            step: 0.001,
            format: val => (Number(val.toFixed(4))),
        })
        // container.addBinding(light.position, 'xyz', {
        //     label: 'position',
        //     x: { min: -999, max: 999, step: 1, label: 'X' },
        //     y: { min: -999, max: 999, step: 1, label: 'Y' },
        //     z: { min: -999, max: 999, step: 1, label: 'Z' },
        // });
        container.addBinding(light.color, 'rgba', { color: { type: 'float' }, label: 'color', picker: 'inline' });

        container.addBinding(light.data, 'intensity', { min: 0.1, max: 50.0, step: 0.1, label: 'Intensity' });
    }

    static addSpotLight(container: ContainerApi, light: SpotLight) {
        container.addBinding(light.data, 'linearAttenuation', {
            label: 'Linear Attenuation',
            min: 0.0,
            max: 1.0,
            step: 0.01,
            format: val => val.toFixed(2),
        });

        container.addBinding(light.data, 'quadraticAttenuation', {
            label: 'Quad Attenuation',
            min: 0.001,
            max: 0.1,
            step: 0.001,
            format: val => (Number(val.toFixed(4))),
        });

        container.addBinding(wrapArrayAsColor(light.color), 'color', {
            color: { type: 'float' },
            label: 'color',
            picker: 'inline'
        });

        container.addBinding(light.data, 'intensity', { min: 0.1, max: 50.0, step: 0.1, label: 'Intensity' });

        const cutoff = { innerCutoff: 5, outerCutoff: 5 };

        function onChange(currentCutoff: 'inner' | 'outer', e: TpChangeEvent<number>) {
            if (currentCutoff === 'inner') {
                light.data.innerCutoff = Math.cos(glMatrix.toRadian(e.value))
            }

            if (currentCutoff === 'outer') {
                light.data.outerCutoff = Math.cos(glMatrix.toRadian(e.value))
            }

            if (cutoff.outerCutoff < cutoff.innerCutoff) {
                cutoff.outerCutoff = cutoff.innerCutoff;
                container.refresh();
            }
        }

        container.addBinding(cutoff, 'innerCutoff', { min: 5, max: 60, step: 1, label: 'Inner cutoff' })
            .on('change', e => onChange('inner', e));
        container.addBinding(cutoff, 'outerCutoff', { min: 5, max: 90, step: 1, label: 'Outer cutoff' })
            .on('change', e => onChange('outer', e));

    }
}
