export default class PromiseQueue {

    private queue: Promise<any>;
    constructor() {
        this.queue = Promise.resolve();
    }

    public addTask<T>(task: () => Promise<T>) :Promise<T> {
        this.queue = this.queue.then(() => task());
        return this.queue;
    }
}