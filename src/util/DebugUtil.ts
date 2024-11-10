export default class DebugUtil {

    public static glEnumToString(number: number):string {
        if (number >= 33984 && number < 34013) {
            return `TEXTURE${number - 33984}`
        }
        if (number === 0x8A11) {
            return 'UNIFORM_BUFFER'
        }

        if (number === 0x8892) {
            return 'ARRAY_BUFFER'
        }

        if (number === 0x8893) {
            return 'ELEMENT_ARRAY_BUFFER'
        }

        return `N/A ${number}`;
    }

    public static addToWindowObject(label: string, any: any) {
        // @ts-ignore
        window[label] = any;
    }
}