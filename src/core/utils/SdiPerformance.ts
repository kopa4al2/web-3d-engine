export default class SdiPerformance {
    public static readonly GLOBAL_TIMER = 'TIMER';

    public static begin() {
        console.time(this.GLOBAL_TIMER);
    }

    public static log(...any: any) {
        console.timeLog(this.GLOBAL_TIMER, ...any);
    }

    public static reset() {
        console.timeEnd(this.GLOBAL_TIMER);
        console.time(this.GLOBAL_TIMER);
    }
}