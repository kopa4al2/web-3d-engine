import { vec3 } from 'gl-matrix';

export interface EntitySelectPayload {
    selectedEntity: string,
    coordinates: vec3,
}

const innerHtml = `
    <style>
        .coordinate-inputs {
            display: flex;
        }
        .coordinate-input {
            width: 25px;
        }
    </style>
    <div class="entity-select-wrapper">
        <div class="coordinate-inputs">
            <input class="coordinate-input x" data-index="0" placeholder="X" value="0"/>
            <input class="coordinate-input y" data-index="1" placeholder="Y" value="0"/>
            <input class="coordinate-input z" data-index="2" placeholder="Z" value="0"/>
        </div>
        <select class="entity-select">
            <option value="" disabled selected>Select entity</option>
        </select>
        <button disabled class="entity-select-btn">ADD</button>
    </div>
`
export default class EntitySelect extends HTMLElement {

    private _shadowRoot: ShadowRoot;
    private selectElement?: HTMLSelectElement;
    private addButton?: HTMLButtonElement;
    private entities: string[];
    private readonly coordinates: vec3;

    constructor() {
        super();
        this._shadowRoot = this.attachShadow({ mode: 'open' });
        this.onSelect = this.onSelect.bind(this);
        this.onAdd = this.onAdd.bind(this);
        this.entities = [];
        this.coordinates = vec3.create();
    }

    connectedCallback() {
        this._shadowRoot.innerHTML = innerHtml;
        this.selectElement = this._shadowRoot.querySelector('.entity-select') as HTMLSelectElement;
        this.addButton = this._shadowRoot.querySelector('.entity-select-btn') as HTMLButtonElement;
        this._shadowRoot.querySelectorAll('.coordinate-inputs .coordinate-input').forEach((el: Element) => {
            const input = el as HTMLInputElement;
            input.addEventListener('keypress', (e) => {
                if (!/[0-9\.\-]/.test(e.key)) {
                    // Prevent the key press if it’s not a number
                    e.preventDefault();
                }
            });

            input.addEventListener('change', _ => {
                if (input.value && !isNaN(parseFloat(input.value))) {
                    this.coordinates[parseInt(input.dataset['index']!)] = parseFloat(input.value);
                }
            });
        })

        this.selectElement.addEventListener('change', this.onSelect);
        this.addButton.addEventListener('click', this.onAdd);
        this.renderOptions();
    }

    disconnectedCallback() {
        console.log('Component removed from DOM');
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        if (name === 'entities') {
            this.entities = newValue?.split(',') || [];
            this.renderOptions();
        }
        // console.log(`Attribute ${name} changed from ${oldValue} to ${newValue}`);
    }

    adoptedCallback() {
        console.log('Component moved to a new document');
    }

    static get observedAttributes() {
        return ['entities']; // List of attributes to watch
    }

    private renderOptions() {
        if (!this.selectElement) {
            return;
        }

        this.selectElement.querySelectorAll('.entity-select-option').forEach(opt => opt.remove());
        this.entities.forEach(entity => {
            const option = document.createElement('option');
            option.className = 'entity-select-option';
            option.value = entity;
            option.text = entity;
            this.selectElement!.appendChild(option);
        });
    }

    private onAdd() {
        const selectedEntity = this.selectElement!.selectedOptions[0].value;
        const addEntityEvent = new CustomEvent('add-entity', {
            detail: { selectedEntity, coordinates: this.coordinates },
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(addEntityEvent);
    }

    private onSelect() {
        const selectedOptions = this.selectElement?.selectedOptions;

        this.addButton!.disabled = !selectedOptions || !selectedOptions[0];
    }
}

interface EntitySelectConstructor extends CustomElementConstructor {
    new(): EntitySelect
}

export const enableWebComponentEntitySelect = (() => {
    let isEnabled = false;
    return () => {
        if (!isEnabled) {
            customElements.define('sdi-entity-select', EntitySelect as EntitySelectConstructor);
            isEnabled = true;
        }
    }
})()
