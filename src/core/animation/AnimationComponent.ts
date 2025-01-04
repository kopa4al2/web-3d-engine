import Component, { ComponentId } from "core/components/Component";
import { quat, vec3 } from "gl-matrix";

export default class AnimationComponent implements Component {
    public static readonly ID = Symbol('AnimationComponent');
    readonly id: ComponentId = AnimationComponent.ID;

    constructor(public animations: Record<string, Animation>,
                public currentAnimation: string,
                public time: number,
                public speed: number,
                public loop: boolean
    ) {

    }
}

export interface Animation {
    duration: number; // Length of the animation in seconds
    tracks: AnimationTrack[]; // List of animation tracks
}

export interface AnimationTrack {
    targetEntity: number; // Entity ID of the target (e.g., a joint or object)
    property: 'translation' | 'rotation' | 'scale'; // Property to animate
    keyframes: Keyframe[]; // Array of keyframes
}

export interface Keyframe {
    time: number; // Time of the keyframe
    value: vec3 | quat; // Value at this keyframe
    interpolation: 'LINEAR' | 'STEP' | 'CUBICSPLINE'; // Interpolation method
}