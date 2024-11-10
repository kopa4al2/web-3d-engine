import CameraComponent from 'core/components/camera/CameraComponent';
import ProjectionMatrix from "core/components/camera/ProjectionMatrix";
import Input from "core/components/Input";
import PropertiesManager, { WindowProperties } from "core/PropertiesManager";
import { InputState } from "core/systems/InputSystem";
import { mat4, vec4 } from "gl-matrix";
import MathUtil from 'util/MathUtil';


export function addTitle(title: string, attachTarget: HTMLElement, properties: PropertiesManager) {
    const parent = attachTarget.querySelector('.views');

    const element = document.createElement('div');
    element.style.fontSize = '20px';

    element.innerHTML = `
        <span class="title-span">${title}</span>
    `;

    (parent as Element).append(element);

    getDimensions(attachTarget);
    function getDimensions(el: Element) {
        const { width, left, height, top } = el.getBoundingClientRect();
        element.style.left = left + 'px';
        // dimensionsElement.textContent = `Ww: ${window.innerWidth} W: ${Math.round(width)} X: ${Math.round(left)}`;
    }
}

export function fpsCounter(properties: PropertiesManager, attachTarget?: Element) {
    const parent = attachTarget?.querySelector('.views') || document.querySelector('.views') as Element;
    const element = document.createElement('div');

    let lastTime = performance.now();
    let frameCount = 0;
    let fps = 0;

    element.innerHTML = `
        <span>FPS: </span>
        <span id="fps-counter">${fps}</span>
    `

    parent.append(element);
    const counter = element.querySelector('#fps-counter') as Element;

    return function () {
        let currentTime = performance.now();
        frameCount++;

        if (currentTime - lastTime >= 1000) {
            fps = frameCount;
            frameCount = 0;
            lastTime = currentTime;
        }

        counter.textContent = String(fps);
    };
}

export function worldCoordinates(props: PropertiesManager,
                                 camera: CameraComponent,
                                 projectionMatrix: ProjectionMatrix,
                                 inputState: Input,
                                 parentElement: Element) {
    const parent = parentElement.querySelector('.views') as Element;
    const element = document.createElement('div');

    function vec4ToString(vec4: vec4): string {
        return `x: ${vec4[0].toFixed(5)} y: ${vec4[1].toFixed(5)} z: ${vec4[2].toFixed(5)}`
    }

    element.innerHTML = `
        <span>World XYZ: </span>
        <span class="world-xyz">N/A</span>
    `

    parent.append(element);
    const worldXyzHtml = element.querySelector('.world-xyz') as Element;

    document.addEventListener('mousemove', e => {
        const { width, height, hide } = props.getT<WindowProperties>('window');

        if (hide) {
            return;
        }

        const ndcMousePos = MathUtil.mousePosToNdc(inputState.inputState.mousePos, width, height);
        // console.log(`x: ${ndcMousePos[0]} y: ${ndcMousePos[1]}`);
        const viewCoordinates = MathUtil.ndcToView(ndcMousePos, mat4.invert(mat4.create(), projectionMatrix.get()));
        // console.log(viewCoordinates)
        const worldCoordinates = MathUtil.viewToWorld(viewCoordinates, mat4.invert(mat4.create(), camera.viewMatrix()));

        // const rayOrigin = cameraPosition; // Camera's position in world space
        // const rayDirection = normalize(subtractVectors(mouseWorldPos, cameraPosition));

        worldXyzHtml.textContent = vec4ToString(worldCoordinates);
    })
}
