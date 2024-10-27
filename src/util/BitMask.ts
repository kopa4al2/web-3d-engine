export default class Bitmask {
    constructor(public mask = 0) {  // use Uint32Array
    }

    setFlag(flag: number) {
        this.mask |= flag;
    }

    clearFlag(flag: number) {
        this.mask &= ~flag;
    }

    toggleFlag(flag: number) {
        this.mask ^= flag;
    }

    hasFlag(flag: number) {
        return (this.mask & flag) !== 0;
    }
}