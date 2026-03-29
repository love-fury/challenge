import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import {
  ChromeProcessLauncher,
  isChromeDebuggerEndpointReady
} from "./ChromeProcessLauncher.js";
import {
  readChromeWorkerRegistry,
  writeChromeWorkerRegistry
} from "./chromeWorkerRegistry.js";
import {
  buildChromeWorkerDefinitions,
  DEFAULT_CHROME_BINARY_PATH,
  DEFAULT_CHROME_WORKER_HOST,
  DEFAULT_CHROME_WORKER_REGISTRY_PATH,
  DEFAULT_CHROME_WORKER_ROOT_DIR,
  DEFAULT_CHROME_WORKER_START_URL,
  type ChromeWorkerLease,
  type ChromeWorkerPoolOptions,
  type ChromeWorkerRegistry,
  type LaunchChromeWorkersRequest,
  type StopChromeWorkersRequest,
  resolveChromeWorkerStatus
} from "./chromeWorkers.js";
import { ChromeLauncherError } from "./errors.js";

const PROCESS_EXIT_WAIT_MS = 2_000;
const PROCESS_EXIT_POLL_INTERVAL_MS = 100;

export class ChromeWorkerPool {
  private readonly host: string;
  private readonly launcher: ChromeProcessLauncher;
  private readonly registryPath: string;
  private readonly userDataRootDir: string;

  constructor(options: ChromeWorkerPoolOptions = {}) {
    this.host = options.host ?? DEFAULT_CHROME_WORKER_HOST;
    this.registryPath = resolveChromeWorkerRegistryPath(options.registryPath);
    this.userDataRootDir = options.userDataRootDir ?? DEFAULT_CHROME_WORKER_ROOT_DIR;
    this.launcher = new ChromeProcessLauncher(buildLauncherOptions(options));
  }

  async launchWorkers(request: LaunchChromeWorkersRequest): Promise<ChromeWorkerLease[]> {
    const registry = await this.loadRegistry();
    registry.workers = await refreshWorkers(registry.workers);
    const host = request.host ?? this.host;
    const rootDir = request.userDataRootDir ?? this.userDataRootDir;
    const definitions = buildChromeWorkerDefinitions(
      request.basePort,
      request.workerCount,
      host,
      rootDir
    );

    const launchedWorkers: ChromeWorkerLease[] = [];
    for (const definition of definitions) {
      this.assertWorkerIdAvailable(registry, definition.workerId);
      launchedWorkers.push(await this.launcher.launch(definition));
    }

    registry.workers = mergeWorkers(registry.workers, launchedWorkers);
    await this.saveRegistry(registry);
    return launchedWorkers;
  }

  async listWorkers(): Promise<ChromeWorkerLease[]> {
    const registry = await this.loadRegistry();
    registry.workers = await refreshWorkers(registry.workers);
    await this.saveRegistry(registry);
    return registry.workers;
  }

  async markReadyForAttach(workerIds: string[]): Promise<ChromeWorkerLease[]> {
    const registry = await this.loadRegistry();
    registry.workers = registry.workers.map((worker) =>
      workerIds.includes(worker.workerId) && worker.status !== "exited"
        ? { ...worker, status: "ready_for_attach" }
        : worker
    );
    await this.saveRegistry(registry);
    return registry.workers;
  }

  async stopWorkers(request: StopChromeWorkersRequest = {}): Promise<ChromeWorkerLease[]> {
    const registry = await this.loadRegistry();
    const workerIds = request.workerIds ?? registry.workers.map((worker) => worker.workerId);
    const stoppedWorkers: ChromeWorkerLease[] = [];

    for (const worker of registry.workers) {
      if (!workerIds.includes(worker.workerId)) {
        continue;
      }

      await stopWorkerProcess(worker.pid);
      if (request.deleteProfiles) {
        await fs.rm(worker.userDataDir, { recursive: true, force: true });
      }

      stoppedWorkers.push({
        ...worker,
        status: "exited"
      });
    }

    registry.workers = mergeWorkers(registry.workers, stoppedWorkers);
    await this.saveRegistry(registry);
    return registry.workers;
  }

  private assertWorkerIdAvailable(registry: ChromeWorkerRegistry, workerId: string): void {
    const existingWorker = registry.workers.find((worker) => worker.workerId === workerId);
    if (existingWorker && existingWorker.status !== "exited") {
      throw new ChromeLauncherError(`Worker ${workerId} is already registered.`);
    }
  }

  private async loadRegistry(): Promise<ChromeWorkerRegistry> {
    return await readChromeWorkerRegistry(this.registryPath);
  }

  private async saveRegistry(registry: ChromeWorkerRegistry): Promise<void> {
    await writeChromeWorkerRegistry(this.registryPath, registry);
  }
}

export async function refreshWorkers(workers: ChromeWorkerLease[]): Promise<ChromeWorkerLease[]> {
  const refreshedWorkers: ChromeWorkerLease[] = [];

  for (const worker of workers) {
    refreshedWorkers.push(await refreshWorker(worker));
  }

  return refreshedWorkers;
}

async function refreshWorker(worker: ChromeWorkerLease): Promise<ChromeWorkerLease> {
  const processAlive = isProcessAlive(worker.pid);
  const endpointReady = processAlive
    ? await isChromeDebuggerEndpointReady(worker.host, worker.port)
    : false;

  return {
    ...worker,
    status: resolveChromeWorkerStatus(worker.status, {
      endpointReady,
      processAlive
    })
  };
}

async function stopWorkerProcess(pid: number): Promise<void> {
  if (!isProcessAlive(pid)) {
    return;
  }

  process.kill(pid, "SIGTERM");
  await waitForProcessExit(pid, PROCESS_EXIT_WAIT_MS);

  if (!isProcessAlive(pid)) {
    return;
  }

  process.kill(pid, "SIGKILL");
  await waitForProcessExit(pid, PROCESS_EXIT_WAIT_MS);
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (!isProcessAlive(pid)) {
      return;
    }

    await delay(PROCESS_EXIT_POLL_INTERVAL_MS);
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function mergeWorkers(
  currentWorkers: ChromeWorkerLease[],
  nextWorkers: ChromeWorkerLease[]
): ChromeWorkerLease[] {
  const workerMap = new Map(currentWorkers.map((worker) => [worker.workerId, worker]));

  for (const worker of nextWorkers) {
    workerMap.set(worker.workerId, worker);
  }

  return Array.from(workerMap.values()).sort(compareWorkers);
}

function compareWorkers(left: ChromeWorkerLease, right: ChromeWorkerLease): number {
  return left.port - right.port || left.workerId.localeCompare(right.workerId);
}

export function resolveChromeWorkerRegistryPath(registryPath?: string): string {
  return registryPath ? path.resolve(registryPath) : DEFAULT_CHROME_WORKER_REGISTRY_PATH;
}

function buildLauncherOptions(options: ChromeWorkerPoolOptions): ConstructorParameters<
  typeof ChromeProcessLauncher
>[0] {
  return {
    chromeBinaryPath: options.chromeBinaryPath ?? DEFAULT_CHROME_BINARY_PATH,
    ...(options.launchTimeoutMs !== undefined ? { launchTimeoutMs: options.launchTimeoutMs } : {}),
    startUrl: options.startUrl ?? DEFAULT_CHROME_WORKER_START_URL
  };
}
