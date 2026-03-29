import { EditorDiscoveryError } from "./errors.js";
import type { ChromeTargetInfo, ConnectionOptions } from "../models/types.js";

interface ChromeTargetApiResponse {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 9222;
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_HANCOM_URL_PATTERN = "webhwp.hancomdocs.com/webhwp";

export async function listChromeTargets(options: ConnectionOptions = {}): Promise<ChromeTargetInfo[]> {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const endpoint = `http://${host}:${port}/json/list`;
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    throw new EditorDiscoveryError(`Failed to fetch Chrome targets from ${endpoint} (${response.status}).`);
  }

  const payload = (await response.json()) as ChromeTargetApiResponse[];

  return payload
    .filter((target) => target.webSocketDebuggerUrl)
    .map((target) => ({
      id: target.id,
      type: target.type,
      title: target.title,
      url: target.url,
      webSocketDebuggerUrl: target.webSocketDebuggerUrl ?? ""
    }));
}

export async function discoverChromeTarget(
  options: ConnectionOptions = {}
): Promise<ChromeTargetInfo> {
  const targets = await listChromeTargets(options);

  if (targets.length === 0) {
    throw new EditorDiscoveryError("No debuggable Chrome targets were found.");
  }

  if (options.targetId) {
    const explicitTarget = targets.find((target) => target.id === options.targetId);
    if (!explicitTarget) {
      throw new EditorDiscoveryError(`Could not find Chrome target ${options.targetId}.`);
    }

    return explicitTarget;
  }

  const urlPattern = options.targetUrlPattern ?? DEFAULT_HANCOM_URL_PATTERN;
  const titlePattern = options.targetTitlePattern;
  const matchedTarget =
    targets.find((target) => target.type === "page" && matchesPattern(target.url, urlPattern)) ??
    targets.find(
      (target) =>
        target.type === "page" &&
        titlePattern !== undefined &&
        titlePattern.length > 0 &&
        matchesPattern(target.title, titlePattern)
    );

  if (!matchedTarget) {
    const availableTargets = targets
      .filter((target) => target.type === "page")
      .map((target) => `${target.title || "<untitled>"} <${target.url}>`)
      .join(", ");

    throw new EditorDiscoveryError(
      `Could not find a Hancom Docs editor tab. Available page targets: ${availableTargets}.`
    );
  }

  return matchedTarget;
}

function matchesPattern(value: string, pattern: string): boolean {
  return value.toLocaleLowerCase().includes(pattern.toLocaleLowerCase());
}
