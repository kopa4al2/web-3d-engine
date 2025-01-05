import EntityManager, { EntityId } from 'core/EntityManager';
import { UpdateSystem } from 'core/systems/EntityComponentSystem';
import { mat4, quat, vec3 } from 'gl-matrix';
import { rateLimitedLog } from '../../utils/Logger';
import ThrottleUtil from '../../utils/ThrottleUtil';
import Transform from '../components/Transform';
import DebugUtil from 'utils/debug/DebugUtil';

export default class TransformSystem implements UpdateSystem {

  random = new WeakMap<EntityId, number>();
  isSet = false;

  constructor(private entityManager: EntityManager) {
    DebugUtil.addToWindowObject('transformSystem', this);
  }

  update(deltaTime: number): void {
    const multiplier = 8;
    const allTransforms = this.entityManager.getComponentsWithId<Transform>(Transform.ID);

    // for (const transform of allTransforms) {
    //   if (transform.shouldMove()) {
    //     // console.log('LERPING TRANSFORM', transform.label);
    //     // console.log('pos equals', vec3.equals(transform.localTransform.position, transform.targetTransform.position));
    //     // console.log('rot equals', quat.equals(transform.localTransform.rotation, transform.targetTransform.rotation));
    //     // console.log('scale equals', vec3.equals(transform.localTransform.scale, transform.targetTransform.scale));
    //     vec3.lerp(transform.localTransform.position, transform.localTransform.position, transform.targetTransform.position, multiplier * deltaTime);
    //     quat.slerp(transform.localTransform.rotation, transform.localTransform.rotation, transform.targetTransform.rotation, multiplier * deltaTime);
    //     vec3.lerp(transform.localTransform.scale, transform.localTransform.scale, transform.targetTransform.scale, multiplier * deltaTime);
    //     transform.needsCalculate = true;
    //   }
    // }

    for (const transform of allTransforms) {
      if (transform.needsCalculate) {
        this.updateMatrices(transform);
        // let toUpdate = transform;
        // let i = 0;
        // while (toUpdate.parent && toUpdate.parent.needsCalculate) {
        //   // while (toUpdate.parent) {
        //   toUpdate = toUpdate.parent!;
        //   if (i++ > 200) {
        //     console.error('INFINITE WHILE LOOP', toUpdate);
        //     return;
        //   }
        // }
        //
        // this.updateMatrices(toUpdate);
      }
    }

  }

  private updateMatrices(transform: Transform) {
    transform.needsCalculate = false;

    if (!transform.parent) {
      transform.copy(transform.worldTransform, transform.localTransform);
    } else {
      transform.multiply(transform.worldTransform, transform.parent.worldTransform, transform.localTransform);
    }

    for (const child of transform.children) {
      this.updateMatrices(child);
    }
  }

  // transform.worldTransform = transform.localTransform;

  // private updateMatricesBreadthFirst(transforms: Transform[], visited = new Set<Transform>()) {
  //   if (transforms.length === 0) {
  //     return;
  //   }
  //
  //   // Process all nodes at the current level
  //   for (const node of transforms) {
  //     if (!visited.has(node)) {
  //       visited.add(node);
  //       this.multiplyTransform(node);
  //     }
  //   }
  //
  //   // Collect unvisited neighbors for the next level
  //   const nextLevel: Transform[] = [];
  //   for (const node of transforms) {
  //     for (const neighbor of node.children) {
  //       if (!visited.has(neighbor)) {
  //         nextLevel.push(neighbor);
  //       }
  //     }
  //   }
  //
  //   // Recur with the next level
  //   this.updateMatricesBreadthFirst(nextLevel, visited);
  // }
  //
  // private multiplyTransform(transform: Transform) {
  //   transform.needsCalculate = false;
  //   mat4.fromRotationTranslationScale(transform.localTransform.mat4,
  //     transform.localTransform.rotation,
  //     transform.localTransform.translation,
  //     transform.localTransform.scale);
  //
  //   if (!transform.parent) {
  //     transform.copy(transform.worldTransform, transform.localTransform);
  //     // transform.worldTransform = transform.localTransform;
  //     // transform.worldTransform.mat4 = transform.localTransform.mat4;
  //   } else {
  //     transform.multiply(transform.worldTransform, transform.parent.worldTransform.mat4, transform.localTransform.mat4);
  //
  //   }
  // }

  _printHierarchies() {
    const transforms = this.entityManager.getComponentsWithId<Transform>(Transform.ID)
      .filter(t => t.parent === undefined);


    for (const transform of transforms) {
      console.log(`Root: ${transform.label}`);
      this._printTransform(transform);
    }
  }

  _printTransform(transform: Transform) {
    console.log(transform.label, ' -> [' + transform.children.map(c => c.label).join(', ') + ']');
    console.log(JSON.stringify(transform.worldTransform));

    transform.children.forEach(this._printTransform.bind(this));
  }
}
