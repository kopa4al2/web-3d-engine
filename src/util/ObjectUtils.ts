class ObjectUtils {

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
}

export default new ObjectUtils();