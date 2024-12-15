export default interface Cacheable<T> {
    update(fn: (current: T) => void): void;

    update<K extends keyof T>(prop: K, val: T[K]): void;

    update(newProps: Partial<T>): void;

    get<K extends keyof T>(prop: K): T[K];

    hasChanged: boolean;
}

export abstract class DefaultCacheable<T> implements Cacheable<T> {
    abstract hasChanged: boolean;

    protected constructor(protected _data: T) {
    }

    update(fn: (current: T) => void): void;
    update<K extends keyof T>(prop: K, val: T[K]): void;
    update(newProps: Partial<T>): void;
    update(arg1: any, arg2?: any): void {
        if (typeof arg1 === "function") {
            // Case 1: Update using a function
            const fn = arg1 as (current: T) => void;
            fn(this._data);
            this.hasChanged = true;
        } else if (arg2 !== undefined) {
            // Case 2: Update a single property
            const key = arg1 as keyof T;
            const value = arg2 as T[keyof T];
            if (this._data[key] !== value) {
                this._data[key] = value;
                this.hasChanged = true;
            }
        } else if (typeof arg1 === "object") {
            // Case 3: Update multiple properties
            const newProps = arg1 as Partial<T>;
            for (const key in newProps) {
                if (newProps[key] !== undefined && this._data[key] !== newProps[key]) {
                    this._data[key] = newProps[key]!;
                    this.hasChanged = true;
                }
            }
        }
    }

    get<K extends keyof T>(prop: K): T[K] {
        return this._data[prop];
    }

}

export class CacheableImpl<T> extends DefaultCacheable<T> {
    constructor(_data: T, public hasChanged: boolean) {
        super(_data);
    }
}
