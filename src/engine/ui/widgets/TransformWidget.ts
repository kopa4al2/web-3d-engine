import { BindingParams, ContainerApi, FolderApi } from '@tweakpane/core';
import Transform from 'core/components/Transform';
import { wrapArrayAsXYZW } from 'engine/ui/utils';
import RotationWidget, { RotationMode, RotationUnits } from 'engine/ui/widgets/RotationWidget';

export default class TransformWidget {
  private rotationWidget;
  private root?: FolderApi;

  constructor(private transform: Transform,
              mode: RotationMode = 'quaternion',
              units: RotationUnits = 'deg') {

    this.rotationWidget = new RotationWidget(transform.localTransform, mode, units);
  }

  attach(container: ContainerApi, params: Partial<BindingParams> = {}) {
    this.root = container.addFolder({ title: this.transform.label });

    const targetPosition = wrapArrayAsXYZW(this.transform.localTransform.translation);
    this.root
        .addBinding(targetPosition,
          'xyzw',
          { picker: 'inline', label: 'translate', min: -1000, max: 1000, step: 1 })
      .on('change', e => this.transform.needsCalculate = true);

    this.root.addBinding(wrapArrayAsXYZW(this.transform.localTransform.scale), 'xyzw', {
      picker: 'inline',
      label: 'scale',
      min: 0.01,
      step: 0.01,
    })
      .on('change', e => this.transform.needsCalculate = true);


    const scale = { scale: this.transform.localTransform.scale[0] };
    this.root
        .addBinding(scale, 'scale', { label: 'uniform-scale', min: 0.01, max: 100, step: 0.01 })
        .on('change', e => {

          this.transform.localTransform.scale[0] = e.value;
          this.transform.localTransform.scale[1] = e.value;
          this.transform.localTransform.scale[2] = e.value;
          this.root!.refresh();
        });

    this.attachRotation(this.root, { index: 1, ...params });
  }

  attachRotation(container: ContainerApi, params: Partial<BindingParams> = {}) {
    this.rotationWidget.attach(container, params)!
      .on('change', e => this.transform.needsCalculate = true);
  }
}