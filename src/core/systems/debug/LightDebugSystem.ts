import GeometryComponent from "core/components/geometry/GeometryComponent";
import EntityManager from "core/EntityManager";
import { RenderSystem } from "core/systems/EntityComponentSystem";
import { vec3 } from "gl-matrix";

export default class LightDebugSystem implements RenderSystem {


    constructor(private entityManager: EntityManager) {
    }

    render(): void {
        this.entityManager.getEntitiesWithComponents()
    }

    private renderLightRays(lightDirection: vec3, objectPosition: vec3) {
        let rayStart = objectPosition;  // Start at the object or terrain point
        let rayEnd = vec3.create();
        vec3.scaleAndAdd(rayEnd, rayStart, lightDirection, 5.0);  // Scale to make the ray visible
        return rayEnd
    }

    private renderLightGizmo(lightDirection: vec3) {
        let gizmoPosition = vec3.create();  // Choose a position to render the gizmo (e.g., above the scene)

        // Draw an arrow or cone representing the light direction
        let lightEnd = vec3.create();
        vec3.scaleAndAdd(lightEnd, gizmoPosition, lightDirection, 10.0);  // Scale to show direction

        // renderArrow(gizmoPosition, lightEnd);  // Function to draw a 3D arrow
    }
}