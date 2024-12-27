import { BladeApi, ContainerApi, FolderApi } from '@tweakpane/core';
import Component, { ComponentId } from 'core/components/Component';
import Mesh from 'core/components/Mesh';
import Transform from 'core/components/Transform';
import EntityManager, { EntityId, EntityName } from 'core/EntityManager';
import DirectionalLight from 'core/light/DirectionalLight';
import PointLight from 'core/light/PointLight';
import SpotLight from "core/light/SpotLight";
import { PBRMaterialProperties } from 'core/mesh/material/MaterialProperties';
import DebugUtil from '../../../util/debug/DebugUtil';
import ThrottleUtil from "../../../util/ThrottleUtil";
import UILayout from '../UILayout';
import { checkEvery } from "../utils";
import { LightControl } from './LightControl';
import TransformControl from './TransformControl';
import MeshControl from './MeshControl';

interface EntityComponent {
    components: Component[],
    pane?: ContainerApi,
    name: EntityName,
    isProcessed?: boolean,
    category: 'DIR_LIGHT' | 'SPOT_LIGHT' | 'POINT_LIGHT' | 'UNCATEGORIZED'
}

type Folder = 'LIGHT' | 'ENTITY' | 'POINT_LIGHTS' | 'DIRECTIONAL_LIGHTS' | 'SPOT_LIGHTS' | 'TRANSFORMS' | 'MESHES'
export default class EntityControl extends EntityManager {

    private readonly tempFolder: FolderApi;
    private readonly _entities: WeakMap<EntityId, EntityComponent> = new WeakMap();
    private readonly _entitiesQueue = new Map<EntityId, EntityComponent>;
    private readonly folders: Map<Folder, FolderApi> = new Map();
    private readonly meshControl: MeshControl;

    constructor(private entityManager: EntityManager, layout: UILayout) {
        super();
        this.tempFolder = layout.addFolder('Entities', false, true, false);

        const lightsTab = layout.getTopLevelContainer('LIGHTS');
        this.folders.set('DIRECTIONAL_LIGHTS', lightsTab.addFolder({
            title: 'Directional lights',
            expanded: true,
            hidden: true
        }));
        this.folders.set('SPOT_LIGHTS', lightsTab.addFolder({
            title: 'Spot lights',
            expanded: true,
            hidden: true
        }));
        this.folders.set('POINT_LIGHTS', lightsTab.addFolder({
            title: 'Point lights',
            expanded: false,
            hidden: true
        }));

        const entitiesTab = layout.getTopLevelContainer('ENTITIES');
        const meshesFolder = entitiesTab.addFolder({ title: 'Meshes', expanded: true, hidden: true });
        this.folders.set('MESHES', meshesFolder);
        this.meshControl = new MeshControl(meshesFolder);

        DebugUtil.addToWindowObject('entityControl', this);
        // this._componentAdded = ThrottleUtil.debounce(this._componentAdded.bind(this), 300);
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
        this._registerEntity(name, entityId);

        return entityId;
    }

    addComponents(entityId: EntityId, components: Component[]) {
        this.entityManager.addComponents(entityId, components);

        // for (const component of components) {
        //     const entityComponent = this._entities.get(entityId)!;
        //     entityComponent.components.push(component);
        //     entityComponent.isProcessed = false;
        // }

        this._componentAdded(entityId, components);
    }

    // addComponent(entityId: EntityId, component: Component) {
    //     this.entityManager.addComponent(entityId, component);
    //     this._addComponents(entityId, component);
    // }

    private _registerEntity(title: string, entity: EntityId) {
        if (this._entities.has(entity)) {
            console.warn(`Entity ${entity.description} already registered`);
            return;
        }

        const pane = this.tempFolder.addFolder({ title, expanded: false });
        // this._entities.push({ components: [], name: title, pane, category: 'UNCATEGORIZED' });
        this._entities.set(entity, { components: [], name: title, pane, category: 'UNCATEGORIZED' });
    }

    private _componentAdded(entityId: EntityId, componentsOld: Component[]) {
        const entityComponent = this._entities.get(entityId)!;
        if (entityComponent.isProcessed) {
            // console.warn(`Entity Added: ${entityId.description} is processed`);
            // console.warn(`TODO: Probably you are adding a component to an existing entity which is fine, but the controls do not support it. The new component will not be available in the menu`);
            return;
        }

        const { pane, name, components } = entityComponent;
        this.entityManager.getComponents(entityId);
        entityComponent.isProcessed = true;
        let hasTransformComponent: Transform | undefined;
        for (const component of components) {
            if (component.id === DirectionalLight.ID) {
                const dirLightTab = this.folders.get('DIRECTIONAL_LIGHTS')!;
                const folder = UILayout.moveFolder(dirLightTab, pane as FolderApi);
                dirLightTab.hidden = false;
                LightControl.addDirectionalLight(folder, component as DirectionalLight);
                return;
            } else if (component.id === SpotLight.ID) {
                const spotLightTab = this.folders.get('SPOT_LIGHTS')!;
                const folder = UILayout.moveFolder(spotLightTab, pane as FolderApi);
                spotLightTab.hidden = false;
                LightControl.addSpotLightV2(folder, components);
                return;
            } else if (component.id === PointLight.ID) {
                const pointLightTab = this.folders.get('POINT_LIGHTS')!;
                const folder = UILayout.moveFolder(pointLightTab, pane as FolderApi);
                pointLightTab.hidden = false;
                LightControl.addPointLightV2(folder, components);
                return;
            } else if (component.id === Mesh.ID) {
                const meshesTab = this.folders.get('MESHES')!;
                meshesTab.hidden = false;

                this.meshControl.addMesh(pane as FolderApi, components);
                return;
            } else if (component.id === Transform.ID) {
                hasTransformComponent = component as Transform;
            }
        }

        if (hasTransformComponent) {
            this.meshControl.addLonelyTransform(pane as FolderApi, hasTransformComponent, name)
        }

        entityComponent.isProcessed = false;
    }
}
