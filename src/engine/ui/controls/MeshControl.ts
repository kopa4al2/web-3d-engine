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

        this.unprocessedQueue.push({ container, transform });
        TransformControl.create(container, transform);
        this.processHierarchies();
    }

    addMesh(container: FolderApi, components: Component[]) {
        const mesh = components.find(c => c.id === Mesh.ID) as Mesh;
        const transform = components.find(c => c.id === Transform.ID) as Transform;

        if (!transform) {
            return;
        }

        this.unprocessedQueue.push({ transform, container });
        this.processHierarchies();

        container.addBinding(wrapArrayAsXYZ(transform.targetTransform.position), 'xyz', {
            picker: 'inline',
            label: 'translate',
            step: 1
        });
        container.addBinding(wrapArrayAsXYZW(transform.targetTransform.rotation), 'xyzw', {
            view: 'rotation',
            picker: 'inline',
            label: 'rotation',
            expanded: true,
        }).on('change', e => {
            quat.normalize(transform.targetTransform.rotation, transform.targetTransform.rotation);
        });

        container.addBinding(wrapArrayAsXYZW(transform.targetTransform.scale), 'xyzw', {
            picker: 'inline',
            label: 'scale',
            min: 0.0001,
            step: 0.01,
        });

        const scale = { scale: transform.localTransform.scale[0] };
        container
            .addBinding(scale, 'scale', { label: 'uniform-scale', min: 0.0001, max: 100, step: 0.01 })
            .on('change', e => {
                transform.targetTransform.scale[0] = e.value;
                transform.targetTransform.scale[1] = e.value;
                transform.targetTransform.scale[2] = e.value;
                container.refresh();
            });

    }

    private processHierarchies() {
        let preventStackOverflowCounter = 0;

        while (preventStackOverflowCounter++ < 100 && this.unprocessedQueue.length !== 0) {
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

        SdiPerformance.log('Added all meshes to the control menu');
    }
}

export default MeshControl;
