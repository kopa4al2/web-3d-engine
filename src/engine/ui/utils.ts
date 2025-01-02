export function wrapArrayAsColor(arr: number[] | Float32Array) {
    return {
        color: {
            set r(r: number) {
                arr[0] = r;
            },
            get r() {
                return arr[0];
            },

            set g(g: number) {
                arr[1] = g;
            },
            get g() {
                return arr[1];
            },

            set b(b: number) {
                arr[2] = b;
            },
            get b() {
                return arr[2];
            },
        }
    }
}

export function wrapArrayAsXYZW(arr: number[] | Float32Array) {
    return {
        xyzw: {
            set x(x: number) {
                arr[0] = x;
            },
            get x() {
                return arr[0];
            },

            set y(y: number) {
                arr[1] = y;
            },
            get y() {
                return arr[1];
            },

            set z(z: number) {
                arr[2] = z;
            },
            get z() {
                return arr[2];
            },

            set w(w: number) {
                arr[3] = w;
            },
            get w() {
                return arr[3];
            },
        }
    }
}

export function wrapArrayAsXYZ(arr: number[] | Float32Array) {
    return {
        xyz: {
            set x(x: number) {
                arr[0] = x;
            },
            get x() {
                return arr[0];
            },

            set y(y: number) {
                arr[1] = y;
            },
            get y() {
                return arr[1];
            },

            set z(z: number) {
                arr[2] = z;
            },
            get z() {
                return arr[2];
            },
        }
    }
}

export function wrapArrayAsXY(arr: number[] | Float32Array) {
    return {
        xy: {
            set x(x: number) {
                arr[0] = x;
            },
            get x() {
                return arr[0];
            },

            set y(y: number) {
                arr[1] = y;
            },
            get y() {
                return arr[1];
            },
        },
    }
}

export function checkEvery(fn: () => boolean, timeout: number = 500) {
    if (fn()) {
        return;
    }

    let interval = setInterval(() => {
        const shouldStop = fn();
        if (shouldStop) {
            clearInterval(interval);
        }
    }, timeout);
}
