import { FolderApi, TpChangeEvent } from '@tweakpane/core';
import Component from "core/components/Component";
import Transform from 'core/components/Transform';
import DirectionalLight from "core/light/DirectionalLight";
import PointLight from "core/light/PointLight";
import SpotLight from "core/light/SpotLight";
import RightMenu from 'engine/ui/menus/RightMenu';
import RotationWidget from 'engine/ui/widgets/RotationWidget';
import { glMatrix } from "gl-matrix";
import { TabPageApi } from 'tweakpane';
import { wrapArrayAsColor, wrapArrayAsXYZ } from "../utils";

export class LightControl {

    private rootTab?: TabPageApi;

    private dirLightsTab?: FolderApi;
    private pointLightsTab?: FolderApi;
    private spotLightsTab?: FolderApi;

    private addedLights = new Set<string>();

    constructor(private layout: RightMenu) {
    }

    addDirectionalLight(entity: string, light: DirectionalLight) {
        if (this.addedLights.has(entity)) {
            return;
        }

        if (!this.dirLightsTab) {
            this.dirLightsTab = this.getRootTab().addFolder({ title: 'Directional' });
        }

        this._addDirectionalLight(this.dirLightsTab!.addFolder({ title: entity }), light);
        this.addedLights.add(entity);
    }

    addSpotlight(entity: string, spotLight: SpotLight, transform: Transform) {
        if (this.addedLights.has(entity)) {
            return;
        }

        if (!this.spotLightsTab) {
            this.spotLightsTab = this.getRootTab().addFolder({ title: 'Spotlight' });
        }

        this._addSpotLight(this.spotLightsTab.addFolder({ title: entity }), transform, spotLight);

        this.addedLights.add(entity);
    }

    addPointLight(entity: string, pointLight: PointLight, transform: Transform) {
        if (this.addedLights.has(entity)) {
            return;
        }

        if (!this.pointLightsTab) {
            this.pointLightsTab = this.getRootTab().addFolder({ title: 'PointLight' });
        }

        const container = this.pointLightsTab.addFolder({ title: entity });
        this._addPointLight(container, transform, pointLight);

        this.addedLights.add(entity);
    }

    private _addDirectionalLight(folder: FolderApi, light: DirectionalLight) {
        folder.addBinding(wrapArrayAsXYZ(light.direction), 'xyz', {
            label: 'Direction vector',
            expanded: true,
            x: { min: -1, max: 1, label: 'X', step: 0.1 },
            y: { min: -1, max: 1, label: 'Y', step: 0.1 },
            z: { min: -1, max: 1, label: 'Z', step: 0.1 },
        });
        folder.addBinding(wrapArrayAsColor(light.color), 'color', {
            label: 'color',
            color: { type: 'float' },
            picker: 'inline'
        });
        folder.addBinding(light, 'intensity', { label: 'Intensity', min: 0.0, max: 10.0, step: 0.1 });
    }

    private _addSpotLight(container: FolderApi, transform: Transform, spotLight: SpotLight) {
        // const point = { xyz: { x: 0, y: 0, z: 0 } };
        // container.addBinding(point, 'xyz');
        // container.addButton({ title: 'look at' }).on('click', e => {
        //     transform.lookAt([point.xyz.x, point.xyz.y, point.xyz.z]);
        // });

        container.addBinding(
            wrapArrayAsXYZ(transform.targetTransform.position),
            'xyz',
            { picker: 'inline', label: 'translate', step: 0.1 });

        const rotationWidget = new RotationWidget(transform.targetTransform, 'euler', 'deg');
        rotationWidget.attach(container);
        container.addBinding(spotLight.data, 'linearAttenuation',
            { label: 'Linear Attenuation', min: 0.00, max: 1.00, format: val => val.toFixed(2), });

        container.addBinding(spotLight.data, 'quadraticAttenuation', {
            label: 'Quad Attenuation',
            min: 0.001,
            max: 0.1,
            step: 0.001,
            format: val => (Number(val.toFixed(4))),
        });

        container.addBinding(wrapArrayAsColor(spotLight.color), 'color', {
            color: { type: 'float' },
            label: 'color',
            picker: 'inline'
        });

        container.addBinding(spotLight.data, 'intensity', { min: 0.1, max: 50.0, step: 0.1, label: 'Intensity' });

        const cutoff = {
            innerCutoff: Math.acos(spotLight.data.innerCutoff) * (180 / Math.PI),
            outerCutoff: Math.acos(spotLight.data.outerCutoff) * (180 / Math.PI)
        };

        function onChange(currentCutoff: 'inner' | 'outer', e: TpChangeEvent<number>) {
            if (currentCutoff === 'inner') {
                spotLight.data.innerCutoff = Math.cos(glMatrix.toRadian(e.value))
            }

            if (currentCutoff === 'outer') {
                spotLight.data.outerCutoff = Math.cos(glMatrix.toRadian(e.value))
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

    private _addPointLight(container: FolderApi, transform: Transform, pointLight: PointLight) {
        container.addBinding(
            wrapArrayAsXYZ(transform.targetTransform.position),
            'xyz',
            { picker: 'inline', label: 'translate', step: 0.1 });

        container.addBinding(wrapArrayAsColor(pointLight.color), 'color',
            { color: { type: 'float' }, label: 'color', picker: 'inline' });

        container.addBinding(pointLight.data, 'intensity', { min: 0.1, max: 50.0, step: 0.1, label: 'Intensity' });

        container.addBinding(pointLight.data, 'linearAttenuation',
            { label: 'Linear Attenuation', min: 0.0, max: 1.0, step: 0.01, format: val => val.toFixed(2), });

        container.addBinding(pointLight.data, 'quadraticAttenuation',
            { label: 'Quad Attenuation', min: 0.001, max: 0.1, step: 0.001, format: val => (Number(val.toFixed(4))), })
    }

    private getRootTab() {
        if (!this.rootTab) {
            this.rootTab = this.layout.createTab('LIGHTS');
        }

        return this.rootTab;
    }
}