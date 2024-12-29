import { ContainerApi, FolderApi, TpChangeEvent } from '@tweakpane/core';
import DirectionalLight from "core/light/DirectionalLight";
import PointLight from "core/light/PointLight";
import SpotLight from "core/light/SpotLight";
import SdiPerformance from "core/utils/SdiPerformance";
import { glMatrix, quat } from "gl-matrix";
import UILayout from "../UILayout";
import { wrapArrayAsColor, wrapArrayAsXYZ, wrapArrayAsXYZW } from "../utils";
import Component from 'core/components/Component';
import Transform from 'core/components/Transform';
import Mesh from 'core/components/Mesh';
import DebugUtil from '../../../util/debug/DebugUtil';
import ThrottleUtil from '../../../util/ThrottleUtil';
import { EntityName } from 'core/EntityManager';
import TransformControl from './TransformControl';

// type HierarchyData = { container: FolderApi, children: Transform[] };
type HierarchicalTransform = { container: FolderApi, transform: Transform };

class MeshControl {

    private hierarchyMap = new Map<Transform, HierarchicalTransform>
    private unprocessedQueue: HierarchicalTransform[] = [];

    // private unprocessedQueue = new Set<HierarchicalTransform>();

    constructor(private root: ContainerApi) {
        this.processHierarchies = ThrottleUtil.debounce(this.processHierarchies.bind(this), 500);
        DebugUtil.addToWindowObject('meshControl', this);
    }

    addLonelyTransform(container: FolderApi, transform: Transform, name: EntityName) {
        if (this.hierarchyMap.has(transform)) {
            console.warn('Transform was already added', transform, name);
            return;
        }

        this.addTransform(container, transform);

        this.unprocessedQueue.push({ container, transform });
        this.processHierarchies();
    }

    addMesh(entity: EntityName, container: FolderApi, components: Component[]) {
        const mesh = components.find(c => c.id === Mesh.ID) as Mesh;
        const transform = components.find(c => c.id === Transform.ID) as Transform;

        if (!transform) {
            return;
        }

        this.addTransform(container, transform);

        this.unprocessedQueue.push({ transform, container });
        this.processHierarchies();
    }

    private addTransform(container: FolderApi, transform: Transform) {
        const point = { xyz: { x: 0, y: 0, z: 0} };
        container.addBinding(point, 'xyz');
        container.addButton({ title: 'look at'}).on('click', e => {
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
            expanded: true,
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
                container = UILayout.moveFolder(this.root, container);
                this.hierarchyMap.set(transform, { container, transform, });
            } else if (transform.parent && this.hierarchyMap.has(transform.parent)) {
                const parentContainer = this.hierarchyMap.get(transform.parent)!.container;
                container = UILayout.moveFolder(parentContainer, container);
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

export default MeshControl;
