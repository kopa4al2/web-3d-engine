import Component, { ComponentId } from "core/components/Component";
import { EntityId } from 'core/EntityManager';
import { quat, vec3 } from "gl-matrix";

export enum AnimationProperty {
    rotation,
    translation,
    scale,
}

export enum AnimationStep {
    LINEAR,
    STEP,
    CUBICSPLINE,
}
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
    targetEntity: EntityId; // Entity ID of the target (e.g., a joint or object)
    property: AnimationProperty; //'translation' | 'rotation' | 'scale'; // Property to animate
    keyframes: AnimationKeyframe[]; // Array of keyframes
}

export interface AnimationKeyframe {
    time: number; // Time of the keyframe
    value: vec3 | quat; // Value at this keyframe
    interpolation: AnimationStep; //'LINEAR' | 'STEP' | 'CUBICSPLINE'; // Interpolation method
}