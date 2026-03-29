import fs from "node:fs/promises";
import path from "node:path";

import {
  createHeuristicReconstruction,
  type HeuristicReconstructionLayout
} from "./heuristicReconstruction.js";
import type { WebpackBundleMirrorReport } from "./webpackBundleMirror.js";
import {
  materializeWebpackModuleContainers,
  type WebpackModuleExtractionLayout
} from "./webpackModuleExtractor.js";

interface ReadableChunkSummary {
  chunkId: number;
  chunkName: string;
  category: "core" | "locale" | "font" | "misc";
  bytes: number;
  rawFilePath: string;
  deobfuscatedFilePath: string | null;
}

export async function createReadableBundleLayout(
  artifactRoot: string,
  report: WebpackBundleMirrorReport
): Promise<{
  readmePath: string;
  readableRoot: string;
  chunkSummaries: ReadableChunkSummary[];
  moduleLayout: WebpackModuleExtractionLayout;
  heuristicLayout: HeuristicReconstructionLayout;
}> {
  const readableRoot = path.join(artifactRoot, "readable");
  const readableChunksRoot = path.join(readableRoot, "chunks");
  await fs.mkdir(readableChunksRoot, {
    recursive: true
  });

  const mainSourcePath = path.join(artifactRoot, "deobfuscated", "main", "deobfuscated.js");
  const mainReadablePath = path.join(readableRoot, "main.deobfuscated.js");
  await fs.copyFile(mainSourcePath, mainReadablePath);

  const chunkSummaries: ReadableChunkSummary[] = [];
  for (const chunk of report.fetchedChunks) {
    const chunkName = readChunkName(chunk.fileName);
    const category = classifyChunk(chunkName);
    const deobfuscatedFilePath = path.join(
      artifactRoot,
      "deobfuscated",
      "chunks",
      String(chunk.chunkId),
      "deobfuscated.js"
    );
    const readableName = `${chunk.chunkId}-${sanitizeChunkName(chunkName)}.deobfuscated.js`;
    const readablePath = path.join(readableChunksRoot, readableName);

    try {
      await fs.copyFile(deobfuscatedFilePath, readablePath);
      chunkSummaries.push({
        chunkId: chunk.chunkId,
        chunkName,
        category,
        bytes: chunk.bytes,
        rawFilePath: chunk.rawFilePath,
        deobfuscatedFilePath: readablePath
      });
    } catch {
      chunkSummaries.push({
        chunkId: chunk.chunkId,
        chunkName,
        category,
        bytes: chunk.bytes,
        rawFilePath: chunk.rawFilePath,
        deobfuscatedFilePath: null
      });
    }
  }

  const moduleLayout = await materializeWebpackModuleContainers(artifactRoot, [
    {
      containerKind: "main",
      chunkIds: [],
      sourcePath: mainReadablePath
    },
    ...chunkSummaries
      .filter((chunk): chunk is ReadableChunkSummary & { deobfuscatedFilePath: string } => {
        return chunk.deobfuscatedFilePath !== null;
      })
      .map((chunk) => ({
        containerKind: "chunk" as const,
        chunkIds: [chunk.chunkId],
        sourcePath: chunk.deobfuscatedFilePath
      }))
  ]);
  const heuristicLayout = await createHeuristicReconstruction(artifactRoot, moduleLayout);

  const readmePath = path.join(artifactRoot, "README.md");
  await fs.writeFile(
    readmePath,
    buildReadableReadme(artifactRoot, report, chunkSummaries, moduleLayout, heuristicLayout)
  );

  return {
    readmePath,
    readableRoot,
    chunkSummaries,
    moduleLayout,
    heuristicLayout
  };
}

function buildReadableReadme(
  artifactRoot: string,
  report: WebpackBundleMirrorReport,
  chunkSummaries: readonly ReadableChunkSummary[],
  moduleLayout: WebpackModuleExtractionLayout,
  heuristicLayout: HeuristicReconstructionLayout
): string {
  const mainDeobPath = path.join(artifactRoot, "readable", "main.deobfuscated.js");
  const mainModuleContainer = moduleLayout.containers.find((container) => container.containerKind === "main");
  const coreChunks = chunkSummaries.filter((chunk) => chunk.category === "core");
  const localeChunks = chunkSummaries.filter((chunk) => chunk.category === "locale");
  const fontChunks = chunkSummaries.filter((chunk) => chunk.category === "font");
  const miscChunks = chunkSummaries.filter((chunk) => chunk.category === "misc");

  return [
    "# Human-Readable Bundle Mirror",
    "",
    "## Overview",
    "",
    `- Main bundle URL: \`${report.mainBundleUrl}\``,
    `- Raw main bundle: \`${report.mainBundlePath}\``,
    `- Readable main bundle: \`${mainDeobPath}\``,
    `- Total chunks: \`${report.chunkCount}\``,
    `- Downloaded chunks: \`${report.fetchedChunks.length}\``,
    `- Failed chunks: \`${report.failedChunks.length}\``,
    `- Extracted webpack modules: \`${moduleLayout.totalModuleCount}\``,
    `- Module index: \`${moduleLayout.indexPath}\``,
    `- Heuristic index: \`${heuristicLayout.indexPath}\``,
    `- Heuristic README: \`${heuristicLayout.readmePath}\``,
    "",
    "## Start Here",
    "",
    `- Main app bootstrap: \`${mainDeobPath}\``,
    `- Main bundle modules: \`${mainModuleContainer?.outputDirectory ?? "(missing)"}\``,
    `- Heuristic named modules: \`${path.join(heuristicLayout.heuristicRoot, "modules")}\``,
    ...coreChunks.slice(0, 8).map(
      (chunk) => {
        const moduleContainer = moduleLayout.containers.find(
          (container) => container.containerKind === "chunk" && container.chunkIds[0] === chunk.chunkId
        );
        return `- Core chunk \`${chunk.chunkId}\` \`${chunk.chunkName}\`: \`${chunk.deobfuscatedFilePath ?? "(missing)"}\` modules=\`${moduleContainer?.modules.length ?? 0}\``;
      }
    ),
    "",
    "## Chunk Groups",
    "",
    `- Core app chunks: ${coreChunks.length}`,
    `- Locale chunks: ${localeChunks.length}`,
    `- Font chunks: ${fontChunks.length}`,
    `- Misc chunks: ${miscChunks.length}`,
    "",
    "## Module Layout",
    "",
    `- Module root: \`${moduleLayout.moduleRoot}\``,
    `- Module index JSON: \`${moduleLayout.indexPath}\``,
    ...formatModuleContainerTable(moduleLayout.containers),
    "",
    "## Heuristic Reconstruction",
    "",
    `- Heuristic root: \`${heuristicLayout.heuristicRoot}\``,
    `- Reconstructed module count: \`${heuristicLayout.moduleCount}\``,
    `- Named module index: \`${heuristicLayout.indexPath}\``,
    `- Human guide: \`${heuristicLayout.readmePath}\``,
    "",
    "## Core Chunks",
    "",
    ...formatChunkTable(coreChunks, moduleLayout),
    "",
    "## Locale Chunks",
    "",
    ...formatChunkTable(localeChunks, moduleLayout),
    "",
    "## Font Chunks",
    "",
    ...formatChunkTable(fontChunks, moduleLayout),
    "",
    "## Misc Chunks",
    "",
    ...formatChunkTable(miscChunks, moduleLayout),
    ""
  ].join("\n");
}

function formatChunkTable(
  chunks: readonly ReadableChunkSummary[],
  moduleLayout: WebpackModuleExtractionLayout
): string[] {
  if (chunks.length === 0) {
    return ["_None_"];
  }

  return [
    "| Chunk | Name | Size | Modules | Readable | Raw |",
    "| --- | --- | ---: | ---: | --- | --- |",
    ...chunks.map((chunk) => {
      const moduleContainer = moduleLayout.containers.find(
        (container) => container.containerKind === "chunk" && container.chunkIds[0] === chunk.chunkId
      );
      return `| ${chunk.chunkId} | ${chunk.chunkName} | ${formatBytes(chunk.bytes)} | ${moduleContainer?.modules.length ?? 0} | \`${chunk.deobfuscatedFilePath ?? "(missing)"}\` | \`${chunk.rawFilePath}\` |`;
    })
  ];
}

function formatModuleContainerTable(
  containers: readonly WebpackModuleExtractionLayout["containers"][number][]
): string[] {
  if (containers.length === 0) {
    return ["_No webpack module containers extracted_"];
  }

  return [
    "| Container | Modules | Directory | Source |",
    "| --- | ---: | --- | --- |",
    ...containers.map((container) => {
      const label =
        container.containerKind === "main"
          ? "main"
          : `chunk:${container.chunkIds.length > 0 ? container.chunkIds.join(",") : "unknown"}`;
      return `| ${label} | ${container.modules.length} | \`${container.outputDirectory}\` | \`${container.sourcePath}\` |`;
    })
  ];
}

function readChunkName(fileName: string): string {
  const firstDot = fileName.indexOf(".");
  return firstDot === -1 ? fileName : fileName.slice(0, firstDot);
}

function sanitizeChunkName(chunkName: string): string {
  return chunkName.replace(/[^A-Za-z0-9_-]+/g, "_");
}

function classifyChunk(chunkName: string): "core" | "locale" | "font" | "misc" {
  if (/^nls/i.test(chunkName) || chunkName === "root") {
    return "locale";
  }
  if (/font/i.test(chunkName)) {
    return "font";
  }
  if (chunkName === "hwpApp") {
    return "core";
  }
  if (/^\d+$/.test(chunkName)) {
    return "misc";
  }

  return "core";
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
}
