"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.workerManager = exports.WorkerManager = void 0;
const mediasoup = __importStar(require("mediasoup"));
const config_1 = require("../config");
class WorkerManager {
    workers = [];
    nextWorkerIdx = 0;
    onWorkerCrashCallbacks = [];
    /**
     * Initializes the pool of mediasoup workers equal to CPU cores (or config).
     */
    async init() {
        const numWorkers = config_1.config.mediasoup.numWorkers;
        console.log(`[WorkerManager] Spawning ${numWorkers} mediasoup worker(s)...`);
        for (let i = 0; i < numWorkers; i++) {
            await this.createWorker();
        }
        console.log(`[WorkerManager] Initialized worker pool with ${this.workers.length} active workers.`);
    }
    /**
     * Spawns a single mediasoup worker and attaches death listener.
     */
    async createWorker() {
        const worker = await mediasoup.createWorker(config_1.config.mediasoup.workerSettings);
        console.log(`[WorkerManager] Worker spawned [PID: ${worker.pid}]`);
        worker.on('died', (error) => {
            console.error(`[WorkerManager] CRITICAL: mediasoup Worker died [PID: ${worker.pid}]`, error);
            // Remove dead worker from active pool
            const deadPid = worker.pid;
            this.workers = this.workers.filter((w) => w.pid !== deadPid);
            // Respawn replacement worker process immediately
            console.log(`[WorkerManager] Respawning replacement worker process...`);
            this.createWorker().catch((err) => {
                console.error('[WorkerManager] Failed to respawn worker:', err);
            });
            // Notify registered room migration listeners
            this.onWorkerCrashCallbacks.forEach((cb) => cb(deadPid));
        });
        this.workers.push(worker);
        return worker;
    }
    /**
     * Gets the next worker in round-robin sequence to distribute room routers.
     */
    getNextWorker() {
        if (this.workers.length === 0) {
            throw new Error('[WorkerManager] No active mediasoup workers available in pool');
        }
        const worker = this.workers[this.nextWorkerIdx];
        this.nextWorkerIdx = (this.nextWorkerIdx + 1) % this.workers.length;
        return worker;
    }
    /**
     * Registers a callback for worker crash events to trigger room router migration.
     */
    onWorkerCrash(cb) {
        this.onWorkerCrashCallbacks.push(cb);
    }
    /**
     * Returns stats for all running workers.
     */
    async getWorkerStats() {
        const stats = [];
        for (const worker of this.workers) {
            try {
                const usage = await worker.getResourceUsage();
                stats.push({ pid: worker.pid, usage });
            }
            catch (err) {
                console.error(`[WorkerManager] Failed to get stats for worker ${worker.pid}:`, err);
            }
        }
        return stats;
    }
}
exports.WorkerManager = WorkerManager;
exports.workerManager = new WorkerManager();
