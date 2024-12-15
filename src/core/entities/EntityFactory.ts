import Mesh from 'core/components/Mesh';
import Transform from 'core/components/Transform';
import EntityManager, { EntityId, EntityName } from 'core/EntityManager';
import Component from "core/components/Component";

export default class EntityFactory {

    constructor(private entityManager: EntityManager) {
    }

    public createEntityInstance(label: EntityName, template: Mesh, transform: Transform): EntityId {
        const entity = this.entityManager.createEntity(label);
        this.entityManager.addComponents(entity, [template, transform]);

        return entity;
    }

    public createEntity(label: EntityName, ...components: Component[]): EntityId {
        const entity = this.entityManager.createEntity(label);
        this.entityManager.addComponents(entity, components);

        return entity;
    }

}
