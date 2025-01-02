// @ts-nocheck
export type ChangeHandler = (property: string, value: any, target: any) => void;

export function createDynamicInterceptor<T extends object>(initialTarget: T, onChange?: ChangeHandler): {
    proxy: T,
    setTarget: (newTarget: T) => void
} {
    let target = initialTarget;

    const proxy = new Proxy({} as T, {
        get(_, property) {
            return Reflect.get(target, property);
        },
        set(_, property, value) {
            if (onChange) {
                console.log('[INTERCEPTOR] Update property', property, value);
                onChange(String(property), value, target);
            }
            return Reflect.set(target, property, value);
        },
        deleteProperty(_, property) {
            if (onChange) {
                console.log('[INTERCEPTOR] Delete property', property);
                onChange(String(property), undefined, target);
            }
            return Reflect.deleteProperty(target, property);
        }
    });

    const setTarget = (newTarget: T) => {
        target = newTarget;
    };

    return { proxy, setTarget };
}
