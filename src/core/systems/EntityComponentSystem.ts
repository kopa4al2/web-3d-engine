import Scene from "core/Scene";

export interface System {
    update?(deltaTime: number): void;

    render?(): void;
}

export interface RenderSystem extends System {
    render(): void;
}

export interface UpdateSystem extends System {
    update(deltaTime: number): void;
}

export default class EntityComponentSystem {
    private updateSystems: UpdateSystem[] = [];
    private renderSystems: RenderSystem[] = [];
    public scenes: Scene[] = [];

    registerSystems(...systems: System[]): void {
        for (const system of systems) {
            this.registerUpdateSystem(system);
            this.registerRenderSystem(system);
        }
    }

    registerRenderSystem(system: System) {
        this.renderSystems.push(system as RenderSystem);
    }

    registerRenderSystems(...systems: System[]) {
        systems.forEach(system => this.registerRenderSystem(system));
    }

    registerUpdateSystem(system: System) {
        this.updateSystems.push(system as UpdateSystem);
    }

    registerUpdateSystems(...systems: System[]) {
        systems.forEach(system => this.registerUpdateSystem(system));
    }

    update(deltaTime: number): void {
        for (let system of this.updateSystems) {
            system.update(deltaTime);
        }
    }

    render(): void {
        for (let system of this.renderSystems) {
            system.render();
        }
    }

    clear() {
        this.renderSystems = [];
        this.updateSystems = [];
        this.scenes = [];
    }
}
