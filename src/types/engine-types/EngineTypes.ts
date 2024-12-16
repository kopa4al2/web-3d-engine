type num4 = [number, number, number, number] | Float32Array;
type num3 = [number, number, number] | Float32Array;
type rgba = { r: number, g: number, b: number, a: number };
type xyz = { x: number, y: number, z: number };
type xyzw = { x: number, y: number, z: number, w: number };

class SdiColor {
    public rgba: rgba;

    constructor(r: number, g: number, b: number, a: number)
    constructor(color: num4)
    constructor(...args: any[]) {
        const data = Array.isArray(args[0]) ? args[0] : args;
        this.rgba = {
            r: data[0],
            g: data[1],
            b: data[2],
            a: data[3],
        };
    }

    toArray(): num4 {
        return [this.r, this.g, this.b, this.a];
    }

    get r() {
        return this.rgba.r;
    }

    get g() {
        return this.rgba.g;
    }

    get b() {
        return this.rgba.b;
    }

    get a() {
        return this.rgba.a;
    }
}

class SdiPoint3D {
    public xyz: xyz;

    constructor(x: number, y: number, z: number)
    constructor(coordinates: num3)
    constructor(...args: any[]) {
        const data = Array.isArray(args[0]) ? args[0] : args;
        this.xyz = {
            x: data[0],
            y: data[1],
            z: data[2],
        };
    }

    toArray(): num3 {
        return [this.x, this.y, this.z];
    }

    get x() {
        return this.xyz.x;
    }

    get y() {
        return this.xyz.y;
    }

    get z() {
        return this.xyz.z;
    }
}

class SdiDirection {
    public xyzw: xyzw;

    constructor(x: number, y: number, z: number, w: number)
    constructor(direction: num4)
    constructor(...args: any[]) {
        const data = Array.isArray(args[0]) ? args[0] : args;
        this.xyzw = {
            x: data[0],
            y: data[1],
            z: data[2],
            w: data[3],
        };
    }

    toArray(): num4 {
        return [this.x, this.y, this.z, this.w];
    }

    get x() {
        return this.xyzw.x;
    }

    get y() {
        return this.xyzw.y;
    }

    get z() {
        return this.xyzw.z;
    }

    get w() {
        return this.xyzw.w;
    }
}

export { SdiColor, SdiPoint3D, SdiDirection };
