import { ContainerApi } from '@tweakpane/core';
import Transform from 'core/components/Transform';
import { mat4, vec3 } from 'gl-matrix';
import ThrottleUtil from "../../../util/ThrottleUtil";
import { wrapArrayAsXYZW } from "../utils";

export default class TransformControl {

    public static createTranslate(parent: ContainerApi, transform: Transform) {
        parent
            .addBinding(wrapArrayAsXYZW(
                    transform.targetTransform.position),
                'xyzw',
                { picker: 'inline', label: 'translate', min: -1000, max: 1000, step: 3 })
            .on('change', e => {
                if (!transform.parent) {
                    return;
                }

                // todo: this still needs some work, and i dont know if i should invest

                // const worldMovement = transform.targetTransform.position;
                // const localMovement = vec3.create();
                // const invertedParentWorld = mat4.invert(mat4.create(), transform.parent!.worldTransform.mat4);
                // vec3.transformMat4(localMovement, worldMovement, invertedParentWorld);
                // vec3.add(transform.targetTransform.position, transform.targetTransform.position, localMovement);
            });
    }
    public static create(parent: ContainerApi, transform: Transform) {
        const transformFolder = parent.addFolder({ title: 'transformation', expanded: true });
        this.createTranslate(transformFolder.addFolder({ title: 'translation', expanded: true }), transform);

        const rotationFolder = transformFolder.addFolder({ title: 'rotation', expanded: false });

        rotationFolder.addBinding(wrapArrayAsXYZW(transform.targetTransform.rotation), 'xyzw', {
            view: 'rotation',
            picker: 'inline',
            label: 'rotation',
            expanded: true,
        });

        const scaleFolder = transformFolder.addFolder({ title: 'scale', expanded: false });

        scaleFolder.addBinding(wrapArrayAsXYZW(transform.targetTransform.scale), 'xyzw', {
            picker: 'inline',
            label: 'scale',
            min: 0.01,
            step: 0.01,
        });

        const scale = { scale: transform.localTransform.scale[0] };
        scaleFolder
            .addBinding(scale, 'scale', { label: 'uniform-scale', min: 0.01, max: 20, step: 0.01 })
            .on('change', e => {

                transform.targetTransform.scale[0] = e.value;
                transform.targetTransform.scale[1] = e.value;
                transform.targetTransform.scale[2] = e.value;
                scaleFolder.refresh();
            });

        return transformFolder;
    }
}
