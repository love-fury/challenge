import fs from "node:fs/promises";
import path from "node:path";

import { downloadStaticBundle } from "./bundleFetch.js";
import type { StaticWebcrackRunResult } from "./model.js";
import { runWebcrackCli } from "./webcrackRunner.js";

export interface WebpackChunkAsset {
  chunkId: number;
  hash: string;
  fileName: string;
  bundleUrl: string;
}

export interface WebpackChunkMirrorFetchResult extends WebpackChunkAsset {
  rawFilePath: string;
  bytes: number;
  sha256: string;
}

export interface WebpackChunkMirrorFailure extends WebpackChunkAsset {
  error: string;
}

export interface WebpackBundleMirrorReport {
  mainBundleUrl: string;
  mainBundlePath: string;
  chunkCount: number;
  fetchedChunks: WebpackChunkMirrorFetchResult[];
  failedChunks: WebpackChunkMirrorFailure[];
  deobfuscatedMain: StaticWebcrackRunResult;
  deobfuscatedChunks: Array<StaticWebcrackRunResult & { chunkId: number; rawFilePath: string }>;
}

export function extractWebpackChunkAssets(
  mainBundleUrl: string,
  sourceText: string
): WebpackChunkAsset[] {
  const namedMatch = sourceText.match(
    /o\.u\s*=\s*e\s*=>\s*\(\(\{([\s\S]*?)\}\[e\]\|\|e\)\s*\+\s*"\."\s*\+\s*\{([\s\S]*?)\}\[e\]\s*\+\s*"\.chunk\.js"\)/
  );
  const hashOnlyMatch = sourceText.match(
    /o\.u\s*=\s*e\s*=>\s*\(\s*\{([\s\S]*?)\}\[e\]\s*\+\s*"\.chunk\.js"\s*\)/
  );
  const nameMapBody = namedMatch?.[1];
  const hashMapBody = namedMatch?.[2] ?? hashOnlyMatch?.[1];
  if (hashMapBody === undefined) {
    return [];
  }

  const chunkNamesById = new Map<number, string>();
  if (nameMapBody !== undefined) {
    const nameRegex = /(\d+):"([^"]+)"/g;
    let nameMatch: RegExpExecArray | null = null;
    while ((nameMatch = nameRegex.exec(nameMapBody)) !== null) {
      const chunkIdText = nameMatch[1];
      const name = nameMatch[2];
      if (chunkIdText === undefined || name === undefined) {
        continue;
      }

      const chunkId = Number.parseInt(chunkIdText, 10);
      if (!Number.isNaN(chunkId) && name.length > 0) {
        chunkNamesById.set(chunkId, name);
      }
    }
  }

  const assets: WebpackChunkAsset[] = [];
  const pairRegex = /(\d+):"([^"]+)"/g;
  let match: RegExpExecArray | null = null;

  while ((match = pairRegex.exec(hashMapBody)) !== null) {
    const chunkIdText = match[1];
    const hash = match[2];
    if (chunkIdText === undefined || hash === undefined) {
      continue;
    }

    const chunkId = Number.parseInt(chunkIdText, 10);
    if (Number.isNaN(chunkId) || hash.length === 0) {
      continue;
    }

    const chunkName = chunkNamesById.get(chunkId) ?? String(chunkId);
    const fileName = `${chunkName}.${hash}.chunk.js`;
    assets.push({
      chunkId,
      hash,
      fileName,
      bundleUrl: new URL(fileName, mainBundleUrl).toString()
    });
  }

  return assets.sort((left, right) => left.chunkId - right.chunkId);
}

export async function mirrorWebpackBundle(
  mainBundleUrl: string,
  mainBundleSource: string,
  artifactRoot: string
): Promise<WebpackBundleMirrorReport> {
  const rawRoot = path.join(artifactRoot, "raw");
  const deobRoot = path.join(artifactRoot, "deobfuscated");
  const rawMainPath = path.join(rawRoot, "main.js");
  const chunkAssets = extractWebpackChunkAssets(mainBundleUrl, mainBundleSource);

  await fs.mkdir(path.join(rawRoot, "chunks"), {
    recursive: true
  });
  await fs.mkdir(path.join(deobRoot, "chunks"), {
    recursive: true
  });
  await fs.writeFile(rawMainPath, mainBundleSource);

  const deobfuscatedMain = await runWebcrackCli(rawMainPath, path.join(deobRoot, "main"));
  const fetchedChunks: WebpackChunkMirrorFetchResult[] = [];
  const failedChunks: WebpackChunkMirrorFailure[] = [];

  for (const asset of chunkAssets) {
    try {
      const downloaded = await downloadStaticBundle(asset.bundleUrl);
      const rawFilePath = path.join(rawRoot, "chunks", `${asset.chunkId}-${asset.fileName}`);
      await fs.writeFile(rawFilePath, downloaded.sourceText);
      fetchedChunks.push({
        ...asset,
        rawFilePath,
        bytes: downloaded.sourceBytes,
        sha256: downloaded.sourceHashSha256
      });
    } catch (error) {
      failedChunks.push({
        ...asset,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const deobfuscatedChunks: Array<
    StaticWebcrackRunResult & { chunkId: number; rawFilePath: string }
  > = [];
  for (const chunk of fetchedChunks) {
    const outputPath = path.join(deobRoot, "chunks", String(chunk.chunkId));
    const deobResult = await runWebcrackCli(chunk.rawFilePath, outputPath);
    deobfuscatedChunks.push({
      ...deobResult,
      chunkId: chunk.chunkId,
      rawFilePath: chunk.rawFilePath
    });
  }

  return {
    mainBundleUrl,
    mainBundlePath: rawMainPath,
    chunkCount: chunkAssets.length,
    fetchedChunks,
    failedChunks,
    deobfuscatedMain,
    deobfuscatedChunks
  };
}
