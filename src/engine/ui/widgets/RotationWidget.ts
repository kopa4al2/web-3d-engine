import { quat, vec3 } from 'gl-matrix';
import { BindingApi, BindingParams, BladeState, ContainerApi, TpChangeEvent } from '@tweakpane/core';
import { wrapArrayAsXYZ, wrapArrayAsXYZW } from 'engine/ui/utils';
import { Rotation } from '@0b5vr/tweakpane-plugin-rotation/dist/types/Rotation';

export interface Transform {
    rotation: quat;
    position: vec3;
}

export type RotationMode = 'quaternion' | 'euler';
export type RotationUnits = 'rad' | 'deg' | 'turn';

export default class RotationWidget {

    private container?: ContainerApi;
    private widget?: BindingApi;
    private unitsBinding?: BindingApi;

    public readonly euler = vec3.create();
    private internalRotation?: Rotation;

    constructor(public rotationValue: Transform,
                private _mode: RotationMode,
                private _units: RotationUnits,
                private state?: BladeState) {
        this.handleEulerRotationChange = this.handleEulerRotationChange.bind(this);
    }

    get mode(): RotationMode {
        return this._mode;
    }

    set mode(value: RotationMode) {
        this._mode = value;

        this.reInitialize();
    }

    get units(): RotationUnits {
        return this._units;
    }

    set units(value: RotationUnits) {
        this._units = value;

        this.reInitialize();
    }

    attach(container: ContainerApi, params: Partial<BindingParams> = {}) {
        this.container = container;
        this.initializeWidget(container, params);
        this.initializeRadioButtons();

        return this.widget;
    }

    private initializeWidget(container: ContainerApi, params: Partial<BindingParams> = {}) {
        if (this.mode === 'quaternion') {
            this.widget = container.addBinding(wrapArrayAsXYZW(this.rotationValue.rotation), 'xyzw', {
                picker: 'inline',
                label: 'rotation',
                view: 'rotation',
                rotationMode: 'quaternion',
                ...this.state,
                ...params
            });
        } else {
            this.updateEuler();
            this.widget = container.addBinding(wrapArrayAsXYZ(this.euler), 'xyz', {
                picker: 'inline',
                label: 'rotation',
                view: 'rotation',
                rotationMode: 'euler',
                order: 'ZYX',
                unit: this.units,
                ...this.state,
                ...params
                // x: { min: -360, max: 360, step: 1 },
                // y: { min: -360, max: 360, step: 1 },
                // z: { min: -360, max: 360, step: 1 },
            }).on('change', this.handleEulerRotationChange);
        }

        if (this.state) {
            this.widget!.importState(this.state)
        }
    }

    private initializeRadioButtons() {
        const container = this.container!;
        const availableRotationModes = [
            { title: 'Euler', value: 'euler' },
            { title: 'Quaternion', value: 'quaternion' },
        ];

        const availableRotationUnits = [
            { title: 'Degrees', value: 'deg' },
            { title: 'Radians', value: 'rad' },
            { title: 'Turn', value: 'turn' }
        ];

        container.addBinding({ selected: this.mode }, 'selected', {
            label: 'Mode',
            groupName: 'rotation_mode',
            view: 'radiogrid',
            size: [2, 1],
            value: this.mode,
            cells: (x: number, y: number) => availableRotationModes[x]
        }).on('change', (ev) => this.mode = ev.value as unknown as RotationMode);

        this.unitsBinding = container.addBinding({ selected: this.units }, 'selected', {
            label: 'Units',
            groupName: 'rotation_units',
            view: 'radiogrid',
            size: [3, 1],
            value: this.units,
            disabled: this.mode === 'quaternion',
            cells: (x: number, y: number) => availableRotationUnits[x]
        }).on('change', (ev) => this.units = ev.value as unknown as RotationUnits);
    }

    private reInitialize() {
        if (this.widget) {
            const index = this.container!.children.findIndex(el => el === this.widget);
            this.state = {
                expanded: true
            }
            this.widget?.dispose();
            this.initializeWidget(this.container!, { index });
            this.unitsBinding!.disabled = this.mode === 'quaternion';
        }
    }

    private handleEulerRotationChange(e: TpChangeEvent<any>) {
        if (this.units === 'deg') {
            quat.fromEuler(this.rotationValue.rotation, this.euler[0], this.euler[1], this.euler[2]);
        } else {
            const { x, y, z, w } = this.getRotation().quat;
            
            this.rotationValue.rotation[0] = x;
            this.rotationValue.rotation[1] = y;
            this.rotationValue.rotation[2] = z;
            this.rotationValue.rotation[3] = w;
        }
    }

    private getRotation<T extends Rotation>(): T {
        // @ts-ignore
        return this.widget.controller.valueController.value.value_.rawValue_ as T;
    }

    private updateEuler() {
        let rotation;
        if (!this.widget) {
            const tmp = this.container!.addBinding(wrapArrayAsXYZW(this.rotationValue.rotation), 'xyzw', {
                picker: 'inline',
                label: 'rotation',
                view: 'rotation',
            });

            // @ts-ignore
            rotation = tmp.controller.valueController.value.value_.rawValue_;
            tmp.dispose();
        } else {
            rotation = this.getRotation();
        }
        
        const euler = rotation.toEuler('ZYX', this.units);
        this.euler[2] = euler.x;
        this.euler[1] = euler.y;
        this.euler[0] = euler.z;
    }
}
