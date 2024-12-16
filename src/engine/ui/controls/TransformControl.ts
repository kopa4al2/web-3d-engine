import { ContainerApi } from '@tweakpane/core';
import Transform from 'core/components/Transform';
import { vec3 } from 'gl-matrix';

export default class TransformControl {


    public static create(parent: ContainerApi, transform: Transform) {
        const folder = parent.addFolder({ title: 'transformation', expanded: false });

        folder.addBlade({ view: 'separator' });
        folder.addBlade({
            // disabled: true,
            readonly: true,
            view: 'text',
            // label: '',
            value: 'Translation',
            parse: (t: any) => null
        });

        // folder.addBlade({
        //     // disabled: true,
        //     readonly: true,
        //     view: 'sdi-label',
        //     // label: '',
        //     value: 'Translation',
        //     parse: (t: any) => null
        // });

        folder.addBinding(transform.position, 0, { min: -100, max: 100, step: 0.1, label: 'X' });
        folder.addBinding(transform.position, 1, { min: -100, max: 100, step: 0.1, label: 'Y' });
        folder.addBinding(transform.position, 2, { min: -100, max: 100, step: 0.1, label: 'Z' });
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
