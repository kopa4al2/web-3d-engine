import EntityTweakPane from "engine/ui/controls/EntityTweakPane";
import MaterialTweakPane from "engine/ui/controls/MaterialTweakPane";

export class TopMenu {
    private container: HTMLElement;
    private dataTargets: Record<string, () => void> = {
        allEntities: this.allEntities.bind(this),
        materials: this.materials.bind(this),
    }

    constructor(private materialControl: MaterialTweakPane, private entityControl: EntityTweakPane) {
        this.container = document.querySelector('.top-menu')!;
        this.container.addEventListener('click', e => {
            const clickedItem = (e.target as HTMLElement).closest('.body-item');
            if (!clickedItem) {
                return;
            }

            const targetFunction = this.dataTargets[(clickedItem as HTMLElement).dataset.target!]
            if (!targetFunction){
                console.error('Unknown target: ', (clickedItem as HTMLElement).dataset);
                return;
            }

            targetFunction();
        });
    }

    private allEntities() {
        this.entityControl.processAll();
    }

    private materials() {
        this.materialControl.showMaterials();
    }
}
