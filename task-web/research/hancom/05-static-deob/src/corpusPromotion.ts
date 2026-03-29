import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const CURATED_HEURISTIC_PART_KEYS = new Set([
  "main:417",
  "main:5910",
  "chunk-431:6971",
  "chunk-138-719:6161",
  "chunk-360:2595"
]);

interface FullMirrorReport {
  mainBundleUrl: string;
  mainBundlePath: string;
  chunkCount: number;
  fetchedChunks: Array<{
    chunkId: number;
    hash: string;
    fileName: string;
    bundleUrl: string;
    rawFilePath: string;
    bytes: number;
    sha256: string;
  }>;
  failedChunks: Array<{
    chunkId: number;
    hash: string;
    fileName: string;
    bundleUrl: string;
    error: string;
  }>;
}

interface ModuleIndexFile {
  generatedAt: string;
  moduleRoot: string;
  totalModuleCount: number;
  containers: Array<{
    containerKind: "main" | "chunk";
    chunkIds: number[];
    sourcePath: string;
    outputDirectory: string;
    modules: Array<{
      moduleId: string;
      outputFilePath: string;
      bytes: number;
    }>;
  }>;
}

interface HeuristicIndexFile {
  generatedAt: string;
  heuristicRoot: string;
  moduleCount: number;
  summaries: Array<{
    containerLabel: string;
    moduleId: string;
    sourcePath: string;
    bytes: number;
    guessedName: string;
    guessedTags: string[];
    namedModulePath: string;
    imports: Array<{
      localName: string | null;
      requiredModuleId: string;
    }>;
    exports: Array<{
      exportName: string;
      targetName: string | null;
      kind: "default" | "named" | "commonjs";
    }>;
    topLevelSymbols: string[];
    parts: Array<{
      label: string;
      outputFilePath: string;
      line: number;
    }>;
    notes: string[];
  }>;
}

export interface CuratedCorpusPromotionManifest {
  generatedAt: string;
  sourceArtifactRoot: string;
  promotedArtifactRoot: string;
  buildId: string;
  mainBundleUrl: string;
  rawMainBundleSha256: string;
  chunkCount: number;
  extractedModuleCount: number;
  heuristicModuleCount: number;
  curatedHeuristicPartKeys: string[];
  selectedEntries: string[];
}

export async function promoteCuratedStaticDeobCorpus(
  sourceArtifactRoot: string,
  destinationArtifactRoot: string
): Promise<CuratedCorpusPromotionManifest> {
  const sourceRoot = normalizeRelativePath(sourceArtifactRoot);
  const destinationRoot = normalizeRelativePath(destinationArtifactRoot);
  const report = await readJsonFile<FullMirrorReport>(path.join(sourceRoot, "full-mirror-report.json"));
  const moduleIndexPath = path.join(sourceRoot, "readable", "modules", "module-index.json");
  const heuristicIndexPath = path.join(sourceRoot, "readable", "heuristic", "heuristic-index.json");
  const sourceReadmePath = path.join(sourceRoot, "README.md");
  const sourceHeuristicReadmePath = path.join(sourceRoot, "readable", "heuristic", "README.md");
  const rawMainBundlePath = path.join(sourceRoot, "raw", "main.js");
  const rawMainBundleText = await fs.readFile(rawMainBundlePath);
  const rawMainBundleSha256 = crypto.createHash("sha256").update(rawMainBundleText).digest("hex");
  const moduleIndex = await readJsonFile<ModuleIndexFile>(moduleIndexPath);
  const heuristicIndex = await readJsonFile<HeuristicIndexFile>(heuristicIndexPath);

  await fs.rm(destinationRoot, {
    recursive: true,
    force: true
  });
  await fs.mkdir(destinationRoot, {
    recursive: true
  });

  const selectedEntries: string[] = [];

  await copyEntry(
    path.join(sourceRoot, "readable", "main.deobfuscated.js"),
    path.join(destinationRoot, "readable", "main.deobfuscated.js"),
    selectedEntries
  );
  await copyEntry(
    path.join(sourceRoot, "readable", "chunks"),
    path.join(destinationRoot, "readable", "chunks"),
    selectedEntries
  );
  await copyEntry(
    path.join(sourceRoot, "readable", "modules", "main"),
    path.join(destinationRoot, "readable", "modules", "main"),
    selectedEntries
  );
  await copyEntry(
    path.join(sourceRoot, "readable", "modules", "chunks"),
    path.join(destinationRoot, "readable", "modules", "chunks"),
    selectedEntries
  );
  await copyEntry(
    path.join(sourceRoot, "readable", "heuristic", "modules"),
    path.join(destinationRoot, "readable", "heuristic", "modules"),
    selectedEntries
  );

  const filteredHeuristicIndex = filterHeuristicIndexParts(heuristicIndex);
  for (const summary of filteredHeuristicIndex.summaries) {
    if (summary.parts.length === 0) {
      continue;
    }
    const sourcePartDirectory = path.dirname(summary.parts[0]?.outputFilePath ?? "");
    const destinationPartDirectory = rewritePathPrefix(sourcePartDirectory, sourceRoot, destinationRoot);
    await copyEntry(sourcePartDirectory, destinationPartDirectory, selectedEntries);
  }

  const rewrittenReadme = rewritePathStrings(await fs.readFile(sourceReadmePath, "utf8"), sourceRoot, destinationRoot);
  await writeTextFile(path.join(destinationRoot, "README.md"), rewrittenReadme, selectedEntries);

  const rewrittenHeuristicReadme = rewritePathStrings(
    await fs.readFile(sourceHeuristicReadmePath, "utf8"),
    sourceRoot,
    destinationRoot
  );
  await writeTextFile(
    path.join(destinationRoot, "readable", "heuristic", "README.md"),
    rewrittenHeuristicReadme,
    selectedEntries
  );

  const rewrittenModuleIndex = rewriteJsonPaths(moduleIndex, sourceRoot, destinationRoot);
  await writeJsonFile(
    path.join(destinationRoot, "readable", "modules", "module-index.json"),
    rewrittenModuleIndex,
    selectedEntries
  );

  const rewrittenHeuristicIndex = rewriteJsonPaths(filteredHeuristicIndex, sourceRoot, destinationRoot);
  await writeJsonFile(
    path.join(destinationRoot, "readable", "heuristic", "heuristic-index.json"),
    rewrittenHeuristicIndex,
    selectedEntries
  );

  const promotionManifest: CuratedCorpusPromotionManifest = {
    generatedAt: new Date().toISOString(),
    sourceArtifactRoot: sourceRoot,
    promotedArtifactRoot: destinationRoot,
    buildId: deriveStaticDeobBuildId(report.mainBundleUrl),
    mainBundleUrl: report.mainBundleUrl,
    rawMainBundleSha256,
    chunkCount: report.chunkCount,
    extractedModuleCount: moduleIndex.totalModuleCount,
    heuristicModuleCount: heuristicIndex.moduleCount,
    curatedHeuristicPartKeys: [...CURATED_HEURISTIC_PART_KEYS].sort((left, right) =>
      left.localeCompare(right)
    ),
    selectedEntries: selectedEntries.sort((left, right) => left.localeCompare(right))
  };

  await writeJsonFile(
    path.join(destinationRoot, "promotion-manifest.json"),
    promotionManifest,
    selectedEntries
  );

  return promotionManifest;
}

export async function writeStaticDeobArtifactsIndex(artifactsRoot: string): Promise<string> {
  const root = normalizeRelativePath(artifactsRoot);
  const staticDeobRoot = path.join(root, "static-deob");
  await fs.mkdir(staticDeobRoot, {
    recursive: true
  });

  const entries = await fs.readdir(staticDeobRoot, {
    withFileTypes: true
  });
  const buildDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const readmeText = [
    "# Static Deob Artifacts",
    "",
    "이 디렉터리는 `tmp/discovery/05-static-deob`에서 선별 승격한 repo-tracked corpus를 보관한다.",
    "",
    "## Builds",
    "",
    ...(buildDirectories.length === 0
      ? ["_None_"]
      : buildDirectories.map((buildDirectory) => `- \`${path.join(staticDeobRoot, buildDirectory)}\``)),
    "",
    "## Notes",
    "",
    "- `tmp/`는 full scratch corpus와 rerun working set이다.",
    "- `artifacts/static-deob/`는 stable curated subset만 추적한다.",
    ""
  ].join("\n");
  const readmePath = path.join(staticDeobRoot, "README.md");
  await fs.writeFile(readmePath, readmeText);
  return readmePath;
}

export function deriveStaticDeobBuildId(mainBundleUrl: string): string {
  const parsed = new URL(mainBundleUrl);
  const queryToken = parsed.search.length > 1 ? parsed.search.slice(1) : null;
  const buildToken =
    queryToken && /^[A-Za-z0-9_-]+$/.test(queryToken)
      ? queryToken
      : crypto.createHash("sha1").update(mainBundleUrl).digest("hex").slice(0, 12);
  return `hancom-webhwp-build-${buildToken}`;
}

function filterHeuristicIndexParts(index: HeuristicIndexFile): HeuristicIndexFile {
  return {
    ...index,
    summaries: index.summaries.map((summary) => {
      const key = `${summary.containerLabel}:${summary.moduleId}`;
      return CURATED_HEURISTIC_PART_KEYS.has(key)
        ? summary
        : {
            ...summary,
            parts: []
          };
    })
  };
}

function rewriteJsonPaths<T>(value: T, sourceRoot: string, destinationRoot: string): T {
  if (typeof value === "string") {
    return rewritePathPrefix(value, sourceRoot, destinationRoot) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => rewriteJsonPaths(entry, sourceRoot, destinationRoot)) as T;
  }
  if (value !== null && typeof value === "object") {
    const rewrittenEntries = Object.entries(value).map(([key, entryValue]) => [
      key,
      rewriteJsonPaths(entryValue, sourceRoot, destinationRoot)
    ]);
    return Object.fromEntries(rewrittenEntries) as T;
  }

  return value;
}

function rewritePathStrings(text: string, sourceRoot: string, destinationRoot: string): string {
  return text.split(sourceRoot).join(destinationRoot);
}

function rewritePathPrefix(filePath: string, sourceRoot: string, destinationRoot: string): string {
  return filePath.startsWith(sourceRoot)
    ? path.join(destinationRoot, path.relative(sourceRoot, filePath))
    : filePath;
}

async function copyEntry(
  sourcePath: string,
  destinationPath: string,
  selectedEntries: string[]
): Promise<void> {
  await fs.mkdir(path.dirname(destinationPath), {
    recursive: true
  });
  await fs.cp(sourcePath, destinationPath, {
    recursive: true
  });
  selectedEntries.push(destinationPath);
}

async function writeJsonFile(
  outputPath: string,
  value: unknown,
  selectedEntries: string[]
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), {
    recursive: true
  });
  await fs.writeFile(outputPath, JSON.stringify(value, null, 2));
  selectedEntries.push(outputPath);
}

async function writeTextFile(
  outputPath: string,
  text: string,
  selectedEntries: string[]
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), {
    recursive: true
  });
  await fs.writeFile(outputPath, text);
  selectedEntries.push(outputPath);
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

function normalizeRelativePath(inputPath: string): string {
  return path.normalize(inputPath).replace(/\\/g, "/");
}
