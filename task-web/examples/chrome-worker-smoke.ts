import { ChromeWorkerPool } from "../src/client/ChromeWorkerPool.js";
import { HancomDocsClient } from "../src/index.js";

interface ChromeWorkerSmokeOptions {
  command: "read" | "text" | "structure";
  registryPath?: string;
  workerId?: string;
}

async function main(): Promise<void> {
  const options = parseChromeWorkerSmokeOptions(process.argv.slice(2));
  const pool = new ChromeWorkerPool(
    options.registryPath === undefined ? {} : { registryPath: options.registryPath }
  );
  const worker = await resolveAttachWorker(pool, options.workerId);
  const client = await HancomDocsClient.connect({
    host: worker.host,
    port: worker.port
  });

  try {
    printJson(await runCommand(client, worker.workerId, options));
  } finally {
    await client.disconnect();
  }
}

async function runCommand(
  client: HancomDocsClient,
  workerId: string,
  options: ChromeWorkerSmokeOptions
): Promise<unknown> {
  switch (options.command) {
    case "read":
      return {
        workerId,
        document: await client.readDocument()
      };
    case "text":
      return {
        workerId,
        text: await client.readText()
      };
    case "structure":
      return {
        workerId,
        blocks: await client.readStructure()
      };
  }
}

async function resolveAttachWorker(
  pool: ChromeWorkerPool,
  explicitWorkerId?: string
): Promise<Awaited<ReturnType<ChromeWorkerPool["listWorkers"]>>[number]> {
  const workers = await pool.listWorkers();
  const worker =
    explicitWorkerId === undefined
      ? workers.find((candidate) => candidate.status === "ready_for_attach")
      : workers.find((candidate) => candidate.workerId === explicitWorkerId);

  if (!worker) {
    throw new Error(
      explicitWorkerId === undefined
        ? "No ready_for_attach Chrome worker found. Launch one and mark it ready first."
        : `Worker ${explicitWorkerId} was not found in the registry.`
    );
  }

  if (worker.status !== "ready_for_attach") {
    throw new Error(
      `Worker ${worker.workerId} is ${worker.status}. Mark it ready before running this example.`
    );
  }

  return worker;
}

function parseChromeWorkerSmokeOptions(argv: string[]): ChromeWorkerSmokeOptions {
  const args = [...argv];
  const command = parseCommand(args.shift());
  const options: ChromeWorkerSmokeOptions = { command };

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) {
      continue;
    }

    if (!arg.startsWith("--")) {
      throw new Error(usage());
    }

    const [flagName, inlineValue] = splitFlag(arg);
    const value = inlineValue ?? args.shift();

    switch (flagName) {
      case "registry-path":
        options.registryPath = requireString(flagName, value);
        break;
      case "worker-id":
        options.workerId = requireString(flagName, value);
        break;
      default:
        throw new Error(`Unknown option: --${flagName}\n\n${usage()}`);
    }
  }

  return options;
}

function parseCommand(
  value: string | undefined
): ChromeWorkerSmokeOptions["command"] {
  switch (value) {
    case "read":
    case "text":
    case "structure":
      return value;
    default:
      throw new Error(usage());
  }
}

function requireString(flagName: string, value: string | undefined): string {
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

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function usage(): string {
  return [
    "Usage:",
    "  npm run example:chrome-worker-smoke -- read [--worker-id chrome-9333] [--registry-path <path>]",
    "  npm run example:chrome-worker-smoke -- text [--worker-id chrome-9333] [--registry-path <path>]",
    "  npm run example:chrome-worker-smoke -- structure [--worker-id chrome-9333] [--registry-path <path>]"
  ].join("\n");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
