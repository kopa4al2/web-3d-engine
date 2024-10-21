import { AbstractScene } from "../core/Scene";

export default // @ts-ignore
class WebGPUScene extends AbstractScene {

    /* currentEntities: EntityData[] = [];

     constructor(private ecs: System, name: string, entities: EntityId[] = []) {
         super(name, entities);
         entities.forEach(this.addEntity);
     }

     public addEntity(entity: EntityId): void {
         const mesh = <Mesh>this.ecs.getComponent(entity, Mesh.ID);
         if (!mesh) {
             throw `Entity: ${entity} cannot be added to the scene as it does not have a mesh component`;
         }

         this.currentEntities.push({
             mesh: <Mesh>this.ecs.getComponent(entity, Mesh.ID),
             transformation: <Transform>this.ecs.getComponent(entity, Transform.ID),
             id: entity
         });
     }

     public getEntities(): EntityData[] {
         return this.currentEntities;
     }*/

}