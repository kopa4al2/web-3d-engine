import {
    Blade,
    BladeController,
    createPlugin,
    TpPlugin,
    TpPluginBundle,
    Value,
    View,
    ViewProps
} from '@tweakpane/core';

// Define the view for the label
class LabelView implements View {
    public readonly element: HTMLElement;
    // @ts-ignore
    public readonly buttonElement: HTMLButtonElement;

    constructor(doc: Document, config: Config) {
        // Create view elements
        this.element = doc.createElement('div');
        this.element.classList.add('tp-sdi-label');

        // // Apply value changes to the preview element
        // const previewElem = doc.createElement('div');
        // const value = config.value;
        // // value.emitter.on('change', () => {
        // //     previewElem.textContent = String(value.rawValue);
        // // });
        // console.log('value')
        // console.log(config)
        // previewElem.textContent = String(config.value);
        // this.element.appendChild(previewElem);
        //
        // // Create a button element for user interaction
        // const buttonElem = doc.createElement('button');
        // buttonElem.textContent = '+';
        // this.element.appendChild(buttonElem);
        // this.buttonElement = buttonElem;
    }
}

interface Config {
    blade: Blade;
    value: Value<string>;
    viewProps: ViewProps;
}
class LabelController extends BladeController {
    constructor(doc: Document, config: Config) {
        super({
            blade: config.blade,
            view: new LabelView(doc, config),
            viewProps: ViewProps.create(),
        });
    }
}

const SdiLabelPlugin: TpPlugin = createPlugin({
    id: 'sdi-label',
    type: 'blade',
    accept: (value: unknown, params: Record<string, unknown>) => {
        // @ts-ignore
        console.log(value.view)
        // @ts-ignore
        if (!value || value?.view !== 'sdi-label') {
            return null;
        }
        
        return {
            initialValue: value,
            params: params,
        };
    },
    api: (args: any) => {
        return null;
    },
    controller(args: any) {
        return new LabelController(args.document, {
            blade: args.blade,
            value: args.value,
            viewProps: args.viewProps
        });
    },
});

// Define the plugin
export const SdiPluginBundle: TpPluginBundle = {
    // Identifier of the plugin bundle
    id: 'counter',
    // Plugins that should be registered
    plugins: [
        SdiLabelPlugin,
    ],
    // Additional CSS for this bundle
    css: `
    .tp-counter {align-items: center; display: flex;}
    .tp-counter div {color: #00ffd680; flex: 1;}
    .tp-counter button {background-color: #00ffd6c0; border-radius: 2px; color: black; height: 20px; width: 20px;}
  `,
};
