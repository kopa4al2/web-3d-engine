import CameraComponent from "core/components/camera/CameraComponent";
import LightSource from "core/components/camera/LightSource";
import ProjectionMatrix from "core/components/camera/ProjectionMatrix";
import { EntityId } from "core/EntityManager";

export default class Scene {
    constructor(public camera: CameraComponent,
                public projectionMatrix: ProjectionMatrix,
                public lightSource: LightSource,
                public entities: EntityId[] = []) {
    }

}