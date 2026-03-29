import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { StaticWebcrackRunResult } from "./model.js";

const execFileAsync = promisify(execFile);

export async function runWebcrackCli(
  inputFilePath: string,
  outputPath: string
): Promise<StaticWebcrackRunResult> {
  const command = [
    "--yes",
    "webcrack@latest",
    inputFilePath,
    "--output",
    outputPath,
    "--force"
  ];

  try {
    const { stdout, stderr } = await execFileAsync("npx", command, {
      maxBuffer: 16 * 1024 * 1024,
      timeout: 120_000
    });

    return {
      command: ["npx", ...command],
      success: true,
      outputPath,
      stdout,
      stderr
    };
  } catch (error) {
    const typedError = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
    };

    return {
      command: ["npx", ...command],
      success: false,
      outputPath,
      stdout: typedError.stdout ?? "",
      stderr: typedError.stderr ?? typedError.message
    };
  }
}
