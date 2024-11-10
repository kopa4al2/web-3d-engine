import Component, { ComponentId } from "core/components/Component";
import Scene from "core/Scene";

export type EntityId = symbol;
// export type EntityId = EntityName;
// export type EntityName = 'DRAGON' | 'TERRAIN' | 'BOX' | 'SPHERE' | 'ARROW' | 'CAMERA' | 'LIGHT_BULB' | 'BUNNY';
export type EntityName = string;

export default class EntityManager {

    public scenes: Scene[] = [];
    private entities: Map<EntityId, Map<ComponentId, Component>> = new Map();
    private components: Map<ComponentId, EntityId[]> = new Map();

    private entityNames: Record<EntityId, EntityName> = {};

    public clear() {
        this.entities.clear();
        this.components.clear();
        this.scenes = [];
    }

    public createEntity(name: EntityName): EntityId {
        const entityId = Symbol(name + '-entity');
        // const entityId = name;
        this.entities.set(entityId, new Map());
        return entityId;
    }

    public addComponents(entityId: EntityId, components: Component[]) {
        for (let i = components.length - 1; i >= 0; i--) {
            this.addComponent(entityId, components[i]);
        }
    }

    public addComponent(entityId: EntityId, component: Component) {
        if (!this.entities.has(entityId)) {
            throw `No entity with id: ${entityId.toString()}. First create the entity`;
        }

        (<Map<ComponentId, Component>>this.entities.get(entityId)).set(component.id, component);

        if (!this.components.has(component.id)) {
            this.components.set(component.id, []);
        }
        (<EntityId[]>this.components.get(component.id)).push(entityId);
    }

    public getEntitiesHavingAll(...componentIds: ComponentId[]): EntityId[] {
        if (!componentIds || componentIds.length === 0) {
            return [];
        }

        const entities: EntityId[] = [];

        for (let [entity, components] of this.entities.entries()) {
            let allComponentPresent = true;
            for (let componentId of componentIds) {
                if (!components.has(componentId)) {
                    allComponentPresent = false;
                }
            }

            if (allComponentPresent) {
                entities.push(entity);
            }
        }

        return entities;
    }

    public getEntitiesWithComponents(...componentIds: ComponentId[]): EntityId[] {
        if (!componentIds || componentIds.length === 0) {
            return [];
        }

        const entities: EntityId[] = [];
        for (let componentId of componentIds) {
            const entity = this.components.get(componentId) || [];
            entities.push(...entity);
        }

        return entities;
    }

    public getAllComponents(...componentIds: ComponentId[]): Component[] {
        return componentIds.reduce((acc: Component[], componentId: ComponentId) => {
            const entities = this.components.get(componentId) || [];
            entities.forEach(entityId => {
                const component = this.getComponent(entityId, componentId);
                if (component) {
                    acc.push(component);
                }
            });
            return acc;
        }, []);
    }
    public getEntityComponents(...componentIds: ComponentId[]): Component[][] {
        if (!componentIds || componentIds.length === 0) {
            return [];
        }

        const components: Component[][] = [];
        for (let i = 0; i < componentIds.length; i++) {
            const componentId = componentIds[i];
            components.push([]);
            const entity = this.components.get(componentId) || [];
            entity.forEach(e => {
                components[i].push(this.getComponent(e, componentId));
            });
        }

        return components;
    }

    getComponents<T1 extends Component, T2 extends Component>(entity: EntityId, ...components: ComponentId[]): [T1, T2]
    getComponents<T1 extends Component, T2 extends Component, T3 extends Component>(entity: EntityId, ...components: ComponentId[]): [T1, T2, T3]
    getComponents<T extends Component>(entity: EntityId, ...components: ComponentId[]): T[] {
        const entityComponents = this.entities.get(entity)!

        // @ts-ignore
        return components
            .filter(component => entityComponents.has(component))
            .map(component => entityComponents.get(component))
    }

    getComponent<T extends Component>(entity: EntityId, component: ComponentId): T {
        return (this.entities.get(entity) as Map<ComponentId, Component>).get(component) as T;
    }

    public removeComponent(entity: EntityId, componentId: ComponentId) {
        this.entities.get(entity)?.delete(componentId);
    }
}