import { InputState } from "core/systems/InputSystem";
import { vec2, vec3 } from "gl-matrix";
import Component from "./Component";

export default class Input implements Component {
    static readonly ID: symbol = Symbol('Input');
    readonly id = Input.ID;

    inputState: InputState;

    constructor() {
        this.inputState = {
            mousePos: vec2.create(),
            mouseDelta: vec2.create(),
            deltaWheel: vec3.create(),
            wheel: vec3.create(),
            inputFlags: {}
        };
    }
}
