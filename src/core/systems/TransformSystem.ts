import EntityManager from "core/EntityManager";
import { UpdateSystem } from "core/systems/EntityComponentSystem";
import Transform from "../components/Transform";

export default class TransformSystem implements UpdateSystem {

    constructor(private entityManager: EntityManager) {
    }

    update(deltaTime: number): void {
        // const entities = this.entityManager.getEntitiesWithComponents(Transform.ID);

        for (const entity of this.entityManager.scenes[0].getEntities()) {
            const transform = this.entityManager.getComponent<Transform>(entity, Transform.ID);

            // if (transform && entity.toString().includes('dragon')  || entity.toString().includes('cube')) {
            if (transform && !entity.toString().includes('terrain')) {
                // transform.rotation[0] += deltaTime * 0.2;  // Rotate by 0.5 radians per second
                // transform.rotation[1] += deltaTime * 0.1;  // Rotate by 0.5 radians per second
                // transform.rotation[2] += deltaTime * 0.5;  // Rotate by 0.5 radians per second
            }
        }
    }

}
