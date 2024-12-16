import UILayout from '../UILayout';
import Mesh from 'core/components/Mesh';
import TransformControl from './TransformControl';
import mesh from 'core/components/Mesh';
import Material from 'core/mesh/material/Material';

export default class MaterialControl {

    private readonly materialPane;

    constructor(layout: UILayout) {
        this.materialPane = layout.addFolder('Material');
    }

    addMaterial(material: Material) {
        this.materialPane.addBlade({ view: 'separator' });
        this.materialPane.addBlade({ view: 'text', label: 'Material', parse: (v: any) => v.toString(), value: material.label });
        this.materialPane.addBlade({ view: 'separator' });
    }
}
