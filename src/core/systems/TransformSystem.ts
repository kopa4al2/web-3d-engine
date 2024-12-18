import EntityManager, { EntityId } from "core/EntityManager";
import { UpdateSystem } from "core/systems/EntityComponentSystem";
import { quat } from "gl-matrix";
import { rateLimitedLog } from "../../util/Logger";
import ThrottleUtil from "../../util/ThrottleUtil";
import Transform from "../components/Transform";

export default class TransformSystem implements UpdateSystem {

    random = new WeakMap<EntityId, number>();

    constructor(private entityManager: EntityManager) {
    }

    hasChanged = false;
    update(deltaTime: number): void {
        if (this.hasChanged) {
            return;
        }
        const allTransforms = this.entityManager.getComponentsWithId<Transform>(Transform.ID);

        for (const transform of allTransforms) {
            if (transform.needsCalculate
                && !transform.parent
                && transform.children && transform.children.length > 0) {


                this.hasChanged = true;
                setInterval(() => {
                    console.log('INTERVAL', transform)
                    this.updateRecursive(transform);
                }, 10_000);
            }
        }

        for (const entity of this.entityManager.scenes[0].getEntities()) {
            if (!this.random.has(entity)) {
                this.random.set(entity, Math.random());
            }
            const transformMultiplier = this.random.get(entity)!;
            const transform = this.entityManager.getComponent<Transform>(entity, Transform.ID);

            // if (transform && entity.toString().includes('dragon')  || entity.toString().includes('cube')) {
            if (transform && !entity.toString().includes('terrain')) {
                // transform.rotation[0] += deltaTime * 0.2;  // Rotate by 0.5 radians per second
                // quat.rotateY(transform.rotation, transform.rotation, deltaTime * transformMultiplier);
                // transform.rotation[1] += deltaTime * transformMultiplier;  // Rotate by 0.5 radians per second
                // transform.rotation[1] += deltaTime * transformMultiplier;  // Rotate by 0.5 radians per second
                // transform.rotation[2] += deltaTime * 0.5;  // Rotate by 0.5 radians per second
            }
        }
    }

    counter = 0;
    private updateRecursive(transform: Transform) {
        transform.needsCalculate = false;

        if (transform.parent) {
            transform.transformBy(transform.parent);
        }

        if (transform.children) {
            for (const child of transform.children) {
                this.updateRecursive(child);
                // child.children?.forEach(this.updateRecursive.bind(this));
            }
        }
    }
}
