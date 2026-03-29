import path from "node:path";

export const DEFAULT_CHROME_BINARY_PATH =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const DEFAULT_CHROME_WORKER_HOST = "127.0.0.1";
export const DEFAULT_CHROME_WORKER_START_URL = "https://www.hancomdocs.com";
export const DEFAULT_CHROME_WORKER_ROOT_DIR = path.resolve("tmp/chrome-workers");
export const DEFAULT_CHROME_WORKER_REGISTRY_PATH = path.join(
  DEFAULT_CHROME_WORKER_ROOT_DIR,
  "registry.json"
);

export type ChromeWorkerStatus =
  | "launching"
  | "ready_for_login"
  | "ready_for_attach"
  | "exited"
  | "failed";

export interface ChromeWorkerLease {
  workerId: string;
  chromeBinaryPath: string;
  host: string;
  pid: number;
  port: number;
  startUrl: string;
  startedAt: string;
  status: ChromeWorkerStatus;
  userDataDir: string;
}

export interface ChromeWorkerDefinition {
  workerId: string;
  host: string;
  port: number;
  userDataDir: string;
}

export interface ChromeWorkerRegistry {
  workers: ChromeWorkerLease[];
}

export interface ChromeWorkerPoolOptions {
  chromeBinaryPath?: string;
  host?: string;
  launchTimeoutMs?: number;
  registryPath?: string;
  startUrl?: string;
  userDataRootDir?: string;
}

export interface LaunchChromeWorkersRequest extends ChromeWorkerPoolOptions {
  basePort: number;
  workerCount: number;
}

export interface StopChromeWorkersRequest {
  deleteProfiles?: boolean;
  workerIds?: string[];
}

export interface ChromeWorkerHealthSnapshot {
  endpointReady: boolean;
  processAlive: boolean;
}

export function buildChromeWorkerId(port: number): string {
  return `chrome-${port}`;
}

export function buildChromeWorkerUserDataDir(rootDir: string, workerId: string): string {
  return path.join(rootDir, workerId);
}

export function buildChromeWorkerDefinitions(
  basePort: number,
  workerCount: number,
  host: string,
  userDataRootDir: string
): ChromeWorkerDefinition[] {
  return Array.from({ length: workerCount }, (_, index) => {
    const port = basePort + index;
    const workerId = buildChromeWorkerId(port);

    return {
      workerId,
      host,
      port,
      userDataDir: buildChromeWorkerUserDataDir(userDataRootDir, workerId)
    };
  });
}

export function resolveChromeWorkerStatus(
  currentStatus: ChromeWorkerStatus,
  health: ChromeWorkerHealthSnapshot
): ChromeWorkerStatus {
  if (!health.processAlive) {
    return "exited";
  }

  if (!health.endpointReady) {
    return "failed";
  }

  if (currentStatus === "ready_for_attach") {
    return "ready_for_attach";
  }

  return "ready_for_login";
}
