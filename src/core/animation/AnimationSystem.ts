import AnimationComponent, { AnimationKeyframe, AnimationProperty } from 'core/animation/AnimationComponent';
import Transform from 'core/components/Transform';
import EntityManager from 'core/EntityManager';
import { UpdateSystem } from 'core/systems/EntityComponentSystem';
import { mat4, quat, vec3 } from 'gl-matrix';
import { rateLimitedLog } from 'utils/Logger';
import ThrottleUtil from 'utils/ThrottleUtil';

export default class AnimationSystem implements UpdateSystem {

  constructor(private entityManager: EntityManager) {
  }

  update(deltaTime: number): void {
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

      for (const track of animation.tracks) {
        const targetEntity = track.targetEntity;
        const transform = this.entityManager.getComponent(targetEntity, Transform.ID) as Transform;

        const keyframes = track.keyframes;
        const currentTime = animationComponent.time;

        // // Find the two keyframes surrounding the current time
        // let prevKeyframe: AnimationKeyframe | null = null;
        // let nextKeyframe: AnimationKeyframe | null = null;
        //
        // for (let i = 0; i < keyframes.length - 1; i++) {
        //   if (currentTime >= keyframes[i].time && currentTime <= keyframes[i + 1].time) {
        //     prevKeyframe = keyframes[i];
        //     nextKeyframe = keyframes[i + 1];
        //     break;
        //   }
        // }

        const [prevKeyframe, nextKeyframe] = this.findKeyframes(keyframes, currentTime);

        if (prevKeyframe && nextKeyframe) {
          const t = Math.min(1, Math.max(0, (currentTime - prevKeyframe.time) / (nextKeyframe.time - prevKeyframe.time)));
          // const t = (currentTime - prevKeyframe.time) / (nextKeyframe.time - prevKeyframe.time);
          let interpolatedValue;

          if (track.property === AnimationProperty.translation || track.property === AnimationProperty.scale) {
            interpolatedValue = vec3.clone(track.property === AnimationProperty.scale ? transform.localTransform.scale : transform.localTransform.translation);
            // interpolatedValue = vec3.create();
            vec3.lerp(
              interpolatedValue,
              prevKeyframe.value as vec3,
              nextKeyframe.value as vec3,
              t
            );
          } else if (track.property === AnimationProperty.rotation) {
            interpolatedValue = quat.clone(transform.localTransform.rotation);
            // interpolatedValue = quat.create();
            quat.slerp(
              interpolatedValue,
              prevKeyframe.value as quat,
              nextKeyframe.value as quat,
              t
            );
          }

          // Apply the interpolated value to the target entity
          if (track.property === AnimationProperty.translation) {
            vec3.copy(transform.localTransform.translation, interpolatedValue as vec3);
          } else if (track.property === AnimationProperty.rotation) {
            quat.copy(transform.localTransform.rotation, interpolatedValue as quat);
          } else if (track.property === AnimationProperty.scale) {
            vec3.copy(transform.localTransform.scale, interpolatedValue as vec3);
          }

          transform.needsCalculate = true;
        }
      }
    }
  }

  findKeyframes(keyframes: AnimationKeyframe[], currentTime: number): [AnimationKeyframe, AnimationKeyframe] {
    let left = 0;
    let right = keyframes.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (keyframes[mid].time === currentTime) {
        return [keyframes[mid], keyframes[mid]];
      } else if (keyframes[mid].time < currentTime) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return [
      keyframes[Math.max(0, right)],
      keyframes[Math.min(keyframes.length - 1, left)],
    ];
  }
}