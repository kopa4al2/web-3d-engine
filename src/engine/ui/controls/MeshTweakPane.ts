import { ContainerApi, FolderApi } from '@tweakpane/core';
import SdiPerformance from "core/utils/SdiPerformance";
import TransformWidget from "engine/ui/widgets/TransformWidget";
import { quat } from "gl-matrix";
import { wrapArrayAsXYZ, wrapArrayAsXYZW } from "../utils";
import Transform from 'core/components/Transform';
import Mesh from 'core/components/Mesh';
import DebugUtil from '../../../util/debug/DebugUtil';
import ThrottleUtil from '../../../util/ThrottleUtil';
import RightMenu from 'engine/ui/menus/RightMenu';

// type HierarchyData = { container: FolderApi, children: Transform[] };
type HierarchicalTransform = { container: FolderApi, transform: Transform };

class MeshTweakPane {

    private hierarchyMap = new Map<Transform, HierarchicalTransform>
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

        const folder = this.getRoot().addFolder({ title: entity });
        const transformWidget = new TransformWidget(transform);
        transformWidget.attach(folder);

        this.addedEntities.set(entity, folder);
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

    static addMeshV2(container: FolderApi, mesh: Mesh, transform: Transform) {
        this.addTransform(container, transform);
    }

    private static addTransform(container: FolderApi, transform: Transform) {
        const point = { xyz: { x: 0, y: 0, z: 0 } };
        container.addBinding(point, 'xyz');
        container.addButton({ title: 'look at' }).on('click', e => {
            transform.lookAt([point.xyz.x, point.xyz.y, point.xyz.z]);
        })
        container.addBinding(wrapArrayAsXYZ(transform.targetTransform.position), 'xyz', {
            picker: 'popup',
            label: 'translate',
            step: 0.1
        });
        container.addBinding(wrapArrayAsXYZW(transform.targetTransform.rotation), 'xyzw', {
            view: 'rotation',
            picker: 'popup',
            label: 'rotation',
            expanded: false,
        }).on('change', e => {
            quat.normalize(transform.targetTransform.rotation, transform.targetTransform.rotation);
        });

        container.addBinding(wrapArrayAsXYZW(transform.targetTransform.scale), 'xyzw', {
            picker: 'popup',
            label: 'scale',
            min: 0.1,
            step: 0.1,
        }).on('change', e => {

        });

        const scale = [1];
        let last = 1;
        container
            .addBinding(scale, 0, { label: 'uniform-scale', min: 0.001, max: 1000, step: 0.001 })
            .on('change', e => {
                const scaleFactor = e.value >= last ? 0.01 : -0.01;
                // const scaleFactor = e.value >= last ? e.value : -e.value;
                last = e.value
                transform.targetTransform.scale[0] += scaleFactor;
                transform.targetTransform.scale[1] += scaleFactor;
                transform.targetTransform.scale[2] += scaleFactor;

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
