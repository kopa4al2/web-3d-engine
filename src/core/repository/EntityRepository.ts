import Component from 'core/components/Component';
import EntityManager, { EntityId, EntityName } from 'core/EntityManager';
import { vec3 } from 'gl-matrix';

class EntityRepository {

    createEntity(name: EntityName, entityManager: EntityManager, ...components: Component[]): EntityId {
        const entity = entityManager.createEntity(name);
        components.forEach(component => entityManager.addComponent(entity, component));


        return entity;
    }
}
export default new EntityRepository();