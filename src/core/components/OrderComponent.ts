import Component from "core/components/Component";

export default class OrderComponent implements Component {
    static readonly ID: symbol = Symbol('OrderComponent');

    readonly id = OrderComponent.ID;
    
    constructor(public order: number) {}
}
