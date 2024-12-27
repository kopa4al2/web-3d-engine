export default class PromiseQueue {

    private queue: Promise<any>;
    private tasks: number;
    constructor() {
        this.queue = Promise.resolve();
        this.tasks = 0;
    }

    public addTask<T>(task: () => Promise<T>) :Promise<T> {
        this.queue = this.queue.then(() => task());
        return this.queue;
    }

    public addLimitedTask<T>(maxTask: number, task: () => Promise<T>): Promise<T> {
        if (maxTask && this.tasks >= maxTask) {
            console.warn(`[Promise Queue] The max task: ${maxTask} limit has been reached`);
            return this.queue;
        }
        this.tasks++;
        this.queue = this.queue.then(() => {
            this.tasks--;
            return task();
        });

        return this.queue;
    }
}