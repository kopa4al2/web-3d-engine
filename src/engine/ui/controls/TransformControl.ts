import { ContainerApi } from '@tweakpane/core';
import Transform from 'core/components/Transform';
import { vec3 } from 'gl-matrix';
import { wrapArrayAsXYZW } from "../utils";

export default class TransformControl {


    public static create(parent: ContainerApi, transform: Transform) {
        const transformFolder = parent.addFolder({ title: 'transformation', expanded: true });
        const translationFolder = transformFolder.addFolder({ title: 'translation', expanded: true });

        setInterval(() => transformFolder.refresh(), 1000);
        translationFolder.addBlade({ view: 'separator' });
        translationFolder.addBlade({
            disabled: true,
            readonly: true,
            view: 'text',
            value: 'Translation',
            parse: (t: any) => null
        });

        translationFolder.addBinding(transform.position, 0, { min: -100, max: 100, step: 0.1, label: 'X' });
        translationFolder.addBinding(transform.position, 1, { min: -100, max: 100, step: 0.1, label: 'Y' });
        translationFolder.addBinding(transform.position, 2, { min: -100, max: 100, step: 0.1, label: 'Z' });

        const rotationFolder = transformFolder.addFolder({ title: 'rotation', expanded: true });

        rotationFolder.addBinding(wrapArrayAsXYZW(transform.rotation), 'xyzw', {
            view: 'rotation',
            picker: 'inline',
            label: 'rotation',
        })

        const scaleFolder = transformFolder.addFolder({ title: 'scale', expanded: true });

        scaleFolder.addBinding(wrapArrayAsXYZW(transform.scale), 'xyzw', {
            // view: 'rotation',
            picker: 'inline',
            label: 'scale',
        })
        // this.bindVec3('rotation', folder, transform.rotation);
        // this.bindVec3('scale', folder, transform.scale);
        // folder.addBinding(transform, 'position', {
        //     x: { min: -100, max: 100, step: 1, label: 'X' },
        //     y: { min: -100, max: 100, step: 1, label: 'Y' },
        //     z: { min: -100, max: 100, step: 1, label: 'Z' },
        // });
        // folder.addBinding(transform, 'rotation', {
        //     x: { min: -100, max: 100, step: 1, label: 'X' },
        //     y: { min: -100, max: 100, step: 1, label: 'Y' },
        //     z: { min: -100, max: 100, step: 1, label: 'Z' },
        // });
        // folder.addBinding(transform, 'scale', {
        //     x: { min: -100, max: 100, step: 1, label: 'X' },
        //     y: { min: -100, max: 100, step: 1, label: 'Y' },
        //     z: { min: -100, max: 100, step: 1, label: 'Z' },
        // });
    }

    // private static bindVec3(title: string, parent: ContainerApi, vec3: vec3, binding: {
    //     min: number,
    //     max: number,
    //     step: number,
    // }) {
    //     parent.addBlade({ view: 'separator' });
    //     parent.addBlade({
    //         view: 'text',
    //         label: title,
    //         value: 'value',
    //         parse: (t: any) => undefined
    //     });
    //
    //     parent.addBinding(vec3, 0, { label: 'X', ...binding });
    //     parent.addBinding(vec3, 1, binding);
    //     parent.addBinding(vec3, 2, binding);
    // }
}
