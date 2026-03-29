// Repro:
// npx tsx examples/discovery/05-static-deob/entrypoint-hunt.ts --port 9223 --target-id <chrome-target-id>

import fs from "node:fs/promises";
import path from "node:path";

import { discoverChromeTarget } from "../../../src/client/chromeDiscovery.js";
import { CdpSession } from "../../../src/client/CdpSession.js";
import {
  downloadStaticBundle,
  pageCollectStaticBundleSurface,
  selectPrimaryBundleUrl
} from "../../../src/hancom/discovery/05-static-deob/bundleFetch.js";
import {
  buildStaticModuleManifest,
  splitStaticCandidates
} from "../../../src/hancom/discovery/05-static-deob/entryPointScanner.js";
import type {
  StaticBundleSurface,
  StaticEntryPointReport
} from "../../../src/hancom/discovery/05-static-deob/model.js";
import { runWebcrackCli } from "../../../src/hancom/discovery/05-static-deob/webcrackRunner.js";
import { serializePageFunctionCall } from "../../../src/hancom/evaluation.js";
import { parseExampleCliOptions } from "../../_cli.js";

async function main(): Promise<void> {
  const { connectionOptions, positionals } = parseExampleCliOptions(process.argv.slice(2));
  const target = await discoverChromeTarget(connectionOptions);
  const session = new CdpSession();
  await session.connect(target.webSocketDebuggerUrl);

  try {
    const bundleSurface = parseStaticBundleSurface(
      await session.evaluate(serializePageFunctionCall(pageCollectStaticBundleSurface))
    );
    const bundleSelection = selectPrimaryBundleUrl(bundleSurface);
    if (bundleSelection.selectedBundleUrl === null) {
      throw new Error(bundleSelection.notes.join(" "));
    }

    const downloadedBundle = await downloadStaticBundle(bundleSelection.selectedBundleUrl);
    const artifactRoot =
      positionals[0] ??
      path.join(
        "tmp/discovery/05-static-deob",
        `entrypoint-hunt-${new Date().toISOString().replace(/[:.]/g, "-")}-${target.id.slice(0, 8)}`
      );
    const rawBundlePath = path.join(artifactRoot, "raw-bundle.js");
    const deobOutputPath = path.join(artifactRoot, "webcrack-output");
    const manifestPath = path.join(artifactRoot, "module-manifest.json");
    const reportPath = path.join(artifactRoot, "candidate-report.json");
    const bundleSurfacePath = path.join(artifactRoot, "bundle-surface.json");
    const webcrackResultPath = path.join(artifactRoot, "webcrack-result.json");

    await fs.mkdir(artifactRoot, {
      recursive: true
    });
    await fs.writeFile(bundleSurfacePath, JSON.stringify(bundleSurface, null, 2));
    await fs.writeFile(rawBundlePath, downloadedBundle.sourceText);

    const webcrackResult = await runWebcrackCli(rawBundlePath, deobOutputPath);
    await fs.writeFile(webcrackResultPath, JSON.stringify(webcrackResult, null, 2));

    const scanRoot = webcrackResult.success ? deobOutputPath : rawBundlePath;
    const manifest = await buildStaticModuleManifest(scanRoot);
    const splitCandidates = splitStaticCandidates(manifest);
    const notes = [...bundleSelection.notes];
    if (!webcrackResult.success) {
      notes.push("webcrack failed; candidate scan fell back to the raw bundle artifact.");
    }

    const report: StaticEntryPointReport = {
      generatedAt: new Date().toISOString(),
      pageUrl: bundleSurface.pageUrl,
      title: bundleSurface.title,
      selectedBundleUrl: bundleSelection.selectedBundleUrl,
      rawBundlePath,
      rawBundleSha256: downloadedBundle.sourceHashSha256,
      deobOutputPath,
      usedFallbackScanRoot: !webcrackResult.success,
      candidateCount: manifest.length,
      readExportCandidates: splitCandidates.readExportCandidates,
      writeCommandCandidates: splitCandidates.writeCommandCandidates,
      notes
    };

    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(
      JSON.stringify(
        {
          artifactRoot,
          rawBundlePath,
          deobOutputPath,
          manifestPath,
          reportPath,
          selectedBundleUrl: bundleSelection.selectedBundleUrl,
          rawBundleSha256: downloadedBundle.sourceHashSha256,
          rawBundleBytes: downloadedBundle.sourceBytes,
          webcrackSuccess: webcrackResult.success,
          topReadExportCandidates: splitCandidates.readExportCandidates.slice(0, 5),
          topWriteCommandCandidates: splitCandidates.writeCommandCandidates.slice(0, 5),
          notes
        },
        null,
        2
      )
    );
  } finally {
    await session.close();
  }
}

function parseStaticBundleSurface(value: unknown): StaticBundleSurface {
  if (!isRecord(value)) {
    throw new Error("Static bundle surface probe did not return an object.");
  }

  const { title, pageUrl, scriptUrls, resourceScriptUrls, chunkGlobals } = value;
  if (
    typeof title !== "string" ||
    typeof pageUrl !== "string" ||
    !isStringArray(scriptUrls) ||
    !isStringArray(resourceScriptUrls) ||
    !isStringArray(chunkGlobals)
  ) {
    throw new Error("Static bundle surface probe returned an unexpected shape.");
  }

  return {
    title,
    pageUrl,
    scriptUrls,
    resourceScriptUrls,
    chunkGlobals
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
