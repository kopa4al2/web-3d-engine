import { EntitySelectPayload } from 'html/entity-select/EntitySelect';

type ComponentEventMap = CustomEvents & HTMLElementEventMap;
export default interface CustomEvents {
    'add-entity': CustomEvent<EntitySelectPayload>
}


export function addEventListener<K extends keyof ComponentEventMap>(
    element: HTMLElement,
    type: K,
    listener: (event: ComponentEventMap[K]) => void
) {
    element.addEventListener(type, listener as EventListener);
}
