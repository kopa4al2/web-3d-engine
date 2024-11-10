import { Comparable, Comparator } from 'util/JavaTypes';

export default class JavaMap<K, V> extends Map<K, V> {

    get(key: K): V {
        return super.get(key) as V;
    }

    getOrDefault(key: K, defaultValue: V): V {
        return super.get(key) || defaultValue;
    }

    merge(key: K, value: V, onConflict: (old: V, newV: V) => V | void): void {
        const val = super.get(key);
        if (val) {
            const newValue = onConflict(val, value);
            if (newValue) {
                super.set(key, newValue);
            }
        } else {
            super.set(key, value);
        }
    }

    computeIfAbsent(key: K, onAbsent: () => V): V {
        if (!super.has(key)) {
            const value = onAbsent();
            super.set(key, value);

            return value;
        }
        return super.get(key) as V;
    }

    isEmpty(): boolean {
        return this.size === 0;
    }

    public static groupBy<T, K extends keyof T, V extends T[K]>(objs: T[], key: K): JavaMap<V, T[]> {
        return objs.reduce((acc, obj) => {
            const keyValue = obj[key] as V;

            // Initialize the array for this key if it doesn't exist
            if (!acc.has(keyValue)) {
                acc.set(keyValue, []);
            }

            // Add the object to the corresponding group
            acc.get(keyValue).push(obj);

            return acc;
        }, new JavaMap<V, T[]>());
    }

    public static groupByTwoProperties<T,
        K1 extends keyof T,
        K2 extends keyof T,
        V1 extends T[K1] & (string | number | symbol),
        V2 extends T[K2] & (string | number | symbol)
    >
    (objs: T[], key1: K1, key2: K2): JavaMap<V1, JavaMap<V2, T[]>> {
        return objs.reduce((acc: JavaMap<V1, JavaMap<V2, T[]>>, entity: T) => {
            const groupVal1 = entity[key1] as V1;
            const groupVal2 = entity[key2] as V2;
            if (!acc.has(groupVal1)) {
                acc.set(groupVal1, new JavaMap<V2, T[]>());
            }

            if (!acc.get(groupVal1).has(groupVal2)) {
                acc.get(groupVal1).set(groupVal2, []);
            }

            acc.get(groupVal1).get(groupVal2).push(entity);
            return acc;
        }, new JavaMap<V1, JavaMap<V2, T[]>>)
    }
}

export class SortedMap<K, V> extends Map<K, V> {

    private readonly _children: [K, V][];


    constructor(private comparator: Comparator<K>) {
        super();
        this._children = [];
    }

    get(key: K): V {
        return this._children.find(ch => ch[0] === key)![1]
    }

    public set(key: K, value: V): this {
        this._children.push([key, value]);
        this._children.sort((kv1, kv2) => this.comparator.compare(kv1[0], kv2[0]))

        return this;
    }

    public static groupBy<T, K extends keyof T, V extends T[K]>(objs: T[], key: K): JavaMap<V, T[]> {
        return objs.reduce((acc, obj) => {
            const keyValue = obj[key] as V;

            // Initialize the array for this key if it doesn't exist
            if (!acc.has(keyValue)) {
                acc.set(keyValue, []);
            }

            // Add the object to the corresponding group
            acc.get(keyValue).push(obj);

            return acc;
        }, new JavaMap<V, T[]>());
    }

    public static groupByTwoProperties<T,
        K1 extends keyof T,
        K2 extends keyof T,
        V1 extends T[K1] & (string | number | symbol),
        V2 extends T[K2] & (string | number | symbol)
    >
    (objs: T[], key1: K1, key2: K2): JavaMap<V1, JavaMap<V2, T[]>> {
        return objs.reduce((acc: JavaMap<V1, JavaMap<V2, T[]>>, entity: T) => {
            const groupVal1 = entity[key1] as V1;
            const groupVal2 = entity[key2] as V2;
            if (!acc.has(groupVal1)) {
                acc.set(groupVal1, new JavaMap<V2, T[]>());
            }

            if (!acc.get(groupVal1).has(groupVal2)) {
                acc.get(groupVal1).set(groupVal2, []);
            }

            acc.get(groupVal1).get(groupVal2).push(entity);
            return acc;
        }, new JavaMap<V1, JavaMap<V2, T[]>>)
    }
}

