import UILayout from '../UILayout';
import Mesh from 'core/components/Mesh';
import TransformControl from './TransformControl';

export default class MeshControl {

    private meshContainer;

    constructor(private layout: UILayout) {
        this.meshContainer = layout.newPane('Meshes');
    }

    registerMesh(title: string, mesh: Mesh) {
        // const proxy = new Proxy(mesh.transform)
        this.meshContainer.addBlade({ view: 'separator' });
        this.meshContainer.addBlade({ view: 'text', label: 'Mesh', parse: (v: any) => v.toString(), value: title });
        this.meshContainer.addBlade({ view: 'separator' });
        // const folder = this.meshContainer.addFolder({ title: 'transform' });
        TransformControl.create(this.meshContainer, mesh.modelMatrix);
    }
}
