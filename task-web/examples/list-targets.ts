import { listChromeTargets } from "../src/client/chromeDiscovery.js";
import { parseExampleCliOptions } from "./_cli.js";

async function main(): Promise<void> {
  const { connectionOptions } = parseExampleCliOptions(process.argv.slice(2));
  const targets = await listChromeTargets(connectionOptions);

  console.log(
    JSON.stringify(
      targets.map((target) => ({
        id: target.id,
        type: target.type,
        title: target.title,
        url: target.url
      })),
      null,
      2
    )
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
