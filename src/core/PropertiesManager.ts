import { InputFlags, InputState, InputType } from "core/systems/InputSystem";
import JavaMap from "util/JavaMap";
import log from "util/Logger";
import ObjectUtils from "util/ObjectUtils";

export type PartialProperties = { [key in Property | AbsoluteProperty]?: PropertyValue };
export type PartialNestedProperty = { [key in SubProperty]?: PropertyValue };

export default class PropertiesManager {

    // private readonly listeners: Record<Property | AbsoluteProperty, OnPropertyChangeListener[]>;
    private readonly listenersMap: JavaMap<Property | AbsoluteProperty, OnPropertyChangeListener[]>;
    private readonly buffer: JavaMap<Property | AbsoluteProperty, PropertyValue | PartialNestedProperty>;

    constructor(private readonly properties: Record<Property, PropertyValue>, overrides?: PartialProperties, public name: string = 'noop') {
        this.listenersMap = new JavaMap();
        this.buffer = new JavaMap();

        for (const propName in overrides) {
            if (propName.includes('.')) {
                const [outerProp, innerProp] = propName.split('.') as [ObjectProperty, SubProperty];
                // @ts-ignore
                this.properties[outerProp][innerProp] = overrides[propName];
            }
            this.properties[propName as Property] = overrides[propName as Property] as PropertyValue;
        }
    }

    /**
     * Flush the properties buffer and notify all listeners.
     */
    flushBuffer() {
        if (this.buffer.size === 0) {
            return;
        }

        const toNotifyMap: Set<OnPropertyChangeListener> = new Set();
        for (let [prop, value] of this.buffer) {
            if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
                if (prop.includes('.')) {
                    const [outerProp, innerProp] = prop.split('.') as [ObjectProperty, SubProperty];
                    (<NestedProperty>this.properties[outerProp])[innerProp] = value;
                    for (let [key, listeners] of this.listenersMap) {
                        if (key.startsWith(outerProp + '.')) {
                            listeners.forEach(l => toNotifyMap.add((l)));
                        }
                    }
                }
                this.listenersMap.getOrDefault(prop, []).forEach(listener => toNotifyMap.add(listener));
                this.properties[prop as PrimitiveProperty] = value;
            } else {
                Object.assign(this.properties[prop as ObjectProperty], value);
                for (let [key, listeners] of this.listenersMap) {
                    if (this.shouldNotify(key as Property, prop, value as PartialNestedProperty)) {
                        listeners.forEach(listener => toNotifyMap.add((listener)));
                    }
                }
            }
        }

        this.buffer.clear();

        for (let listener of toNotifyMap) {
            listener(this);
        }
    }

    subscribeToPropertyChange(property: (Property | AbsoluteProperty), onChange: OnPropertyChangeListener) {
        this.listenersMap.merge(property, [onChange], (oldV) => {
            oldV.push(onChange);
            return oldV;
        });
        // this.listeners[property].push(onChange);
    }

    subscribeToAnyPropertyChange(properties: (Property | AbsoluteProperty)[], onChange: OnPropertyChangeListener) {
        properties.forEach(p => this.listenersMap.merge(p, [onChange], (oldV) => {
            oldV.push(onChange);
            return oldV;
        }));
        // properties.forEach(p => this.listeners[p].push(onChange));
    }

    updateProperty(property: Property, value: PropertyValue) {
        this.buffer.set(property, value);
    }

    updatePropertyFn(property: Property, updateFn: (current: PropertyValue) => PropertyValue) {
        this.buffer.set(property, updateFn(this.properties.fieldOfView));
    }

    updateNestedProperty(propertyName: ObjectProperty | AbsoluteProperty,
                         value: PartialNestedProperty) {
        this.buffer.merge(propertyName, value, (oldV, newV) => Object.assign(oldV, newV));
    }

    updateExplicitNestedProperty(propertyName: ObjectProperty,
                                 subPropertyName: SubProperty,
                                 value: PropertyValue) {
        const current = this.buffer.getOrDefault(propertyName,
            ObjectUtils.cloneObject(this.properties[propertyName])) as NestedProperty;
        current[subPropertyName] = value;
        this.buffer.set(propertyName, current);
    }

    getNested<T extends PropertyValue>(propertyName: ObjectProperty, subPropertyName: SubProperty): T {
        return (<NestedProperty>this.properties[propertyName])[subPropertyName] as T;
    }

    getAbsolute<T extends PropertyValue>(propertyName: AbsoluteProperty): T {
        const [outerProp, innerProp] = propertyName.split('.') as [ObjectProperty, SubProperty];
        return (<NestedProperty>this.properties[outerProp])[innerProp] as T;
    }

    get<T extends PropertyValue>(property: PrimitiveProperty | AbsoluteProperty): T {
        const [outerProp, innerProp] = property.split('.') as [ObjectProperty, SubProperty];
        if (outerProp && innerProp) {
            return <T>(<NestedProperty>this.properties[outerProp])[innerProp];
        }

        return <T>this.properties[property as Property];
    }

    getNum(property: Property): number {
        return <number>this.properties[property];
    }

    getString(property: Property) {
        return <string>this.properties[property];
    }

    getBoolean(property: Property) {
        return <boolean>this.properties[property];
    }

    getT<T extends PropertyValue>(property: Property): T {
        return <T>this.properties[property];
    }


    private shouldNotify(listener: Property | AbsoluteProperty,
                         bufferProperty: Property | AbsoluteProperty,
                         value: PartialNestedProperty): boolean {
        if (listener === bufferProperty) {
            return true;
        }

        if (!listener.startsWith(`${bufferProperty}.`)) {
            return false;
        }

        const [_, innerProp] = listener.split('.') as [ObjectProperty, SubProperty];
        return value[innerProp] !== undefined;
    }
}

export type OnPropertyChangeListener = (propManager: PropertiesManager) => void;

// Possible base property types
export type Property =
    PrimitiveProperty |
    ObjectProperty;

type ObjectProperty = 'window' | 'light' | 'input'
type PrimitiveProperty = 'fieldOfView' |
    'zNear' |
    'zFar' |
    'gpuApi' |
    'splitScreen' |
    'wireframe';

// Property names of the nested objects
type SubProperty = WindowProperty | LightProperty | InputProperty;
type WindowProperty =
    'width' | 'height' | 'leftOffset' | 'topOffset' | 'hide';
type LightProperty =
    'sourceX' | 'sourceY' | 'sourceZ';
type InputProperty = `deltaWheel` | 'mouseDelta' | 'mousePos' | 'inputFlags' | InputType
type AbsoluteProperty = `${ObjectProperty}.${SubProperty}`;

type OptionalRecord = { [key in SubProperty]?: PropertyValue };

export interface NestedProperty extends OptionalRecord {
}

export interface WindowProperties extends NestedProperty, Record<WindowProperty, PropertyValue> {
    width: number,
    height: number,
    leftOffset: number,
    topOffset: number,
    hide: boolean,
}

export interface LightProperties extends NestedProperty, Record<LightProperty, PropertyValue> {
    sourceX: number,
    sourceY: number,
    sourceZ: number,
}

export type PropertyValue = PrimitivePropertyValue | PropertyValueObject;
type PrimitivePropertyValue = string | number | boolean;
type PropertyValueObject = WindowProperties | LightProperties | InputState;