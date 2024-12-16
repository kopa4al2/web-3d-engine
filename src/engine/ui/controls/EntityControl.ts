import UILayout from '../UILayout';
import EntityManager, { EntityId, EntityName } from 'core/EntityManager';
import Component, { ComponentId } from 'core/components/Component';
import { ContainerApi } from '@tweakpane/core';
import Transform from 'core/components/Transform';
import Mesh from 'core/components/Mesh';
import TransformControl from './TransformControl';
import DebugUtil from '../../../util/DebugUtil';
import { PBRMaterialProperties } from 'core/mesh/material/MaterialProperties';
import PointLight from 'core/light/PointLight';
import { LightControl } from './LightControl';
import DirectionalLight from 'core/light/DirectionalLight';

interface EntityComponent {
    components: Component[];
    pane: ContainerApi
}

export default class EntityControl extends EntityManager {

    private parentPane;
    private _entities: WeakMap<EntityId, EntityComponent> = new WeakMap();

    constructor(private entityManager: EntityManager, layout: UILayout) {
        super();
        this.parentPane = layout.addFolder('Entities');
        // this.parentPane = layout.newPane('Entities');
        DebugUtil.addToWindowObject('entityControl', this);
    }

    hasAnyComponent(entityId: EntityId, ...components: ComponentId[]): boolean {
        return this.entityManager.hasAnyComponent(entityId, ...components);
    }

    getEntitiesHavingAll(...componentIds: ComponentId[]): EntityId[] {
        return this.entityManager.getEntitiesHavingAll(...componentIds);
    }
    
    getComponentsWithId<T extends Component>(componentId: ComponentId): T[] {
        return this.entityManager.getComponentsWithId(componentId);
    }

    getComponents<T extends Component[]>(entity: EntityId, ...components: { [K in keyof T]: ComponentId }): T {
        return this.entityManager.getComponents(entity, ...components) as T;
    }

    getComponent<T extends Component>(entity: EntityId, component: ComponentId): T {
        return this.entityManager.getComponent(entity, component);
    }

    createEntity(name: EntityName): EntityId {
        const entityId = this.entityManager.createEntity(name);
        this.registerEntity(name, entityId);

        return entityId;
    }
    
    addComponents(entityId: EntityId, components: Component[]) {
        this.entityManager.addComponents(entityId, components);
        this._addComponents(entityId, ...components);
    }

    addComponent(entityId: EntityId, component: Component) {
        this.entityManager.addComponent(entityId, component);
        this._addComponents(entityId, component);
    }

    private registerEntity(title: string, entity: EntityId) {
        if (this._entities.has(entity)) {
            console.warn(`Entity ${entity.description} already registered`);
            return;
        }

        const pane = this.parentPane.addFolder({ title, expanded: false });
        this._entities.set(entity, { components: [], pane });
    }

    private _addComponents(entityId: EntityId, ...componentsToAdd: Component[]) {
        if (!this._entities.has(entityId)) {
            console.warn(`Entity ${entityId.description} does not exist`);
            return;
        }

        const { pane, components } = this._entities.get(entityId)!;

        for (const component of componentsToAdd) {
            components.push(component);
            switch (component.id) {
                case Transform.ID:
                    this._addTransformControl(pane, component as Transform);
                    break;
                case Mesh.ID:
                    this._addMeshControl(pane, component as Mesh);
                    break;
                case PointLight.ID:
                    LightControl.addPointLight(pane, component as PointLight);
                    break;
                case DirectionalLight.ID:
                    LightControl.addDirectionalLight(pane, component as DirectionalLight);
                    break;
                default: {
                    console.warn(`Entity ${entityId.description} has component: ${component.id.description} that cannot be processed`, components.pop());
                }
            }
        }
    }

    private _addMeshControl(pane: ContainerApi, mesh: Mesh) {
        if (!(mesh.material.properties instanceof PBRMaterialProperties)) {
            console.warn(`Material: ${mesh.material.label} will be skipped`, mesh.material);
            return;
        }
        const folder = pane.addFolder({ title: 'Mesh' });
        console.log(mesh.material)
        const pbrMat = mesh.material.properties as PBRMaterialProperties;
        const color = { r: pbrMat.baseColorFactor[0], g: pbrMat.baseColorFactor[1], b: pbrMat.baseColorFactor[2], a: pbrMat.baseColorFactor[3] };
        folder.addBinding({ color }, 'color', { label: 'color', color: { type: 'float' }, picker: 'inline' });
    }

    private _addTransformControl(pane: ContainerApi, transform: Transform) {
        TransformControl.create(pane, transform);
    }
}
