import EntityManager from "core/EntityManager";
import PropertiesManager, { WindowProperties } from "core/PropertiesManager";
import { UpdateSystem } from "core/systems/EntityComponentSystem";
import { vec2, vec3 } from 'gl-matrix';
import Input from "../../core/components/Input";


export type InputFlags = { [key in InputType]: boolean }

export interface InputState {
    inputFlags: InputFlags;
    mousePos: vec2;
    mouseDelta: vec2;
    wheel: vec3;
    deltaWheel: vec3;
}

export default class InputSystem implements UpdateSystem {

    private inputBuffer: InputState;

    constructor(private entityManager: EntityManager,
                private properties: PropertiesManager,
                private parentComponent: HTMLElement | Window = window) {
        parentComponent.addEventListener('keydown', e => this.onKeyDown((e as KeyboardEvent).key));
        parentComponent.addEventListener('keyup', e => this.onKeyUp((e as KeyboardEvent).key));
        parentComponent.addEventListener('mousedown', e => this.onMouseDown())
        parentComponent.addEventListener('mouseup', e => this.onMouseUp())
        // @ts-ignore
        parentComponent.addEventListener('mousemove', e => this.onMouseMove(e.clientX, e.clientY));
        // @ts-ignore
        window.addEventListener('wheel', e => this.onWheel(e.deltaX, e.deltaY, e.deltaZ));

        this.inputBuffer = {
            mousePos: vec2.create(),
            mouseDelta: vec2.create(),
            deltaWheel: vec3.create(),
            wheel: vec3.create(),
            inputFlags: {}
        };
    }

    update(deltaTime: number): void {
        this.entityManager.scenes.forEach(scene => {
            scene.getEntities().forEach(entity => {
                const inputComponent = <Input>this.entityManager.getComponent(entity, Input.ID);

                if (inputComponent) {
                    // const mouseDeltaX = this.inputBuffer.mousePos[0] - inputComponent.inputState.mousePos[0];
                    // const mouseDeltaY = this.inputBuffer.mousePos[1] - inputComponent.inputState.mousePos[1];
                    vec2.subtract(inputComponent.inputState.mouseDelta,
                        this.inputBuffer.mousePos,
                        inputComponent.inputState.mousePos);

                    vec3.subtract(inputComponent.inputState.deltaWheel,
                        this.inputBuffer.wheel as vec3,
                        inputComponent.inputState.wheel as vec3);

                    Object.assign(inputComponent.inputState.inputFlags, this.inputBuffer.inputFlags)
                    vec2.copy(inputComponent.inputState.mousePos, this.inputBuffer.mousePos)
                    // vec3.copy(inputComponent.inputState.deltaWheel, this.inputBuffer.deltaWheel)
                    // vec2.copy(inputComponent.inputState.mouseDelta, [mouseDeltaX, mouseDeltaY]);
                }
            })
        });
    }

    private onKeyDown(key: InputType) {
        this.inputBuffer.inputFlags[key.toLowerCase()] = true;
        if (key === '`') {
            (this.parentComponent as HTMLCanvasElement).requestPointerLock();
        }
    }

    private onKeyUp(key: string) {
        this.inputBuffer.inputFlags[key.toLowerCase()] = false;
        // this.inputBuffer.inputFlags[InputType[key as keyof typeof InputType]] = false;
    }

    private onMouseMove(clientX: number, clientY: number) {
        const { leftOffset, topOffset, width, height } = this.properties.getT<WindowProperties>('window');
        const x = clientX - leftOffset;
        const y = clientY - topOffset;

        // const ndcX = (x / width) * 2 - 1;  // Convert to [-1, 1] range
        // const ndcY = 1 - (y / height) * 2; // Convert to [-1, 1] range (Y is flipped)
        // const ndcY = (1 - event.clientY / canvas.height) * 2 - 1 // Convert to [-1, 1] range (Y is flipped)
        // this.inputBuffer.mousePos[0] = ndcX;
        // this.inputBuffer.mousePos[1] = ndcY;

        this.inputBuffer.mousePos[0] = x;
        this.inputBuffer.mousePos[1] = y;
    }

    private onMouseDown() {
        this.inputBuffer.inputFlags['MouseDown'] = true;
        // this.inputBuffer.inputFlags[InputType['MouseDown']] = true;
    }

    private onMouseUp() {
        this.inputBuffer.inputFlags['MouseDown'] = false;
        // this.inputBuffer.inputFlags[InputType['MouseDown']] = false;
    }

    private onWheel(deltaX: number, deltaY: number, deltaZ: number) {
        console.log(`DeltaX: ${deltaX / 100} DeltaY: ${deltaY / 100} DeltaZ: ${deltaZ / 100}`);
        vec3.copy(this.inputBuffer.wheel as vec3, [deltaX / 100, deltaY / 100, deltaZ / 100]);
        // @ts-ignore
        // this.properties.updateNestedProperty(`input.mouseDelta`, this.inputBuffer.deltaWheel)
    }

}

export type InputType = 'ArrowUp' | 'W' | 'ArrowDown' | 'S' | string

/*export enum InputType {
    'ArrowUp' = 'ArrowUp',
    'ArrowDown' = 'ArrowDown',
    'ArrowLeft' = 'ArrowLeft',
    'ArrowRight' = 'ArrowRight',
    'Shift' = 'Shift',
    'Control' = 'Control',
    'MouseDown' = 'MouseDown',
    'W' = 'W',
    'w' = 'w',
    'A' = 'A',
    'a' = 'a',
    'S' = 'S',
    's' = 's',
    'D' = 'D',
    'd' = 'd',
}*/
