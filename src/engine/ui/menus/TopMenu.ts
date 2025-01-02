import Mesh from "core/components/Mesh";
import EntityTweakPane from "engine/ui/controls/EntityTweakPane";
import MaterialTweakPane from "engine/ui/controls/MaterialTweakPane";
import EntityManager from 'core/EntityManager';
import SpotLight from 'core/light/SpotLight';
import DirectionalLight from 'core/light/DirectionalLight';
import PointLight from 'core/light/PointLight';
import Transform from 'core/components/Transform';
import { LightControl } from 'engine/ui/controls/LightControl';
import MeshTweakPane from "engine/ui/controls/MeshTweakPane";
import RightMenu from 'engine/ui/menus/RightMenu';
import TransformWidget from "engine/ui/widgets/TransformWidget";

export class TopMenu {
    private container: HTMLElement;
    private dataTargets: Record<string, () => void> = {
        allEntities: this.allEntities.bind(this),
        materials: this.materials.bind(this),
        lights: this.showLights.bind(this),
    }
    
    private controls;
    constructor(private materialControl: MaterialTweakPane,
                private entityControl: EntityTweakPane,
                private entityManager: EntityManager,
                private rightMenu: RightMenu) {
        this.container = document.querySelector('.top-menu')!;
        this.container.addEventListener('click', this.handleClick.bind(this));
        this.controls = {
            Lights: new LightControl(this.rightMenu),
            Meshes: new MeshTweakPane(this.rightMenu)
        }
    }

    private handleClick(e: MouseEvent) {
        const clickedItem = (e.target as HTMLElement).closest('.body-item');
        if (!clickedItem) {
            return;
        }

        const targetFunction = this.dataTargets[(clickedItem as HTMLElement).dataset.target!]
        if (!targetFunction) {
            console.error('Unknown target: ', (clickedItem as HTMLElement).dataset);
            return;
        }

        targetFunction();
    }

    private allEntities() {
        console.log('All entities');
        for (const [entity, components] of this.entityManager._entities.entries()) {
            if (components.has(Mesh.ID) && components.has(Transform.ID)) {
                this.controls.Meshes.addMesh(entity.description!,
                    components.get(Mesh.ID) as Mesh,
                    components.get(Transform.ID) as Transform);

            }
        }
    }

    private showLights() {
        for (const [entity, components] of this.entityManager._entities.entries()) {
            if (components.has(DirectionalLight.ID)) {
                this.addDirectionalLight(
                    entity.description!, 
                    components.get(DirectionalLight.ID) as DirectionalLight);
            } else if (components.has(PointLight.ID) && components.has(Transform.ID)) {
                this.addPointLight(
                    entity.description!,
                    components.get(PointLight.ID) as PointLight,
                    components.get(Transform.ID) as Transform);
            } else if (components.has(SpotLight.ID) && components.has(Transform.ID)) {
                this.addSpotLight(
                    entity.description!,
                    components.get(SpotLight.ID) as SpotLight,
                    components.get(Transform.ID) as Transform
                );
            }
        }

        this.rightMenu.setActive('LIGHTS');
    }

    private materials() {
        this.materialControl.showMaterials();
    }

    private addDirectionalLight(name: string, light: DirectionalLight) {
        this.controls.Lights.addDirectionalLight(name, light);
    }

    private addSpotLight(name: string, spotLight: SpotLight, transform: Transform) {
        this.controls.Lights.addSpotlight(name, spotLight, transform);
    }

    private addPointLight(name: string, pointLight: PointLight, transform: Transform) {
        this.controls.Lights.addPointLight(name, pointLight, transform);
    }
}
