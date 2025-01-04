class ObjectUtils {

    uniqueValue(...strings: (undefined | string | number)[]) {
        return strings.join('-');
    }

    cloneObject<T extends any>(object: {}): T {
        return JSON.parse(JSON.stringify(object)) as T;
    }

    isPrimitive(value: any): boolean {
        return (
            value !== null &&
            typeof value === 'number' ||
            typeof value === 'string' ||
            typeof value === 'boolean'
        );
    }

    mergePartial<T>(partial: Partial<T>, defaultValues: T): T {
        return { ...defaultValues, ...partial };
    }

    groupByTwoProperties<T,
        K1 extends keyof T,
        K2 extends keyof T,
        V1 extends T[K1] & (string | number | symbol),
        V2 extends T[K2] & (string | number | symbol)
    >
    (objs: T[], key1: K1, key2: K2): Record<V1, Record<V2, T[]>> {
        return objs.reduce((acc: Record<V1, Record<V2, T[]>>, entity: T) => {
            const groupVal1 = entity[key1] as V1;
            const groupVal2 = entity[key2] as V2;
            if (!acc[groupVal1]) {
                acc[groupVal1] = {} as Record<V2, T[]>
            }

            if (!acc[groupVal1][groupVal2]) {
                acc[groupVal1][groupVal2] = [];
            }

            acc[groupVal1][groupVal2].push(entity);
            return acc;
        }, {} as Record<V1, Record<V2, T[]>>)
    }

    groupBy<T>(
        array: T[],
        key: keyof T
    ): Record<keyof T, T[]> {
        return array.reduce((acc, obj) => {
            const keyValue = obj[key] as keyof T;

            // Initialize the array for this key if it doesn't exist
            if (!acc[keyValue]) {
                acc[keyValue] = [];
            }

            // Add the object to the corresponding group
            acc[keyValue].push(obj);

            return acc;
        }, {} as Record<keyof T, T[]>);
    }
}

export default new ObjectUtils();
