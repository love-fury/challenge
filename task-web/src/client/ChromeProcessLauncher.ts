import fs from "node:fs/promises";
import net from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { ChromeLauncherError } from "./errors.js";
import type { ChromeWorkerDefinition, ChromeWorkerLease } from "./chromeWorkers.js";

const DEFAULT_LAUNCH_TIMEOUT_MS = 15_000;
const ENDPOINT_POLL_INTERVAL_MS = 250;

export interface ChromeProcessLauncherOptions {
  chromeBinaryPath: string;
  launchTimeoutMs?: number;
  startUrl: string;
}

export class ChromeProcessLauncher {
  private readonly launchTimeoutMs: number;

  constructor(private readonly options: ChromeProcessLauncherOptions) {
    this.launchTimeoutMs = options.launchTimeoutMs ?? DEFAULT_LAUNCH_TIMEOUT_MS;
  }

  async launch(definition: ChromeWorkerDefinition): Promise<ChromeWorkerLease> {
    await assertChromeBinaryExists(this.options.chromeBinaryPath);
    await assertChromeDebuggerPortAvailable(definition.host, definition.port);
    await fs.mkdir(definition.userDataDir, { recursive: true });

    const child = spawn(this.options.chromeBinaryPath, buildChromeLaunchArgs(definition, this.options), {
      detached: true,
      stdio: "ignore"
    });

    child.unref();

    const pid = child.pid;
    if (!pid) {
      throw new ChromeLauncherError(`Chrome did not report a PID for worker ${definition.workerId}.`);
    }

    await waitForDebuggerEndpoint(definition.host, definition.port, this.launchTimeoutMs);

    return {
      workerId: definition.workerId,
      chromeBinaryPath: this.options.chromeBinaryPath,
      host: definition.host,
      pid,
      port: definition.port,
      startUrl: this.options.startUrl,
      startedAt: new Date().toISOString(),
      status: "ready_for_login",
      userDataDir: definition.userDataDir
    };
  }
}

export async function assertChromeBinaryExists(chromeBinaryPath: string): Promise<void> {
  try {
    await fs.access(chromeBinaryPath);
  } catch {
    throw new ChromeLauncherError(`Chrome binary was not found at ${chromeBinaryPath}.`);
  }
}

export async function assertChromeDebuggerPortAvailable(host: string, port: number): Promise<void> {
  const available = await isTcpPortAvailable(host, port);
  if (!available) {
    throw new ChromeLauncherError(`CDP port ${host}:${port} is already in use.`);
  }
}

export async function isChromeDebuggerEndpointReady(host: string, port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://${host}:${port}/json/version`, {
      signal: AbortSignal.timeout(1_000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForDebuggerEndpoint(host: string, port: number, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isChromeDebuggerEndpointReady(host, port)) {
      return;
    }

    await delay(ENDPOINT_POLL_INTERVAL_MS);
  }

  throw new ChromeLauncherError(`Timed out waiting for Chrome debugger on ${host}:${port}.`);
}

function buildChromeLaunchArgs(
  definition: ChromeWorkerDefinition,
  options: ChromeProcessLauncherOptions
): string[] {
  return [
    `--remote-debugging-port=${definition.port}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${definition.userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    options.startUrl
  ];
}

function isTcpPortAvailable(host: string, port: number): Promise<boolean> {
  return awaitable((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

function awaitable<T>(executor: (resolve: (value: T) => void) => void): Promise<T> {
  return new Promise((resolve) => executor(resolve));
}
