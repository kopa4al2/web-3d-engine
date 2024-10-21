export default class JavaMap<K, V> extends Map<K, V> {


    get(key: K): V {
        return super.get(key) as V;
    }

    getOrDefault(key: K, defaultValue: V): V {
        return super.get(key) || defaultValue;
    }

    merge(key: K, value: V, onConflict: (old: V, newV: V) => V): void {
        const val = super.get(key);
        if (val) {
            super.set(key, onConflict(val, value));
        } else {
            super.set(key, value);
        }
    }

    computeIfAbsent(key: K, onAbsent: () => V): V {
        if (!super.has(key)) {
            super.set(key, onAbsent());
        }
        return super.get(key) as V;
    }
}