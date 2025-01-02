import { GLTFWorkerRequest, GLTFWorkerResponse } from "core/parser/gltf/GLTFWorker";
import DebugUtil from "../../util/debug/DebugUtil";

interface WorkerStatus<Request, Response> {
    request?: Request,
    onFinish?: (result: Response) => void,
    isBusy: boolean,
    transferable?: Transferable[]
}

export default class WorkerPool<WorkerRequest,WorkerResponse> {

    private readonly workersStatus: WeakMap<Worker, WorkerStatus<WorkerRequest, WorkerResponse>>;
    private readonly queue: WorkerStatus<WorkerRequest, WorkerResponse>[] = [];

    constructor(private fn?: () => Worker,
                private workerCount: number = 0,
                private workers: Worker[] = []) {
        DebugUtil.addToWindowObject('WorkerPool', this);
        this.workersStatus = new WeakMap();
        this.workers.forEach(worker => this._addWorker(worker));

        if (fn) {
            for (let i = 0; i < workerCount; i++) {
                this.addWorker(fn());
            }
        }
    }

    addWorker(worker: Worker) {
        this.workers.push(worker);
        this._addWorker(worker);
    }

    removeWorker(worker: Worker) {
        this.workers = this.workers.filter(w => w !== worker);
    }

    shutdown() {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
    }

    submit(task: WorkerRequest, transferable?: Transferable[], onFinish?: (result: WorkerResponse) => void): Promise<WorkerResponse> {
        if (this.workers.length === 0) {
            throw new Error('No workers present!');
        }
        return new Promise(resolve => {
            this._enqueueTask(task, onFinish ? onFinish : resolve, transferable);
        });
    }

    handleError(worker: Worker, error: ErrorEvent) {
        console.error('General error in workers: ', error, worker);
    }

    handleMessageError(worker: Worker, error: MessageEvent) {
        console.error('Message error in workers: ', error, worker);
    }

    handleMessage(worker: Worker, result: WorkerResponse) {
        const workerState = this.workersStatus.get(worker);
        if (!workerState) {
            console.error('Worker has finished the job but no state is present: ', worker, workerState);
            return;
        }

        const nextTask = this.queue.shift();
        if (nextTask) {
            workerState.request = nextTask.request;
            worker.postMessage(nextTask.request);
            if (workerState.onFinish) {
                workerState.onFinish(result);
            }
            workerState.onFinish = nextTask.onFinish;
            return;
        }

        workerState.isBusy = false;
        workerState.request = undefined;

        if (workerState.onFinish) {
            workerState.onFinish(result);
        }

        workerState.onFinish = undefined;
    }

    private _enqueueTask(task: WorkerRequest, onFinish?: (result: WorkerResponse) => void,
                         transferable?: Transferable[]) {
        for (const worker of this.workers) {
            const workerStatus = this.workersStatus.get(worker)!;
            if (!workerStatus.isBusy) {
                workerStatus.isBusy = true;
                worker.postMessage(task, { transfer: transferable });
                workerStatus.onFinish = onFinish;
                return;
            }
        }

        this.queue.push({ request: task, onFinish, isBusy: false, transferable });
    }

    private _addWorker(worker: Worker) {
        this.workersStatus.set(worker, { isBusy: false });
        worker.onerror = (err) => this.handleError(worker, err);
        worker.onmessage = resp => this.handleMessage(worker, resp.data);
        worker.onmessageerror = resp => this.handleMessageError(worker, resp);
    }
}