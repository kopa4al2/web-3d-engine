import EntityManager, { EntityId } from "core/EntityManager";
import { UpdateSystem } from "core/systems/EntityComponentSystem";
import { mat4, quat, vec3 } from "gl-matrix";
import { rateLimitedLog } from "../../util/Logger";
import ThrottleUtil from "../../util/ThrottleUtil";
import Transform from "../components/Transform";

export default class TransformSystem implements UpdateSystem {

    random = new WeakMap<EntityId, number>();
    isSet = false;

    constructor(private entityManager: EntityManager) {
    }

    update(deltaTime: number): void {
        const allTransforms = this.entityManager.getComponentsWithId<Transform>(Transform.ID);

        for (const transform of allTransforms) {
            if (transform.shouldMove()) {
                vec3.lerp(transform.localTransform.position, transform.localTransform.position, transform.targetTransform.position, 10 * deltaTime);
                quat.slerp(transform.localTransform.rotation, transform.localTransform.rotation, transform.targetTransform.rotation, 10 * deltaTime);
                vec3.lerp(transform.localTransform.scale, transform.localTransform.scale, transform.targetTransform.scale, 10 * deltaTime);
                // this.updateMatrices(transform);
                transform.needsCalculate = true;
            }
        }
        
        for (const transform of allTransforms) {
            if (transform.needsCalculate) {
                let toUpdate = transform;
                let i = 0;
                while (toUpdate.parent && toUpdate.parent.needsCalculate) {
                    if (i++ > 100) {
                        console.error('INFINITE WHILE LOOP');
                        return;
                    }

                    toUpdate = transform.parent!;
                }

                this.updateMatrices(toUpdate);
            }
        }
    }

    private updateMatrices(transform: Transform) {
        transform.needsCalculate = false;
        mat4.fromRotationTranslationScale(transform.localTransform.mat4,
            transform.localTransform.rotation,
            transform.localTransform.position,
            transform.localTransform.scale);

        if (!transform.parent) {
            transform.copy(transform.worldTransform, transform.localTransform);
            // transform.worldTransform = transform.localTransform;
            // transform.worldTransform.mat4 = transform.localTransform.mat4;
        } else {
            transform.multiply(transform.worldTransform, transform.parent.worldTransform, transform.localTransform)
        }

        for (const child of transform.children) {
            this.updateMatrices(child);
        }
    }
}
