import { ContainerApi, TpChangeEvent } from '@tweakpane/core';
import DirectionalLight from "core/light/DirectionalLight";
import PointLight from "core/light/PointLight";
import SpotLight from "core/light/SpotLight";
import { glMatrix, mat4, quat, vec3 } from "gl-matrix";
import UILayout from "../UILayout";
import { wrapArrayAsColor, wrapArrayAsXYZW } from "../utils";
import Component from 'core/components/Component';
import Transform from 'core/components/Transform';

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

    static addPointLightV2(container: ContainerApi, components: Component[]) {
        const pointLight = components.find(c => c.id === PointLight.ID) as PointLight;
        this.addPointLight(container, pointLight);
        // TODO: Add transform
    }

    static addPointLight(container: ContainerApi, light: PointLight) {
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

    static addSpotLightV2(container: ContainerApi, components: Component[]) {
        const light = components.find(c => c.id === SpotLight.ID) as SpotLight;
        const transform = components.find(c => c.id === Transform.ID) as Transform;

        container.addBinding(wrapArrayAsXYZW(transform.targetTransform.position), 'xyzw', {
            picker: 'inline',
            label: 'translate',
            step: 1
        })
        const rotation = transform.targetTransform.rotation;

        const euler = [0, 90, 45]//toEulerXYZ(rotation);
        const params = {
            euler: { x: euler[0], y: euler[1], z: euler[2] },
            quat: { x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] }
        };
        container.addBinding(params, 'euler', {
            picker: 'inline',
            label: 'rotation',
            view: 'rotation',
            rotationMode: 'euler',
            unit: 'deg'
        }).on('change', e => {
            // transform.targetTransform.rotation[0] = e.value.x;
            // transform.targetTransform.rotation[1] = e.value.y;
            // transform.targetTransform.rotation[2] = e.value.z;
            // transform.targetTransform.rotation[3] = e.value.w;
            // quat.normalize(transform.targetTransform.rotation, transform.targetTransform.rotation);
            quat.fromEuler(transform.targetTransform.rotation, e.value.x, e.value.y, e.value.z);
        })
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

        const cutoff = { innerCutoff: Math.acos(light.data.innerCutoff) * (180 / Math.PI), outerCutoff: Math.acos(light.data.outerCutoff) * (180 / Math.PI) };

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

    // static addSpotLight(container: ContainerApi, light: SpotLight) {
    //     container.addBinding(light.data, 'linearAttenuation', {
    //         label: 'Linear Attenuation',
    //         min: 0.0,
    //         max: 1.0,
    //         step: 0.01,
    //         format: val => val.toFixed(2),
    //     });
    //
    //     container.addBinding(light.data, 'quadraticAttenuation', {
    //         label: 'Quad Attenuation',
    //         min: 0.001,
    //         max: 0.1,
    //         step: 0.001,
    //         format: val => (Number(val.toFixed(4))),
    //     });
    //
    //     container.addBinding(wrapArrayAsColor(light.color), 'color', {
    //         color: { type: 'float' },
    //         label: 'color',
    //         picker: 'inline'
    //     });
    //
    //     container.addBinding(light.data, 'intensity', { min: 0.1, max: 50.0, step: 0.1, label: 'Intensity' });
    //
    //     const cutoff = { innerCutoff: 30, outerCutoff: 40 };
    //
    //     function onChange(currentCutoff: 'inner' | 'outer', e: TpChangeEvent<number>) {
    //         if (currentCutoff === 'inner') {
    //             light.data.innerCutoff = Math.cos(glMatrix.toRadian(e.value))
    //         }
    //
    //         if (currentCutoff === 'outer') {
    //             light.data.outerCutoff = Math.cos(glMatrix.toRadian(e.value))
    //         }
    //
    //         if (cutoff.outerCutoff < cutoff.innerCutoff) {
    //             cutoff.outerCutoff = cutoff.innerCutoff;
    //             container.refresh();
    //         }
    //     }
    //
    //     container.addBinding(cutoff, 'innerCutoff', { min: 5, max: 60, step: 1, label: 'Inner cutoff' })
    //         .on('change', e => onChange('inner', e));
    //     container.addBinding(cutoff, 'outerCutoff', { min: 5, max: 90, step: 1, label: 'Outer cutoff' })
    //         .on('change', e => onChange('outer', e));
    // }
}

function toEulerXYZ(quat: quat) {
    const w = quat[3];
    const x = quat[0];
    const y = quat[1];
    const z = quat[2];

    const wx = w * x,
        wy = w * y,
        wz = w * z;
    const xx = x * x,
        xy = x * y,
        xz = x * z;
    const yy = y * y,
        yz = y * z,
        zz = z * z;

    const xyz = [
        -Math.atan2(2 * (yz - wx), 1 - 2 * (xx + yy)),
        Math.asin(2 * (xz + wy)),
        -Math.atan2(2 * (xy - wz), 1 - 2 * (yy + zz)),
    ];
    return xyz.map((x) => (x * 180) / Math.PI);
}