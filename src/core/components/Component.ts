export type ComponentId = symbol;
export default interface Component {
    readonly id: ComponentId;

    getAsBuffer?():DataView;
}