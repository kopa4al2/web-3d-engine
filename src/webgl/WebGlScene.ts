import { AbstractScene, EntityData } from "../core/Scene";

export interface WebGlEntity extends EntityData {
    vbo: WebGLBuffer,
    vao: WebGLVertexArrayObject,
    texture: WebGLTexture,
}

let entityData: WebGlEntity | null = null;
export default // @ts-ignore
class WebGlScene extends AbstractScene {
/*
    private currentEntities: WebGlEntity[] = [];


    constructor(private glContext: GLContext, private ecs: System, name: string, entities: EntityId[] = []) {
        super(name, entities);
        entities.forEach(this.addEntity);
    }

    public addEntity(entity: EntityId): void {
        const mesh = <Mesh>this.ecs.getComponent(entity, Mesh.ID);
        if (!mesh) {
            throw `Entity: ${entity} cannot be added to the scene as it does not have a mesh component`;
        }

        const texture = this.glContext.createTexture(mesh.material.texture.imageBitmap);
        const vbo = this.glContext.createVBO(mesh.geometry.vertices);
        const vao = this.glContext.createVAOText(vbo);

        this.currentEntities.push({
            mesh: <Mesh>this.ecs.getComponent(entity, Mesh.ID),
            transformation: <Transform>this.ecs.getComponent(entity, Transform.ID),
            vao: vao,
            vbo: vbo,
            id: entity,
            texture
        });
    }

    public getEntities(): EntityData[] {
        return this.currentEntities;
    }*/
}