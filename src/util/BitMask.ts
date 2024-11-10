export default class Bitmask<T extends number> {
    constructor(public mask = 0) {  // use Uint32Array
    }

    setFlag(flag: T) {
        this.mask |= flag;
    }

    clearFlag(flag: T) {
        this.mask &= ~flag;
    }

    toggleFlag(flag: T) {
        this.mask ^= flag;
    }

    hasFlag(flag: T) {
        return (this.mask & flag) !== 0;
    }
}
// @ts-ignore
window.bitmask = (num) => new Bitmask(num)