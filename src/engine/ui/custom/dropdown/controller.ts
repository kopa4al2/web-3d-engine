// @ts-nocheck
import {
	Blade, BladeState,
	constrainRange,
	Controller,
	PointerHandler,
	PointerHandlerEvent, Rack, RackController,
	Value,
	ViewProps,
} from '@tweakpane/core';
import { ContainerBladeController } from "@tweakpane/core/src/blade/common/controller/container-blade";
import { ValueMap } from "@tweakpane/core/src/common/model/value-map";
import { DropDownOption } from "engine/ui/custom/dropdown/plugin";
import { PluginView } from "engine/ui/custom/dropdown/view";


interface DropdownProps {
	options: any
}
interface Config {
	blade: Blade;
	// props: ValueMap<>
	// options: DropDownOption
	viewProps: ViewProps;
}

// Controller<PluginView>
// Custom controller class should implement `Controller` interface
export class DropdownController implements ContainerBladeController<PluginView> {
	public readonly value: Value<number>;
	public readonly view: PluginView;
	readonly blade: Blade;
	// public readonly viewProps: ViewProps;

	constructor(doc: Document, config: Config) {
		this.onPoint_ = this.onPoint_.bind(this);

		// Receive the bound value from the plugin
		this.value = config.value;

		// and also view props
		this.viewProps = config.viewProps;
		this.viewProps.handleDispose(() => {
			// Called when the controller is disposing
			console.log('TODO: dispose controller');
		});

		// Create a custom view
		this.view = new PluginView(doc, {
			value: this.value,
			viewProps: this.viewProps,
		});

		// You can use `PointerHandler` to handle pointer events in the same way as Tweakpane do
		const ptHandler = new PointerHandler(this.view.element);
		ptHandler.emitter.on('down', this.onPoint_);
		ptHandler.emitter.on('move', this.onPoint_);
		ptHandler.emitter.on('up', this.onPoint_);
	}

	private onPoint_(ev: PointerHandlerEvent) {
		const data = ev.data;
		if (!data.point) {
			return;
		}

		// Update the value by user input
		const dx =
			constrainRange(data.point.x / data.bounds.width + 0.05, 0, 1) * 10;
		const dy = data.point.y / 10;
		this.value.rawValue = Math.floor(dy) * 10 + dx;
	}


	exportState(): BladeState {
		return undefined;
	}

	importState(state: BladeState): boolean {
		return false;
	}

	get parent(): Rack | null {
		return undefined;
	}

	private parent_: Rack | null;
	readonly rackController: RackController;
	readonly viewProps: ViewProps;
}
