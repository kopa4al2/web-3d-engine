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

    trace(...messages: any[]): void {
        messages.map(msg => this.toLoggable(msg))
            .forEach(console.trace);
    }

    warn(messages: any[]): void {
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

    private logAny(messages: any[]) {
        for (let msg of messages) {
            if (typeof msg === 'string' || typeof msg === 'number' || typeof msg === 'boolean') {
                console.log(msg);
            } else if (isIterable(msg)) {
                console.log([...msg]);
            } else if (msg === Object(msg)) {
                console.log({ ...msg });
            } else {
                console.log(msg);
            }
        }
    }
}

class RateLimitedLogger extends Logger {
    private static readonly queues: JavaMap<string, RateLimitedLogger> = new JavaMap();

    private readonly logInterval: number;

    private lastLogTime: number = -1;
    private queuedMessages: Set<string> = new Set;

    constructor(private caller: string, logInterval: number = 1000) {
        super();
        this.logInterval = logInterval;
        setInterval(() => this.flushLogs(), logInterval);
    }


    log(message: any) {
        const caller = super.getCallerInfo();
        const logger = RateLimitedLogger.queues.computeIfAbsent(caller, () => new RateLimitedLogger(caller));

        logger.queuedMessages.add(JSON.stringify(message));
        // if (logger.lastLogTime < 0) {
        //     logger.lastLogTime = performance.now();
        //     super.infoGroup(caller, message);
        //     return;
        // }
        // const currentTime = performance.now();

        // Queue the message
        // this.queuedMessages.add(message);

        // Only log if the time since the last log is greater than logInterval
        // if (currentTime - this.lastLogTime >= this.logInterval) {
        //     this.flushLogs();  // Log all queued messages
        //     this.lastLogTime = currentTime;
        // }
    }

    private flushLogs() {
        if (this.queuedMessages.size > 0) {
            this.queuedMessages.forEach(msg => super.infoGroup(this.caller, msg));
            this.queuedMessages.clear();
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
        let logGroup = (name || Object.keys({object})[0]) + ' CHANGED '
        return this.createProxy(object, function (target, key, value) {
            log.infoGroup(logGroup, `${key.toString()} set to ${value}`);
            // @ts-ignore
            target[key] = value;
            return true;
        });
    }

    deepObserve<T extends Object>(object: T, name?: string): T {
        let logGroup = (name || Object.keys({object})[0]) + ' CHANGED '
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
