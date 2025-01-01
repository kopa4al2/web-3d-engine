import { ContainerApi, FolderApi } from '@tweakpane/core';
import Component, { ComponentId } from 'core/components/Component';
import Mesh from 'core/components/Mesh';
import Transform from 'core/components/Transform';
import EntityManager, { EntityId, EntityName } from 'core/EntityManager';
import DirectionalLight from 'core/light/DirectionalLight';
import PointLight from 'core/light/PointLight';
import spotLight from "core/light/SpotLight";
import SpotLight from "core/light/SpotLight";
import { TabPageApi } from "tweakpane";
import UILayout from '../UILayout';
import { LightControl } from './LightControl';
import MeshTweakPane from './MeshTweakPane';

interface EntityComponent {
    pane?: ContainerApi,
    name: EntityName,
    isProcessed?: boolean,
}

type Folder = 'LIGHT' | 'ENTITY' | 'POINT_LIGHTS' | 'DIRECTIONAL_LIGHTS' | 'SPOT_LIGHTS' | 'TRANSFORMS' | 'MESHES'
export default class EntityTweakPane extends EntityManager {

    private rootTab?: TabPageApi;
    private readonly _entities: WeakMap<EntityId, EntityComponent> = new WeakMap();

    private readonly folders: Map<Folder, FolderApi> = new Map();
    // private readonly meshControl: MeshTweakPane;

    private readonly processQueue: Set<EntityId> = new Set();

    constructor(private entityManager: EntityManager, private layout: UILayout) {
        super();
        // @ts-ignore
        this.entities = entityManager.entities;
    }

    processAll() {
        if (!this.rootTab) {
            this.rootTab = this.layout.createTab('ENTITIES');
        }

        this.layout.setActive('ENTITIES');
        for (const [entity, components] of this.entities.entries()) {
            for (const component of components) {
                if (components.has(DirectionalLight.ID)) {
                    this.addDirectionalLight(components.get(DirectionalLight.ID) as DirectionalLight);
                } else if (components.has(PointLight.ID) && components.has(Transform.ID)) {
                    this.addPointLight(
                        components.get(PointLight.ID) as PointLight,
                        components.get(Transform.ID) as Transform);
                } else if (components.has(SpotLight.ID) && components.has(Transform.ID)) {
                    this.addSpotLight(
                        components.get(SpotLight.ID) as SpotLight,
                        components.get(Transform.ID) as Transform
                    );
                } else if (components.has(Mesh.ID) && components.has(Transform.ID)) {
                    if (!this.folders.has('MESHES')) {
                        this.folders.set('MESHES', this.layout.addFolder(entity.description!))
                    }

                    console.log(this.folders)
                    MeshTweakPane.addMeshV2(
                        this.folders.get('MESHES')!,
                        components.get(Mesh.ID) as Mesh,
                        components.get(Transform.ID) as Transform);
                }
            }
        }
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
        return this.entityManager.createEntity(name);
    }

    addComponents(entityId: EntityId, components: Component[]) {
        this.entityManager.addComponents(entityId, components);
    }

    private addDirectionalLight(component: DirectionalLight) {
        if (!this.folders.has('DIRECTIONAL_LIGHTS')) {
            this.folders.set('DIRECTIONAL_LIGHTS', this.layout.addFolder('Directional Lights'));
        }

        LightControl.addDirectionalLight(this.folders.get('DIRECTIONAL_LIGHTS')!, component);
    }

    private addPointLight(pointLight: PointLight, transform: Transform) {
        if (!this.folders.has('POINT_LIGHTS')) {
            this.folders.set('POINT_LIGHTS', this.layout.addFolder('Point Lights'));
        }

        LightControl.addPointLightV2(this.folders.get('POINT_LIGHTS')!, pointLight, transform);
    }

    private addSpotLight(spotLight: SpotLight, transform: Transform) {
        if (!this.folders.has('SPOT_LIGHTS')) {
            this.folders.set('SPOT_LIGHTS', this.layout.addFolder('Spot Lights'));
        }

        LightControl.addSpotLightV2(this.folders.get('SPOT_LIGHTS')!, spotLight, transform);
    }
}