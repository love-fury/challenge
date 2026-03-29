export interface ChromeWorkerCliOptions {
  command: "launch" | "list" | "mark-ready" | "stop";
  basePort: number;
  chromeBinaryPath?: string;
  deleteProfiles: boolean;
  host?: string;
  launchTimeoutMs?: number;
  registryPath?: string;
  startUrl?: string;
  userDataRootDir?: string;
  workerCount: number;
  workerIds: string[];
}

export function parseChromeWorkerCliOptions(argv: string[]): ChromeWorkerCliOptions {
  const args = [...argv];
  const command = parseCommand(args.shift());
  const options: ChromeWorkerCliOptions = {
    basePort: 9222,
    command,
    deleteProfiles: false,
    workerCount: 1,
    workerIds: []
  };

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) {
      continue;
    }

    if (!arg.startsWith("--")) {
      options.workerIds.push(arg);
      continue;
    }

    const [flagName, inlineValue] = splitFlag(arg);
    if (flagName === "delete-profiles") {
      options.deleteProfiles = true;
      continue;
    }

    const value = inlineValue ?? args.shift();
    assignFlag(options, flagName, value);
  }

  return options;
}

function parseCommand(
  value: string | undefined
): "launch" | "list" | "mark-ready" | "stop" {
  switch (value) {
    case "launch":
    case "list":
    case "mark-ready":
    case "stop":
      return value;
    default:
      throw new Error("Usage: chrome-workers.ts <launch|list|mark-ready|stop> [options] [worker-id...]");
  }
}

function assignFlag(
  options: ChromeWorkerCliOptions,
  flagName: string,
  value: string | undefined
): void {
  switch (flagName) {
    case "base-port":
      options.basePort = parseNumberFlag(flagName, value);
      break;
    case "worker-count":
      options.workerCount = parseNumberFlag(flagName, value);
      break;
    case "chrome-binary-path":
      options.chromeBinaryPath = parseStringFlag(flagName, value);
      break;
    case "host":
      options.host = parseStringFlag(flagName, value);
      break;
    case "launch-timeout-ms":
      options.launchTimeoutMs = parseNumberFlag(flagName, value);
      break;
    case "registry-path":
      options.registryPath = parseStringFlag(flagName, value);
      break;
    case "start-url":
      options.startUrl = parseStringFlag(flagName, value);
      break;
    case "user-data-root-dir":
      options.userDataRootDir = parseStringFlag(flagName, value);
      break;
    default:
      throw new Error(`Unknown option: --${flagName}`);
  }
}

function parseNumberFlag(flagName: string, value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid --${flagName} value: ${value}`);
  }

  return parsed;
}

function parseStringFlag(flagName: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing --${flagName} value.`);
  }

  return value;
}

function splitFlag(flag: string): [string, string | undefined] {
  const stripped = flag.slice(2);
  const separatorIndex = stripped.indexOf("=");
  if (separatorIndex === -1) {
    return [stripped, undefined];
  }

  return [stripped.slice(0, separatorIndex), stripped.slice(separatorIndex + 1)];
}
