import CameraComponent from "core/components/camera/CameraComponent";
import LightSource from "core/components/camera/LightSource";
import ProjectionMatrix from "core/components/camera/ProjectionMatrix";
import Component from "core/components/Component";
import { EntityId } from "core/EntityManager";
import Camera from "./Camera";
import Mesh from "./components/Mesh";
import Transform from "./components/Transform";

export interface EntityData {
    id: EntityId,
    mesh: Mesh,
    transformation: Transform
}

export default class Scene {
    constructor(public camera: CameraComponent,
                public projectionMatrix: ProjectionMatrix,
                public lightSource: LightSource,
                public entities: EntityId[] = []) {
    }

}

export abstract class AbstractScene {

    constructor(public name: string, protected entities: EntityId[] = [], public activeCamera?: Camera) {
    }

    setActiveCamera(camera: Camera) {
        this.activeCamera = camera;
    }

    public abstract addEntity(entity: EntityId): void;

    public abstract getEntities(): EntityData[];

}