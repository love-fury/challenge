// Repro:
// npx tsx examples/discovery/05-static-deob/mirror-full-bundle.ts --port 9223 --target-id <chrome-target-id>

import fs from "node:fs/promises";
import path from "node:path";

import { discoverChromeTarget } from "../../../src/client/chromeDiscovery.js";
import { CdpSession } from "../../../src/client/CdpSession.js";
import {
  downloadStaticBundle,
  pageCollectStaticBundleSurface,
  selectPrimaryBundleUrl
} from "../../../src/hancom/discovery/05-static-deob/bundleFetch.js";
import type { StaticBundleSurface } from "../../../src/hancom/discovery/05-static-deob/model.js";
import { createReadableBundleLayout } from "../../../src/hancom/discovery/05-static-deob/readableBundleLayout.js";
import { mirrorWebpackBundle } from "../../../src/hancom/discovery/05-static-deob/webpackBundleMirror.js";
import { serializePageFunctionCall } from "../../../src/hancom/evaluation.js";
import { parseExampleCliOptions } from "../../_cli.js";

async function main(): Promise<void> {
  const { connectionOptions, positionals } = parseExampleCliOptions(process.argv.slice(2));
  const target = await discoverChromeTarget(connectionOptions);
  const session = new CdpSession();
  await session.connect(target.webSocketDebuggerUrl);

  try {
    const bundleSurface = await session.evaluate<StaticBundleSurface>(
      serializePageFunctionCall(pageCollectStaticBundleSurface)
    );
    const bundleSelection = selectPrimaryBundleUrl(bundleSurface);
    if (bundleSelection.selectedBundleUrl === null) {
      throw new Error(bundleSelection.notes.join(" "));
    }

    const downloadedMainBundle = await downloadStaticBundle(bundleSelection.selectedBundleUrl);
    const artifactRoot =
      positionals[0] ??
      path.join(
        "tmp/discovery/05-static-deob",
        `full-mirror-${new Date().toISOString().replace(/[:.]/g, "-")}-${target.id.slice(0, 8)}`
      );
    await fs.mkdir(artifactRoot, {
      recursive: true
    });
    await fs.writeFile(
      path.join(artifactRoot, "bundle-surface.json"),
      JSON.stringify(bundleSurface, null, 2)
    );

    const mirrorReport = await mirrorWebpackBundle(
      bundleSelection.selectedBundleUrl,
      downloadedMainBundle.sourceText,
      artifactRoot
    );
    const readableLayout = await createReadableBundleLayout(artifactRoot, mirrorReport);
    const reportPath = path.join(artifactRoot, "full-mirror-report.json");
    await fs.writeFile(reportPath, JSON.stringify(mirrorReport, null, 2));

    console.log(
      JSON.stringify(
        {
          artifactRoot,
          reportPath,
          mainBundleUrl: mirrorReport.mainBundleUrl,
          rawMainBundlePath: mirrorReport.mainBundlePath,
          chunkCount: mirrorReport.chunkCount,
          fetchedChunkCount: mirrorReport.fetchedChunks.length,
          failedChunkCount: mirrorReport.failedChunks.length,
          deobfuscatedMainPath: path.join(artifactRoot, "deobfuscated", "main", "deobfuscated.js"),
          deobfuscatedChunkRoot: path.join(artifactRoot, "deobfuscated", "chunks"),
          readableRoot: readableLayout.readableRoot,
          readmePath: readableLayout.readmePath,
          moduleRoot: readableLayout.moduleLayout.moduleRoot,
          moduleIndexPath: readableLayout.moduleLayout.indexPath,
          extractedModuleCount: readableLayout.moduleLayout.totalModuleCount,
          heuristicRoot: readableLayout.heuristicLayout.heuristicRoot,
          heuristicIndexPath: readableLayout.heuristicLayout.indexPath,
          heuristicReadmePath: readableLayout.heuristicLayout.readmePath,
          heuristicModuleCount: readableLayout.heuristicLayout.moduleCount,
          failedChunks: mirrorReport.failedChunks
        },
        null,
        2
      )
    );
  } finally {
    await session.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
