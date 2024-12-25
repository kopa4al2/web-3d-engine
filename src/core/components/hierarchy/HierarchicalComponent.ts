import Component from 'core/components/Component';
import { EntityId } from "core/EntityManager";

export default class HierarchicalComponent implements Component {

    static readonly ID: symbol = Symbol('Hierarchy');
    readonly id: symbol = HierarchicalComponent.ID;

    constructor(public parent?: EntityId,
                public children: EntityId[] = []) {
    }

    removeParent() {
        this.parent = undefined;
    }

    hasParent() {
        return this.parent !== undefined;
    }

    addChild(entity: EntityId) {
        this.children.push(entity);
    }
}