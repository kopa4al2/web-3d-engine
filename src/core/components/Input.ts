import { InputState } from "core/systems/InputSystem";
import { vec2, vec3 } from "gl-matrix";
import Component from "./Component";

class Input implements Component {
    static readonly ID: symbol = Symbol('Input');
    readonly id = Input.ID;

    inputState: InputState;

    constructor(mousePos = vec2.create(),
                wheel = vec3.create(),
                inputFlags = {}) {
        this.inputState = {
            mousePos,
            mouseDelta: vec2.create(),
            deltaWheel: vec3.create(),
            wheel,
            inputFlags
        };
    }
}

export default Input