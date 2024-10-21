import ProjectionMatrix from "core/components/camera/ProjectionMatrix";
import Input from "core/components/Input";
import PropertiesManager from "core/PropertiesManager";
import { InputState } from "core/systems/InputSystem";
import { mat4, vec4 } from "gl-matrix";


export function addTitle(title: string, attachTarget: HTMLElement, properties: PropertiesManager) {
    const parent = attachTarget.querySelector('.views');

    const element = document.createElement('div');
    // element.style.position = `absolute`;
    // element.style.left = attachTarget.getBoundingClientRect().left + 30 + 'px';
    // element.style.top = (attachTarget.getBoundingClientRect().bottom - 50 )+ 'px';
    // element.style.width = '180px';
    // element.style.height = '45px';
    // element.style.background = '#FFFFFFAA';
    // element.style.zIndex = '999';
    element.style.fontSize = '20px';

    element.innerHTML = `
        <span class="title-span">${title}</span>
<!--        <div style="font-size: 14px" class="dimensions"></div>-->
    `;
    // const dimensionsElement = element.querySelector('.dimensions') as Element;

    (parent as Element).append(element);
    // properties.subscribeToPropertyChange('window', () => getDimensions(attachTarget))

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
                                 projectionMatrix: ProjectionMatrix,
                                 viewMatrix: mat4,
                                 inputState: Input) {
    const parent = document.querySelector('.views') as Element;
    const element = document.createElement('div');

    function vec4ToString(vec4: vec4): string {
        return `x: ${vec4[0]} y: ${vec4[1]} z: ${vec4[2]} w: ${vec4[3]}`
    }

    element.innerHTML = `
        <span>World XYZ: </span>
        <span class="world-xyz">N/A</span>
    `

    parent.append(element);
    const worldXyzHtml = element.querySelector('.world-xyz') as Element;

    document.addEventListener('mousemove', e => {
        const x = inputState.inputState.mousePos[0];
        const y = inputState.inputState.mousePos[1];

        const worldPosVec = vec4.fromValues(x, y, -1.0, 1.0);
        const invProjMatrix = mat4.create();
        mat4.invert(invProjMatrix, projectionMatrix.get());

        const invViewMatrix = mat4.create();
        mat4.invert(invViewMatrix, viewMatrix);

        const viewPosition = vec4.create();
        vec4.transformMat4(viewPosition, worldPosVec, invProjMatrix);

        // Perform the perspective divide (homogeneous coordinates)
        viewPosition[0] /= viewPosition[3];
        viewPosition[1] /= viewPosition[3];
        viewPosition[2] /= viewPosition[3];

        // Transform the point from view space to world space using the inverse view matrix
        const worldPosition = vec4.create();
        vec4.transformMat4(worldPosition, viewPosition, invViewMatrix);

        worldXyzHtml.textContent = vec4ToString(worldPosition);
    })

    return () => {
        const x = inputState.inputState.mousePos[0];
        const y = inputState.inputState.mousePos[1];
        const worldPosVec = vec4.fromValues(x, y, -1.0, 1.0);
        const invProjMatrix = mat4.create();
        mat4.invert(invProjMatrix, projectionMatrix.get());

        const invViewMatrix = mat4.create();
        mat4.invert(invViewMatrix, viewMatrix);

        const viewPosition = vec4.create();
        vec4.transformMat4(viewPosition, worldPosVec, invProjMatrix);

        // Perform the perspective divide (homogeneous coordinates)
        viewPosition[0] /= viewPosition[3];
        viewPosition[1] /= viewPosition[3];
        viewPosition[2] /= viewPosition[3];

        // Transform the point from view space to world space using the inverse view matrix
        const worldPosition = vec4.create();
        vec4.transformMat4(worldPosition, viewPosition, invViewMatrix);

        worldXyzHtml.textContent = vec4ToString(worldPosition);
    }
}
