import { HancomDocsClient } from "../src/index.js";
import { parseExampleCliOptions } from "./_cli.js";

async function main(): Promise<void> {
  const { connectionOptions } = parseExampleCliOptions(process.argv.slice(2));
  const client = await HancomDocsClient.connect(connectionOptions);

  try {
    console.log("Target:", client.target.title || client.target.url);
    const text = await client.readText();
    console.log("Document text:");
    console.log(text);
  } finally {
    await client.disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
