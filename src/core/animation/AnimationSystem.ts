import AnimationComponent from "core/animation/AnimationComponent";
import Transform from "core/components/Transform";
import EntityManager from "core/EntityManager";
import { UpdateSystem } from "core/systems/EntityComponentSystem";
import { quat, vec3 } from "gl-matrix";

export default class AnimationSystem implements UpdateSystem {

    constructor(private entityManager: EntityManager) {
    }

    update(deltaTime: number): void {

        // const entities = this.entityManager.getEntitiesHavingAll(Transform.ID, AnimationComponent.ID);
        // for (const entity of entities) {
        //     const [transform, animationComponent] = this.entityManager.getComponents<[Transform, AnimationComponent]>(entity, Transform.ID, AnimationComponent.ID);
        // }
        const animations = this.entityManager.getComponentsWithId<AnimationComponent>(AnimationComponent.ID);
        for (const animationComponent of animations) {
            const animation = animationComponent.animations[animationComponent.currentAnimation];

            // Update animation time
            animationComponent.time += deltaTime * animationComponent.speed;
            if (animationComponent.time >= animation.duration) {
                if (animationComponent.loop) {
                    animationComponent.time %= animation.duration;
                } else {
                    animationComponent.time = animation.duration;
                    continue;
                }
            }

            /*            for (const track of animation.tracks) {
                            const targetEntity = track.targetEntity;
                            const transform = this.entityManager.getComponent<TransformComponent>(targetEntity, 'Transform');

                            const keyframes = track.keyframes;
                            const currentTime = animationComponent.time;

                            // Find the two keyframes surrounding the current time
                            let prevKeyframe: Keyframe | null = null;
                            let nextKeyframe: Keyframe | null = null;

                            for (let i = 0; i < keyframes.length - 1; i++) {
                                if (currentTime >= keyframes[i].time && currentTime <= keyframes[i + 1].time) {
                                    prevKeyframe = keyframes[i];
                                    nextKeyframe = keyframes[i + 1];
                                    break;
                                }
                            }

                            // Interpolate between keyframes
                            if (prevKeyframe && nextKeyframe) {
                                const t = (currentTime - prevKeyframe.time) / (nextKeyframe.time - prevKeyframe.time);
                                let interpolatedValue;

                                if (track.property === 'translation' || track.property === 'scale') {
                                    interpolatedValue = vec3.create();
                                    vec3.lerp(
                                        interpolatedValue,
                                        prevKeyframe.value as vec3,
                                        nextKeyframe.value as vec3,
                                        t
                                    );
                                } else if (track.property === 'rotation') {
                                    interpolatedValue = quat.create();
                                    quat.slerp(
                                        interpolatedValue,
                                        prevKeyframe.value as quat,
                                        nextKeyframe.value as quat,
                                        t
                                    );
                                }

                                // Apply the interpolated value to the target entity
                                if (track.property === 'translation') {
                                    vec3.copy(transform.translation, interpolatedValue as vec3);
                                } else if (track.property === 'rotation') {
                                    quat.copy(transform.rotation, interpolatedValue as quat);
                                } else if (track.property === 'scale') {
                                    vec3.copy(transform.scale, interpolatedValue as vec3);
                                }
                            }
                  */
        }
    }

}