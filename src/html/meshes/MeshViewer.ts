/*
import Mesh from "core/components/Mesh";
import DirectionalLight from "core/light/DirectionalLight";
import { vec3 } from 'gl-matrix';
import { addEventListener } from "../CustomEvents";
import { Pane } from 'tweakpane';

export interface EntitySelectPayload {
    selectedEntity: string,
    coordinates: vec3,
}

const innerHtml = `
    <style>
        .lights {
            display: flex;
        }
    </style>
    <div class="mesh-viewer-wrapper">
        <div class="lights">
        </div>
    </div>
`
export default class MeshViewer extends HTMLElement {

    private _shadowRoot: ShadowRoot;
    private readonly meshes: MeshData[];
    private lightsContainer: HTMLElement | null = null;
    private readonly pane: Pane;
    private readonly lights: DirectionalLight[];

    constructor() {
        super();
        this._shadowRoot = this.attachShadow({ mode: 'open' });
        // @ts-ignore
        this.pane = new Pane({ container: this._shadowRoot.querySelector('.lights')! });

        this.meshes = [];
        this.lights = [];
    }

    addMesh(mesh: MeshData) {
        this.meshes.push(mesh);
    }

    addDirectionalLight(light: DirectionalLight) {
        this.pane.addBinding(light.direction, 0, { min: -10, max: 10, step: 0.1, label: 'X Position' });
        this.pane.addBinding(light.direction, 1, { min: -10, max: 10, step: 0.1, label: 'Y Position' });
        this.pane.addBinding(light.direction, 2, { min: -10, max: 10, step: 0.1, label: 'Z Position' });
        console.log(this.pane)
        // this.pane.addBinding(light, 'color', { view: 'color', label: 'Light Color' });
        // this.pane.addBinding(light, 'intensity', { min: 0, max: 10, step: 0.1, label: 'Intensity' });

        // this.lights.push(light);
        // this.addLightControl(light);
    }


    connectedCallback() {
        this._shadowRoot.innerHTML = innerHtml;
        this.lightsContainer = this._shadowRoot.querySelector('.lights');
    }

    disconnectedCallback() {
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        console.log(`Attribute ${ name } changed from ${ oldValue } to ${ newValue }`);
    }

    adoptedCallback() {
        console.log('Component moved to a new document');
    }

    static get observedAttributes() {
        return ['meshes']; // List of attributes to watch
    }

    private addLightControl(light: DirectionalLight) {
        const wrapper = document.createElement('directional-light');
        const color = document.createElement('div');
        const showColor = document.createElement('p');
        const editColor = document.createElement('input');
    }
}

interface MeshViewerConstructor extends CustomElementConstructor {
    new(): MeshViewer;
}

export interface MeshData {
    position: vec3,
    label: string,
}

export interface MeshViewerControl {
    addMesh: (mesh: MeshData) => void,
    addLight: (light: DirectionalLight) => void,
}

export function enableMeshViewer(attachTarget: Element): MeshViewerControl {
    const parent = attachTarget.querySelector('.controls') as Element;

    // const element = document.createElement('sdi-mesh-viewer');
    const element = new MeshViewer();
    parent.append(element);

    return {
        addMesh: element.addMesh.bind(element),
        addLight: element.addDirectionalLight.bind(element)
    }
}

customElements.define('sdi-mesh-viewer', MeshViewer as MeshViewerConstructor);
*/
