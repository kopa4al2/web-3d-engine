import { BladeApi, ContainerApi, FolderApi } from '@tweakpane/core';
import Component, { ComponentId } from 'core/components/Component';
import Mesh from 'core/components/Mesh';
import Transform from 'core/components/Transform';
import EntityManager, { EntityId, EntityName } from 'core/EntityManager';
import DirectionalLight from 'core/light/DirectionalLight';
import PointLight from 'core/light/PointLight';
import SpotLight from "core/light/SpotLight";
import { PBRMaterialProperties } from 'core/mesh/material/MaterialProperties';
import DebugUtil from '../../../util/DebugUtil';
import UILayout from '../UILayout';
import { checkEvery } from "../utils";
import { LightControl } from './LightControl';
import TransformControl from './TransformControl';

interface EntityComponent {
    components: Component[],
    pane: ContainerApi,
    name: EntityName,
}

type Folder = 'LIGHT' | 'ENTITY' | 'POINT_LIGHT' | 'DIRECTIONAL_LIGHT' | 'SPOT_LIGHT' | 'TRANSFORMS'
export default class EntityControl extends EntityManager {

    private readonly rootFolder: FolderApi;
    private _entities: WeakMap<EntityId, EntityComponent> = new WeakMap();
    private readonly folders: Map<Folder, ContainerApi> = new Map();

    constructor(private entityManager: EntityManager, layout: UILayout) {
        super();
        this.rootFolder = layout.addFolder('Entities', false);
        const lightsPane = layout.addFolder('Lights', false);
        this.folders.set('LIGHT', lightsPane);
        this.folders.set('DIRECTIONAL_LIGHT', lightsPane.addFolder({ title: 'Directional lights', expanded: true }));
        this.folders.set('POINT_LIGHT', lightsPane.addFolder({ title: 'Point lights', expanded: true }));
        this.folders.set('SPOT_LIGHT', lightsPane.addFolder({ title: 'Spot lights', expanded: true }));
        this.folders.set('ENTITY', this.rootFolder);
        this.folders.set('TRANSFORMS', this.rootFolder);
        // this.rootFolder = layout.newPane('Entities');
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
            console.warn(`Entity ${ entity.description } already registered`);
            return;
        }

        // const pane = this.rootFolder.addFolder({ title, expanded: false });
        // this._entities.set(entity, { components: [], pane });
        const pane = this.rootFolder.addFolder({ title, expanded: false });
        this._entities.set(entity, { components: [], name: title, pane });
    }

    private _addComponents(entityId: EntityId, ...componentsToAdd: Component[]) {
        const entityComponent = this._entities.get(entityId);
        if (!entityComponent) {
            console.warn(`Entity ${ entityId.description } does not exist`);
            return;
        }

        const { name, components, pane } = entityComponent;

        for (const component of componentsToAdd) {
            components.push(component);
            switch (component.id) {
                case Transform.ID:
                    const transformComponent = component as Transform;
                    if (transformComponent.parent) {
                        this._addTransformControl(pane, transformComponent);
                    }
                    break;
                case Mesh.ID:
                    checkEvery(() => {
                        const transform = components.find(c => c.id === Transform.ID) as Transform;
                        if (transform) {
                            TransformControl.create(pane, transform);
                            return true;
                        }
                        return false;
                    });
                    this._addMeshControl(pane, component as Mesh);
                    break;
                case PointLight.ID:
                    checkEvery(() => {
                        const transform = components.find(c => c.id === Transform.ID) as Transform;
                        if (transform) {
                            TransformControl.createTranslate(pane, transform);
                            return true;
                        }
                        return false;
                    });

                    const container = this.folders.get('POINT_LIGHT')!;
                    this.swapContainers(pane, this.rootFolder, container);
                    LightControl.addPointLight(pane, component as PointLight);
                    break;
                case DirectionalLight.ID:
                    const dirLightContainer = this.folders.get('DIRECTIONAL_LIGHT')!;
                    this.swapContainers(pane, this.rootFolder, dirLightContainer);
                    LightControl.addDirectionalLight(pane, component as DirectionalLight);
                    break;
                case SpotLight.ID:
                    checkEvery(() => {
                        const transform = components.find(c => c.id === Transform.ID) as Transform;
                        if (transform) {
                            TransformControl.create(pane, transform);
                            return true;
                        }
                        return false;
                    });
                    const spotLightContainer = this.folders.get('SPOT_LIGHT')!;
                    this.swapContainers(pane, this.rootFolder, spotLightContainer);
                    LightControl.addSpotLight(pane, component as SpotLight);
                    break;
                default: {
                    // @ts-ignore
                    // this.rootFolder.remove(pane)
                    console.warn(`Entity ${ entityId.description } has component: ${ component.id.description } that cannot be processed`, components.pop());
                }
            }
        }
    }

    private swapContainers(container: ContainerApi, oldParent: ContainerApi, newParent: ContainerApi) {
        // @ts-ignore
        oldParent.remove(container);
        // @ts-ignore
        newParent.add(container);
        // setTimeout(() => newParent.add(container), 100);
    }

    private _addMeshControl(pane: ContainerApi, mesh: Mesh) {
        if (!(mesh.material.properties instanceof PBRMaterialProperties)) {
            console.warn(`Material: ${ mesh.material.label } will be skipped`, mesh.material);
            return;
        }

        const folder = pane.addFolder({ title: 'material', expanded: false });
        // const folder = pane.addFolder({ title: mesh.material.label, expanded: false });
        const pbrMat = mesh.material.properties as PBRMaterialProperties;
        const color = {
            r: pbrMat.baseColorFactor[0],
            g: pbrMat.baseColorFactor[1],
            b: pbrMat.baseColorFactor[2],
            a: pbrMat.baseColorFactor[3]
        };

        folder.addBinding({ color }, 'color', { label: 'baseColor', color: { type: 'float' }, picker: 'inline' })
            // folder.addBinding(wrapArrayAsColor(pbrMat.baseColorFactor), 'color', { label: 'baseColor', color: { type: 'float' }, picker: 'inline' })
            .on('change', (e) => {
                mesh.material.update<PBRMaterialProperties>(props => {
                    props.baseColorFactor[0] = e.value.r;
                    props.baseColorFactor[1] = e.value.g;
                    props.baseColorFactor[2] = e.value.b;
                    props.baseColorFactor[3] = e.value.a;
                })
            });
    }

    private _addTransformToParent(pane: ContainerApi, transform: Transform) {
        const entities = this.getEntitiesHavingAll(Transform.ID);
        const parent = entities.find(e => this.getComponent(e, Transform.ID) === transform.parent);
        if (!parent) {
            console.error('Transform without parent in the pool: ', transform)
            throw new Error('Transform should have parent');
        }

        const transformParentPane = this._entities.get(parent)!.pane;
        this.swapContainers(pane, this.rootFolder, transformParentPane);

        TransformControl.create(pane, transform);
    }

    private _addTransformControl(pane: ContainerApi, transform: Transform) {
        if (transform.parent) {
            const entities = this.getEntitiesHavingAll(Transform.ID);
            const parent = entities.find(e => this.getComponent(e, Transform.ID) === transform.parent);
            if (!parent) {
                console.error('Transform without parent in the pool: ', transform)
                throw new Error('Transform should have parent');
            }

            const transformParentPane = this._entities.get(parent)!.pane;
            this.swapContainers(pane, this.rootFolder, transformParentPane);
        }


        TransformControl.create(pane, transform);
    }
}
