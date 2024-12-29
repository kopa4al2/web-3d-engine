import Component, { ComponentId } from "core/components/Component";
import Scene from "core/Scene";

export type EntityId = symbol;
export type EntityName = string;

export default class EntityManager {

    public scenes: Scene[] = [];
    private entities: Map<EntityId, Map<ComponentId, Component>> = new Map();
    private components: Map<ComponentId, EntityId[]> = new Map();

    public createEntity(name: EntityName): EntityId {
        const entityId = Symbol(name + '-entity');
        this.entities.set(entityId, new Map());
        return entityId;
    }

    public addComponents(entityId: EntityId, components: Component[]) {
        for (let i = components.length - 1; i >= 0; i--) {
            this.addComponent(entityId, components[i]);
        }
    }

    private addComponent(entityId: EntityId, component: Component) {
        if (!this.entities.has(entityId)) {
            throw `No entity with id: ${entityId.toString()}. First create the entity`;
        }

        (<Map<ComponentId, Component>>this.entities.get(entityId)).set(component.id, component);

        if (!this.components.has(component.id)) {
            this.components.set(component.id, []);
        }
        (<EntityId[]>this.components.get(component.id)).push(entityId);
    }

    public hasAnyComponent(entityId: EntityId, ...components: ComponentId[]): boolean {
        const entityComponents = this.entities.get(entityId)!;
        for (const component of components) {
            if (entityComponents.has(component)) {
                return true;
            }
        }
        return false;
    }

    public getEntitiesHavingAll(...componentIds: ComponentId[]): EntityId[] {
        if (!componentIds || componentIds.length === 0) {
            return [];
        }

        const entities: EntityId[] = [];

        for (const [entity, components] of this.entities.entries()) {
            let allComponentPresent = true;
            for (const componentId of componentIds) {
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

    public getComponentsWithId<T extends Component>(componentId: ComponentId): T[] {
        return (this.components.get(componentId) || [])
            .map((entity) => {
                return this.entities.get(entity)!.get(componentId) as T
            })
    }

    public getComponents<T extends Component[]>(entity: EntityId, ...components: { [K in keyof T]: ComponentId }): T {
        const entityComponents = this.entities.get(entity)!;

        return components
            .map(component => entityComponents.get(component)) as T;
    }

    public getComponent<T extends Component>(entity: EntityId, component: ComponentId): T {
        return (this.entities.get(entity) as Map<ComponentId, Component>).get(component) as T;
    }

    public getAllComponentsOfEntity(entity: EntityId): Component[] {
        if (!this.entities.has(entity)) {
            throw new Error(`No entity with id: ${entity.description}`);
        }
        return [...this.entities.get(entity)!.values()];
    }
}


//getComponents<T1 extends Component, T2 extends Component, T3 extends Component>(entity: EntityId, components: [ComponentId, ComponentId, ComponentId]): [T1, T2, T3]
//     getComponents<T1 extends Component, T2 extends Component>(entity: EntityId, components: [ComponentId, ComponentId]): [T1, T2]
//     getComponents<T extends Component>(entity: EntityId, components: [ComponentId]): [T]
//     getComponents<T extends Component>(entity: EntityId, ...components: ComponentId[]): T[] {
//     // getComponents<T extends Component>(entity: EntityId, components: [ComponentId, ComponentId?, ComponentId?, ComponentId?]): T[] {
//         const entityComponents = this.entities.get(entity)!;
// 
//         // @ts-ignore
//         return components
//             .map(component => entityComponents.get(component))
//     }
