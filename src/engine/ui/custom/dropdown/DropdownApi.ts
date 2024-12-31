// @ts-nocheck
import { Bindable, BindingApi, BindingParams, BladeApi, ButtonApi, ButtonParams } from "@tweakpane/core";
import { BaseBladeParams } from "@tweakpane/core/dist/common/params";
import { ContainerApi } from "@tweakpane/core/src/blade/common/api/container";
import { ContainerBladeApi } from "@tweakpane/core/src/blade/common/api/container-blade";
import { EventListenable } from "@tweakpane/core/src/blade/common/api/event-listenable";
import { FolderApiEvents } from "@tweakpane/core/src/blade/folder/api/folder";
import { FolderController } from "@tweakpane/core/src/blade/folder/controller/folder";
import { DropdownController } from "engine/ui/custom/dropdown/controller";

export default class DropdownApi extends ContainerBladeApi<DropdownController> implements ContainerApi {
    readonly children: BladeApi[];

    add(api: BladeApi, opt_index?: number): void {
    }

    addBinding<O extends Bindable, Key extends keyof O>(object: O, key: Key, opt_params?: BindingParams): BindingApi<unknown, O[Key]> {
        return undefined;
    }

    addBlade(params: BaseBladeParams): BladeApi {
        return undefined;
    }

    addButton(params: ButtonParams): ButtonApi {
        return undefined;
    }

    addFolder(params: FolderParams): FolderApi {
        return undefined;
    }

    addTab(params: TabParams): TabApi {
        return undefined;
    }

    remove(api: BladeApi): void {
    }

}