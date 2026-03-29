import { ChromeWorkerPool } from "../src/client/ChromeWorkerPool.js";
import { parseChromeWorkerCliOptions } from "./_chromeWorkersCli.js";

async function main(): Promise<void> {
  const options = parseChromeWorkerCliOptions(process.argv.slice(2));
  const pool = new ChromeWorkerPool(buildPoolOptions(options));

  switch (options.command) {
    case "launch":
      printJson(await pool.launchWorkers(buildLaunchRequest(options)));
      return;
    case "list":
      printJson(await pool.listWorkers());
      return;
    case "mark-ready":
      printJson(await pool.markReadyForAttach(await resolveWorkerIds(pool, options.workerIds)));
      return;
    case "stop":
      printJson(
        await pool.stopWorkers({
          deleteProfiles: options.deleteProfiles,
          workerIds: options.workerIds
        })
      );
      return;
  }
}

async function resolveWorkerIds(pool: ChromeWorkerPool, workerIds: string[]): Promise<string[]> {
  if (workerIds.length > 0) {
    return workerIds;
  }

  const workers = await pool.listWorkers();
  return workers.map((worker) => worker.workerId);
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function buildPoolOptions(
  options: ReturnType<typeof parseChromeWorkerCliOptions>
): ConstructorParameters<typeof ChromeWorkerPool>[0] {
  return {
    ...(options.chromeBinaryPath ? { chromeBinaryPath: options.chromeBinaryPath } : {}),
    ...(options.host ? { host: options.host } : {}),
    ...(options.launchTimeoutMs !== undefined ? { launchTimeoutMs: options.launchTimeoutMs } : {}),
    ...(options.registryPath ? { registryPath: options.registryPath } : {}),
    ...(options.startUrl ? { startUrl: options.startUrl } : {}),
    ...(options.userDataRootDir ? { userDataRootDir: options.userDataRootDir } : {})
  };
}

function buildLaunchRequest(
  options: ReturnType<typeof parseChromeWorkerCliOptions>
): Parameters<ChromeWorkerPool["launchWorkers"]>[0] {
  return {
    basePort: options.basePort,
    ...(options.chromeBinaryPath ? { chromeBinaryPath: options.chromeBinaryPath } : {}),
    ...(options.host ? { host: options.host } : {}),
    ...(options.launchTimeoutMs !== undefined ? { launchTimeoutMs: options.launchTimeoutMs } : {}),
    ...(options.registryPath ? { registryPath: options.registryPath } : {}),
    ...(options.startUrl ? { startUrl: options.startUrl } : {}),
    ...(options.userDataRootDir ? { userDataRootDir: options.userDataRootDir } : {}),
    workerCount: options.workerCount
  };
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
