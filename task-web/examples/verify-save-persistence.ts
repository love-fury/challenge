import { HancomDocsClient } from "../src/index.js";
import { parseExampleCliOptions } from "./_cli.js";

async function main(): Promise<void> {
  const { connectionOptions, positionals } = parseExampleCliOptions(process.argv.slice(2));
  const [find, replace] = positionals;
  if (!find || replace === undefined) {
    throw new Error(
      'Usage: npm run example:verify-save -- [--port 9223] [--target-id <id>] "find" "replace"\n\nUse only against a disposable document copy. The script mutates the document, saves it, reconnects, and verifies the saved text persisted.'
    );
  }

  const client = await HancomDocsClient.connect(connectionOptions);
  let mutatedText = "";
  let replaceResult: Awaited<ReturnType<HancomDocsClient["replaceAll"]>> | null = null;
  let saveResult: Awaited<ReturnType<HancomDocsClient["save"]>> | null = null;
  let initialText = "";

  try {
    initialText = await client.readText();
    if (!initialText.includes(find)) {
      throw new Error(`Initial document text does not contain the requested find string: ${JSON.stringify(find)}`);
    }

    replaceResult = await client.replaceAll({ find, replace });
    mutatedText = await client.readText();
    if (mutatedText === initialText) {
      throw new Error("replaceAll did not change the read-back text before save.");
    }
    if (!mutatedText.includes(replace)) {
      throw new Error(`Mutated document text does not contain the requested replacement string: ${JSON.stringify(replace)}`);
    }

    saveResult = await client.save({ timeoutMs: 2000 });
  } finally {
    await client.disconnect();
  }

  const reconnectedClient = await HancomDocsClient.connect(connectionOptions);
  try {
    const reloadedText = await reconnectedClient.readText();
    if (reloadedText !== mutatedText) {
      throw new Error(
        `Reloaded document text did not match the saved text.\nExpected length=${mutatedText.length}, actual length=${reloadedText.length}`
      );
    }

    printJson({
      verified: true,
      find,
      replace,
      initialLength: initialText.length,
      savedLength: mutatedText.length,
      reloadLength: reloadedText.length,
      replaceResult,
      saveResult
    });
  } finally {
    await reconnectedClient.disconnect();
  }
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
