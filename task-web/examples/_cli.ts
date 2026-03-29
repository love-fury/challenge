import type { ConnectionOptions } from "../src/index.js";

export interface ExampleCliOptions {
  connectionOptions: ConnectionOptions;
  positionals: string[];
}

export function parseExampleCliOptions(argv: string[]): ExampleCliOptions {
  const args = [...argv];
  const positionals: string[] = [];
  const connectionOptions: ConnectionOptions = {};

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) {
      continue;
    }

    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const [flagName, inlineValue] = splitFlag(arg);
    const value = inlineValue ?? args.shift();

    switch (flagName) {
      case "host":
        if (value) {
          connectionOptions.host = value;
        }
        break;
      case "port":
        if (value) {
          const parsed = Number.parseInt(value, 10);
          if (Number.isNaN(parsed)) {
            throw new Error(`Invalid --port value: ${value}`);
          }
          connectionOptions.port = parsed;
        }
        break;
      case "target-id":
        if (value) {
          connectionOptions.targetId = value;
        }
        break;
      case "target-url-pattern":
        if (value) {
          connectionOptions.targetUrlPattern = value;
        }
        break;
      case "target-title-pattern":
        if (value) {
          connectionOptions.targetTitlePattern = value;
        }
        break;
      case "timeout-ms":
        if (value) {
          const parsed = Number.parseInt(value, 10);
          if (Number.isNaN(parsed)) {
            throw new Error(`Invalid --timeout-ms value: ${value}`);
          }
          connectionOptions.timeoutMs = parsed;
        }
        break;
      default:
        throw new Error(`Unknown option: --${flagName}`);
    }
  }

  return {
    connectionOptions,
    positionals
  };
}

function splitFlag(flag: string): [string, string | undefined] {
  const stripped = flag.slice(2);
  const separatorIndex = stripped.indexOf("=");
  if (separatorIndex === -1) {
    return [stripped, undefined];
  }

  return [stripped.slice(0, separatorIndex), stripped.slice(separatorIndex + 1)];
}
