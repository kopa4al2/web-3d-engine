import Component from "core/components/Component";

export default class Renderable implements Component {
    public static readonly ID = Symbol('Renderable');
    id = Renderable.ID;

    // public accept(globals) {
    // }
}