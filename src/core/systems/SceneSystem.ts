import EntityManager from 'core/EntityManager';
import { UpdateSystem } from 'core/systems/EntityComponentSystem';

/**
 * TODO: This may be 'WorldSystem'. Manages when entities need to be added or removed from the scene.
 */
export default class SceneSystem implements UpdateSystem {

    constructor(private entityManager: EntityManager, /* ONLY FOR TESTING */ private entityBuffer?: string[]) {
    }

    update(deltaTime: number): void {
        const activeScene = this.entityManager.scenes[0];
        if (this.entityBuffer && this.entityBuffer.length) {
            // TODO: Add to scene
            // activeScene.entities.push(EntityRepository.geometry('GEOMETRY', new SphereGeometry(),
            //     new LightedMaterial({
            //         shaderName: ShaderName.BASIC_WITH_LIGHT,
            //         textures: [
            //             TextureLoader.textures['texture']
            //             // Texture.OPAQUE_TEXTURE
            //         ],
            //         diffuse: vec3.fromValues(0.1, 1.0, 1.0)
            //     }),
            //     defaultTransform()
            //         .translate(vec3.fromValues(5.0, 6.0, 3))))
        }

        // If last frame scene has changed, this frame clear the changed status
        // if (activeScene.flags.hasFlag(Scene.CHANGED)) {
        //     activeScene.flags.clearFlag(Scene.CHANGED);
        // }
    }


}
