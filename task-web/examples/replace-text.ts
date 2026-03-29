import { HancomDocsClient } from "../src/index.js";
import { parseExampleCliOptions } from "./_cli.js";

async function main(): Promise<void> {
  const { connectionOptions, positionals } = parseExampleCliOptions(process.argv.slice(2));
  const [find, replace] = positionals;
  if (!find || replace === undefined) {
    throw new Error(
      'Usage: npm run example:replace -- [--port 9223] [--target-id <id>] "find" "replace"'
    );
  }

  const client = await HancomDocsClient.connect(connectionOptions);

  try {
    await client.replaceAll({ find, replace });
    await client.save();
    console.log(`Replaced "${find}" with "${replace}".`);
  } finally {
    await client.disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
