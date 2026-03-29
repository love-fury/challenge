import fs from "node:fs/promises";
import path from "node:path";

import type { ChromeWorkerRegistry } from "./chromeWorkers.js";

export async function readChromeWorkerRegistry(registryPath: string): Promise<ChromeWorkerRegistry> {
  try {
    const payload = await fs.readFile(registryPath, "utf8");
    return parseChromeWorkerRegistry(payload);
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return { workers: [] };
    }

    throw error;
  }
}

export async function writeChromeWorkerRegistry(
  registryPath: string,
  registry: ChromeWorkerRegistry
): Promise<void> {
  await fs.mkdir(path.dirname(registryPath), { recursive: true });
  await fs.writeFile(registryPath, serializeChromeWorkerRegistry(registry));
}

export function parseChromeWorkerRegistry(payload: string): ChromeWorkerRegistry {
  const parsed = JSON.parse(payload) as Partial<ChromeWorkerRegistry>;
  return {
    workers: Array.isArray(parsed.workers) ? parsed.workers : []
  };
}

export function serializeChromeWorkerRegistry(registry: ChromeWorkerRegistry): string {
  return JSON.stringify(registry, null, 2);
}

function isMissingFileError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return "code" in error && error.code === "ENOENT";
}
