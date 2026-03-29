// Repro:
// npx tsx research/hancom/05-static-deob/examples/promote-curated-corpus.ts \
//   tmp/discovery/05-static-deob/full-mirror-doc1-all

import fs from "node:fs/promises";
import path from "node:path";

import {
  deriveStaticDeobBuildId,
  promoteCuratedStaticDeobCorpus,
  writeStaticDeobArtifactsIndex
} from "../src/corpusPromotion.js";

async function main(): Promise<void> {
  const sourceArtifactRoot =
    process.argv[2] ?? "tmp/discovery/05-static-deob/full-mirror-doc1-all";
  const sourceReportPath = path.join(sourceArtifactRoot, "full-mirror-report.json");
  const sourceReport = JSON.parse(await fs.readFile(sourceReportPath, "utf8")) as {
    mainBundleUrl: string;
  };
  const buildId = deriveStaticDeobBuildId(sourceReport.mainBundleUrl);
  const destinationArtifactRoot = process.argv[3] ?? path.join("artifacts", "static-deob", buildId);
  const manifest = await promoteCuratedStaticDeobCorpus(
    sourceArtifactRoot,
    destinationArtifactRoot
  );
  const artifactsReadmePath = await writeStaticDeobArtifactsIndex("artifacts");

  console.log(
    JSON.stringify(
      {
        sourceArtifactRoot,
        destinationArtifactRoot,
        artifactsReadmePath,
        promotionManifestPath: path.join(destinationArtifactRoot, "promotion-manifest.json"),
        selectedEntryCount: manifest.selectedEntries.length,
        curatedHeuristicPartKeys: manifest.curatedHeuristicPartKeys
      },
      null,
      2
    )
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
