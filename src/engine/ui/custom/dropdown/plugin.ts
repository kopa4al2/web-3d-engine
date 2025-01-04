// @ts-nocheck
import { BladePlugin, createPlugin, parseRecord, } from '@tweakpane/core';
import { BaseBladeParams } from "@tweakpane/core/dist/common/params";
import { DropdownController } from "engine/ui/custom/dropdown/controller";
import DropdownApi from "engine/ui/custom/dropdown/DropdownApi";



export interface DropDownOption {
    text: string
}

export interface PluginInputParams extends BaseBladeParams {
    view: 'dropdown';
    dropdownOptions: DropDownOption[]
}

// NOTE: JSDoc comments of `InputBindingPlugin` can be useful to know details about each property
//
// `InputBindingPlugin<In, Ex, P>` means...
// - The plugin receives the bound value as `Ex`,
// - converts `Ex` into `In` and holds it
// - P is the type of the parsed parameters
//
export const DropdownPlugin: BladePlugin<PluginInputParams> = createPlugin({
    id: 'input-template',

    // type: The plugin type.
    // - 'input': Input binding
    // - 'monitor': Monitor binding
    // - 'blade': Blade without binding
    type: 'blade',

    accept(params: Record<string, unknown>) {
        // Parse parameters object
        const result = parseRecord<PluginInputParams>(params, (p) => ({
            // `view` option may be useful to provide a custom control for primitive values
            view: p.required.constant('dropdown'),
            dropdownOptions: p.optional.array(p.required.object({ text: p.required.string }))
        }));

		return result ? {params: result} : null;
    },
    controller(args) {
        // Create a controller for the plugin
        return new DropdownController(args.document, {
            blade: args.blade,
            viewProps: args.viewProps,
        });
    },
    api(args) {
        if (!(args.controller instanceof DropdownController)) {
            return null;
        }
        // @ts-ignore
        return new DropdownApi(args.controller, args.pool);
    },
});
