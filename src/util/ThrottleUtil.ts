/**
 * Thanks chat gpt!
 */
class ThrottleUtil {

    private log = (logs: any) => {
        console.log(logs);
    };
    constructor() {
        this.throttledLog = this.throttle(this.throttledLog, 2000);
    }

    debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
        let timeoutId: number | undefined;

        return function (...args: Parameters<T>) {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }
            timeoutId = window.setTimeout(() => {
                func(...args);
            }, wait);
        };
    }

    throttle<T extends (...args: any[]) => void>(func: T, limit: number): (...args: Parameters<T>) => void {
        let lastFunc: number | undefined;
        let lastRan: number | undefined;

        return function (...args: Parameters<T>) {
            const now = performance.now();

            if (lastRan === undefined || (now - lastRan) >= limit) {
                func(...args);
                lastRan = now;
            } else {
                if (lastFunc) {
                    clearTimeout(lastFunc);
                }
                lastFunc = window.setTimeout(() => {
                    if ((performance.now() - lastRan!) >= limit) {
                        func(...args);
                        lastRan = performance.now();
                    }
                }, limit - (now - lastRan));
            }
        };
    }


    throttledLog(caller: string, logs: any, logFn?: Function) {
        if (logFn) {
            console.group('DRAW LOG ' + caller);
            logFn(logs);
            console.groupEnd();
            return;
        }
        console.groupCollapsed('DRAW LOG ' + caller);
        console.log(logs);
        console.groupEnd();
    }
}

export default new ThrottleUtil();