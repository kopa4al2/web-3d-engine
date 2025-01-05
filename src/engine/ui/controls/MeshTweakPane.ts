import { ContainerApi, FolderApi } from '@tweakpane/core';
import SdiPerformance from 'utils/SdiPerformance';
import DebugUtil from 'utils/debug/DebugUtil';
import TransformWidget from 'engine/ui/widgets/TransformWidget';
import { quat } from 'gl-matrix';
import { wrapArrayAsXYZ, wrapArrayAsXYZW } from '../utils';
import Transform from 'core/components/Transform';
import Mesh from 'core/components/Mesh';
import RightMenu from 'engine/ui/menus/RightMenu';

// type HierarchyData = { container: FolderApi, children: Transform[] };
type HierarchicalTransform = { container: FolderApi, transform: Transform };

class MeshTweakPane {

  private hierarchyMap = new Map<Transform, HierarchicalTransform>;
  private unprocessedQueue: HierarchicalTransform[] = [];

  private added = new WeakSet<Mesh>();

  private addedEntities = new Map<string, FolderApi>();
  private root?: ContainerApi;

  private filter = { value: '' };

  constructor(private menu: RightMenu) {
    // this.processHierarchies = ThrottleUtil.debounce(this.processHierarchies.bind(this), 500);
    DebugUtil.addToWindowObject('meshControl', this);
  }

  addMesh(entity: string, mesh: Mesh, transform: Transform) {
    if (this.addedEntities.has(entity)) {
      return;
    }

    const folder = this.getRoot().addFolder({ title: entity, expanded: false });
    // const point = { xyz: { x: 0, y: 0, z: 0 } };
    // folder.addBinding(point, 'xyz');
    // folder.addButton({ title: 'look at' }).on('click', e => {
    //   transform.lookAt([point.xyz.x, point.xyz.y, point.xyz.z]);
    // });
    const arrToFixed = this.arrayToFixed;
    const transformMonitor = {
      get data() {
        return `
Local position: [${arrToFixed(transform.localTransform.translation, 2)}, 
World position: [${arrToFixed(transform.worldTransform.translation, 2)}]
Local rotation: [${arrToFixed(transform.localTransform.rotation, 2)}]
World rotation: [${arrToFixed(transform.worldTransform.rotation, 2)}]
Local scale: [${arrToFixed(transform.localTransform.scale, 2)}]
World scale: [${arrToFixed(transform.worldTransform.scale, 2)}]`;
      },
    };
    folder.addBinding(transformMonitor, 'data', { label: undefined, readonly: true, rows: 6, multiline: true });

    const transformWidget = new TransformWidget(transform);
    // transformWidget.attach(folder.addFolder({ title: transform.label, expanded: true, }));
    transformWidget.attach(folder);

    this.addedEntities.set(entity, folder);
  }

  private arrayToFixed(array: (number[] | ArrayLike<number>), fixed = 3) {
    let string = '';
    for (let i = 0; i < array.length; i++) {
      string += `${array[i].toFixed(fixed)} `;
    }

    return string;
  }

  private getRoot() {
    if (!this.root) {
      this.root = this.menu.createTab('ENTITIES');
      const filterInput = this.root.addBinding(this.filter, 'value', {
        label: 'Filter entities'
      });

      filterInput.controller.view.valueElement.addEventListener('input', e => {
        // @ts-ignore
        const val: string = e.target.value;

        for (const [entity, folder] of this.addedEntities) {
          folder.hidden = val !== '' && !entity.toLowerCase().includes(val.toLowerCase());
        }
      });
    }

    return this.root;
  }

//
  // addLonelyTransform(container: FolderApi, transform: Transform, name: EntityName) {
  //     if (this.hierarchyMap.has(transform)) {
  //         console.warn('Transform was already added', transform, name);
  //         return;
  //     }
  //
  //     this.addTransform(container, transform);
  //
  //     this.unprocessedQueue.push({ container, transform });
  //     this.processHierarchies();
  // }


  private static addTransform(container: FolderApi, transform: Transform) {
    const point = { xyz: { x: 0, y: 0, z: 0 } };
    container.addBinding(point, 'xyz');
    // container.addButton({ title: 'look at' }).on('click', e => {
    //   transform.lookAt([point.xyz.x, point.xyz.y, point.xyz.z]);
    // });
    container.addBinding(wrapArrayAsXYZ(transform.localTransform.translation), 'xyz', {
      picker: 'popup',
      label: 'translate',
      step: 0.1
    }).on('change', e => { transform.needsCalculate = true; });
    container.addBinding(wrapArrayAsXYZW(transform.localTransform.rotation), 'xyzw', {
      view: 'rotation',
      picker: 'popup',
      label: 'rotation',
      expanded: false,
    }).on('change', e => {
      // quat.slerp(transform.localTransform.rotation, transform.localTransform.rotation, transform.localTransform.rotation, 0.1);
      quat.normalize(transform.localTransform.rotation, transform.localTransform.rotation);
      transform.needsCalculate = true;
    });

    container.addBinding(wrapArrayAsXYZW(transform.localTransform.scale), 'xyzw', {
      picker: 'popup',
      label: 'scale',
      min: 0.1,
      step: 0.1,
    }).on('change', e => {
        transform.needsCalculate = true;
    });

    const scale = [1];
    let last = 1;
    container
      .addBinding(scale, 0, { label: 'uniform-scale', min: 0.001, max: 1000, step: 0.001 })
      .on('change', e => {
        const scaleFactor = e.value >= last ? 0.01 : -0.01;
        // const scaleFactor = e.value >= last ? e.value : -e.value;
        last = e.value;
        transform.localTransform.scale[0] += scaleFactor;
        transform.localTransform.scale[1] += scaleFactor;
        transform.localTransform.scale[2] += scaleFactor;
        transform.needsCalculate = true;
        container.refresh();
      });
  }

  private processHierarchies(repeat = 1) {
    let preventStackOverflowCounter = 0;
    const MAX_ITERATIONS = 100;
    while (preventStackOverflowCounter++ < MAX_ITERATIONS && this.unprocessedQueue.length !== 0) {
      let { transform, container } = this.unprocessedQueue.shift()!;

      if (!this.hierarchyMap.has(transform) && !transform.parent) {
        container = RightMenu.moveFolder(this.root!, container);
        this.hierarchyMap.set(transform, { container, transform, });
      } else if (transform.parent && this.hierarchyMap.has(transform.parent)) {
        const parentContainer = this.hierarchyMap.get(transform.parent)!.container;
        container = RightMenu.moveFolder(parentContainer, container);
        this.hierarchyMap.set(transform, { container, transform, });
      } else {
        this.unprocessedQueue.push({ transform, container });
      }
    }

    if (this.unprocessedQueue.length > 0) {
      setTimeout(() => this.processHierarchies(repeat + 1), repeat * 500);
      return;
    }

    SdiPerformance.log(`Added all meshes to the control menu in ${repeat} iterations`);
  }
}

export default MeshTweakPane;
