import JavaMap from "util/JavaMap";
import ThrottleUtil from "util/ThrottleUtil";

function isIterable(obj: any): obj is Iterable<any> {
    return obj != null && typeof obj[Symbol.iterator] === 'function';
}

class Logger {

    constructor() {
        this.toLoggable = this.toLoggable.bind(this);
    }

    info(...messages: any[]): void {
        this.logAny(messages)
        // messages.map(msg => this.toLoggable(msg))
        //     .forEach(console.log);
    }

    infoGroup(group: string, ...messages: any[]): void {
        console.groupCollapsed(group);
        this.logAny(messages);
        console.groupEnd();
        // messages.map(msg => this.toLoggable(msg))
        //     .forEach(console.log);
    }


    debug(group: string, ...messages: any[]): void {
        console.groupCollapsed(group);
        this.logAny(messages, console.debug);
        console.groupEnd();
    }

    trace(...messages: any[]): void {
        messages.map(msg => this.toLoggable(msg))
            .forEach(console.trace);
    }

    warn(...messages: any[]): void {
        messages.map(msg => this.toLoggable(msg))
            .forEach(console.warn);
    }

    error(messages: any[]): void {
        messages.map(msg => this.toLoggable(msg))
            .forEach(console.error);
    }

    protected getCallerInfo(): string {
        // Create an error to capture the stack trace
        const stack = new Error().stack;
        if (!stack) return "unknown";

        // Split the stack trace into lines
        const callerLine = stack.split('\n').find((l, i) => i > 0
            && !l.includes('Logger')
            && !l.includes('Array.forEach')
            && !l.includes('eval'));

        if (!callerLine) {
            return 'unknown caller';
        }

        const matches = new RegExp(/at ([^\\(]+) [^0-9]+(.*)\)/).exec(callerLine) as RegExpExecArray;
        return `${matches[1]}${matches[2]}`

        // // The third line is usually the caller (1st is "Error", 2nd is the logger, 3rd is the actual caller)
        // const callerLine = stackLines[3] ? stackLines[3].trim() : "unknown";
        //
        // console.log('CallerLine: ', callerLine)
        // // Extract file name and line/column information from the stack trace
        // const callerInfoMatch = callerLine.match(/\((.*)\)/);
        // console.log('CallerInfoMatch: ', stackLines)
        //
        // return callerInfoMatch ? callerInfoMatch[1] : callerLine;  // Return caller location info
    }


    private toLoggable(msg: any): string {
        if (typeof msg === 'string' || typeof msg === 'number' || typeof msg === 'boolean') {
            return msg.toString();
        }

        if (isIterable(msg)) {
            return [...msg].map(this.toLoggable).join(', ');
        }

        return JSON.stringify(msg);
        // if (typeof msg === Object)

    }

    protected logAny(messages: any[], logFn = console.log) {
        for (let msg of messages) {
            if (typeof msg === 'string' || typeof msg === 'number' || typeof msg === 'boolean') {
                logFn(msg);
            } else if (typeof msg === 'symbol') {
                logFn(msg.toString())
            } else if (isIterable(msg)) {
                [...msg].forEach(m => logFn(m.toString()))
            } else if (msg === Object(msg)) {
                // logFn(JSON.stringify(msg));
                logFn({ ...msg });
            } else {
                logFn(msg);
            }
        }
    }
}

interface RateLimitedLogEntry {
    timeStamp: Date,
    message: string,
    // group: string,
    // caller: string,
}

class RateLimitedLogger extends Logger {
    private static readonly queues: JavaMap<string, RateLimitedLogger> = new JavaMap();

    private readonly logInterval: number;

    // private queuedMessages: Set<string> = new Set;
    private queuedMessages: RateLimitedLogEntry[] = [];

    constructor(private caller: string, logInterval: number = 10_000) {
        super();
        this.logInterval = logInterval;
        setInterval(() => this.flushLogs(), logInterval);
    }

    logOnce(...message: any) {
        this.logMax(1, message);
    }

    logMax(times: number, ...message: any) {
        const caller = super.getCallerInfo();
        const logger = RateLimitedLogger.queues.computeIfAbsent(caller, () => new RateLimitedLogger(caller));

        if (logger.queuedMessages.length < times) {
            logger.queuedMessages.push({ message: JSON.stringify(message), timeStamp: new Date() });
        }
    }

    log(...message: any) {
        const caller = super.getCallerInfo();
        const logger = RateLimitedLogger.queues.computeIfAbsent(caller, () => new RateLimitedLogger(caller));

        // Dont overflood the logger
        if (logger.queuedMessages.length < 20) {
            logger.queuedMessages.push({ message: JSON.stringify(message), timeStamp: new Date() });
        }
    }


    // public debug(group: string, ...messages: any[]) {
    //     super.logAny(messages, msg => this.queuedMessages.add(msg));
    // }

    private flushLogs() {
        if (this.queuedMessages.length > 0) {
            console.groupCollapsed(this.caller);
            super.logAny(this.queuedMessages
                .map(({ timeStamp, message }) =>
                    `[${String(timeStamp.getHours()).padStart(2, '0')}:${String(timeStamp.getMinutes()).padStart(2, '0')}:${String(timeStamp.getSeconds()).padStart(2, '0')}.${String(timeStamp.getMilliseconds()).padStart(3, '0')}] ${message}`), console.debug);
            console.groupEnd();
            this.queuedMessages = [];
        }
    }
}

/**
 * Groups every logs inside the same group
 */
export class NamedLogger extends Logger {

    private isLoggingBegin: boolean = false;

    constructor(private name: string) {
        super();
        this.closeGroup = ThrottleUtil.debounce(this.closeGroup.bind(this), 500);
    }

    info(...messages: any[]) {
        if (!this.isLoggingBegin) {
            console.groupCollapsed(this.name);
            this.isLoggingBegin = true;
        }
        super.info(...messages);

        this.closeGroup();
    }

    trace(...messages: any[]) {
        if (!this.isLoggingBegin) {
            console.groupCollapsed(this.name);
            this.isLoggingBegin = true;
        }
        super.trace(...messages);
        this.closeGroup();
    }

    private closeGroup() {
        console.groupEnd();
        this.isLoggingBegin = false;
    }

}

class Observer {
    observe<T extends Object>(object: T, name?: string): T {
        let logGroup = (name || Object.keys({ object })[0]) + ' CHANGED '
        return this.createProxy(object, function (target, key, value) {
            log.infoGroup(logGroup, `${key.toString()} set to ${value}`);
            // @ts-ignore
            target[key] = value;
            return true;
        });
    }

    deepObserve<T extends Object>(object: T, name?: string): T {
        let logGroup = (name || Object.keys({ object })[0]) + ' CHANGED '
        const proxy = this.createProxy(object, (target, key, value) => {
            if (isObject(value)) {
                // @ts-ignore
                target[key] = this.deepObserve(value, logGroup);
            }

            return true;
        });

        for (const objectKey in object) {
            if (isObject(object[objectKey])) {
                // @ts-ignore
                proxy[objectKey] = this.deepObserve(object[objectKey], logGroup);
            }
        }

        return proxy;
    }

   /* deepObserveV2<T>(obj: T, name?: string): T {
        const isObject = obj => obj && typeof obj === 'object';

        const deepHandler = {
            get(target, prop, receiver) {
                const value = Reflect.get(target, prop, receiver);

                // Recursively wrap nested objects and arrays in proxies
                if (isObject(value)) {
                    return createDeepProxy(value, handler);
                }
                return value;
            },
            set(target, prop, value, receiver) {
                const oldValue = target[prop];
                const result = Reflect.set(target, prop, value, receiver);

                // Trigger handler when a change occurs
                handler(target, prop, value, oldValue);
                return result;
            }
        };

        // Wrap the top-level target in a Proxy and apply deep handler
        return new Proxy(target, deepHandler);
    }*/

    private createProxy<T extends Object>(object: T,
                                          onChange: (target: T, p: string | symbol, newValue: any, receiver: any) => boolean): T {
        return new Proxy(object, { set: onChange });
    }
}

function isObject(x: any) {
    return typeof x === 'object' && !Array.isArray(x) && x !== null
}

const log = new Logger();
export default log;
export const rateLimitedLog = new RateLimitedLogger('N/A');

export const observer = new Observer();
