import fs from "node:fs/promises";
import path from "node:path";

import type {
  StaticCandidateRole,
  StaticCandidateSnippet,
  StaticKeywordMatch,
  StaticModuleManifestEntry
} from "./model.js";

interface StaticKeywordGroup {
  role: StaticCandidateRole;
  keywords: string[];
}

const STATIC_KEYWORD_GROUPS: StaticKeywordGroup[] = [
  {
    role: "read-export",
    keywords: [
      "readDocument",
      "readText",
      "F_r",
      "H_r",
      "us",
      "as",
      "rs",
      "xLn",
      "yLn",
      "YOn",
      "clientinfo",
      "clientInfos",
      "emptypara",
      "bulletchar",
      "clipboard",
      "HOn",
      "POn",
      "LOn",
      "ufr",
      "FHn",
      "UHn",
      "DXs",
      "Save",
      "sl",
      "hp",
      "np",
      "so",
      "li",
      "gso",
      "tbl",
      "export",
      "markdown",
      "json",
      "query",
      "document",
      "paragraph",
      "table",
      "image",
      "heading",
      "outline",
      "style",
      "format",
      "font",
      "search"
    ]
  },
  {
    role: "runtime-join",
    keywords: [
      "HwpApp",
      "Svr",
      "Ivr",
      "Csi",
      "Y5n",
      "$5n",
      "o6n",
      "u6n",
      "z5n",
      "j5n",
      "AMe",
      "Gn",
      "lr",
      "Eni",
      "Cni"
    ]
  },
  {
    role: "write-command",
    keywords: [
      "ActionManager",
      "UIAPI",
      "dispatcher",
      "command",
      "save",
      "replace",
      "insertTable",
      "PPt",
      "LPt",
      "fPt",
      "NPt",
      "Tbr",
      "dialog_insert_table",
      "dialog_insert_image",
      "t_create_table",
      "i_insert_image"
    ]
  },
  {
    role: "bundle-runtime",
    keywords: ["webpackChunk", "__webpack_require__", "module.exports", "exports."]
  }
];

const SCANNABLE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json"]);

export async function buildStaticModuleManifest(
  rootPath: string
): Promise<StaticModuleManifestEntry[]> {
  const filePaths = await collectScannableFiles(rootPath);
  const entries: StaticModuleManifestEntry[] = [];

  for (const filePath of filePaths) {
    const content = await fs.readFile(filePath, "utf8");
    const relativePath =
      filePaths.length === 1 && path.resolve(filePaths[0] ?? "") === path.resolve(rootPath)
        ? path.basename(filePath)
        : path.relative(rootPath, filePath);
    entries.push(scoreStaticModule(relativePath, content));
  }

  return entries.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
}

export function scoreStaticModule(relativePath: string, content: string): StaticModuleManifestEntry {
  const keywordMatches = collectKeywordMatches(content);
  const roles = inferStaticCandidateRoles(keywordMatches);
  const snippets = buildStaticCandidateSnippets(content, keywordMatches);
  const score =
    keywordMatches.reduce((total, match) => total + match.occurrences * keywordWeight(match.keyword), 0) +
    roles.length * 5;

  return {
    path: relativePath,
    bytes: Buffer.byteLength(content, "utf8"),
    score,
    roles,
    keywordMatches,
    snippets,
    nextRuntimeProbe: buildNextRuntimeProbe(roles, keywordMatches)
  };
}

export function collectKeywordMatches(content: string): StaticKeywordMatch[] {
  const matches: StaticKeywordMatch[] = [];
  const seen = new Set<string>();

  for (const group of STATIC_KEYWORD_GROUPS) {
    for (const keyword of group.keywords) {
      if (seen.has(keyword)) {
        continue;
      }
      seen.add(keyword);

      const occurrences = countKeywordOccurrences(content, keyword);
      if (occurrences > 0) {
        matches.push({
          keyword,
          occurrences
        });
      }
    }
  }

  return matches.sort((left, right) => right.occurrences - left.occurrences || left.keyword.localeCompare(right.keyword));
}

export function inferStaticCandidateRoles(
  keywordMatches: readonly StaticKeywordMatch[]
): StaticCandidateRole[] {
  const hitSet = new Set(keywordMatches.map((match) => match.keyword));

  return STATIC_KEYWORD_GROUPS.flatMap((group) =>
    group.keywords.some((keyword) => hitSet.has(keyword)) ? [group.role] : []
  );
}

export function buildStaticCandidateSnippets(
  content: string,
  keywordMatches: readonly StaticKeywordMatch[],
  maxSnippets = 4
): StaticCandidateSnippet[] {
  const snippets: StaticCandidateSnippet[] = [];

  for (const match of keywordMatches) {
    if (snippets.length >= maxSnippets) {
      break;
    }

    const snippet = extractSnippetAroundKeyword(content, match.keyword);
    if (snippet !== null) {
      snippets.push(snippet);
    }
  }

  return snippets;
}

export function extractSnippetAroundKeyword(
  content: string,
  keyword: string,
  radius = 120
): StaticCandidateSnippet | null {
  const index = content.indexOf(keyword);
  if (index === -1) {
    return null;
  }

  const start = Math.max(0, index - radius);
  const end = Math.min(content.length, index + keyword.length + radius);
  const lineStart = content.lastIndexOf("\n", start);
  const lineEnd = content.indexOf("\n", end);
  const preview = content
    .slice(lineStart === -1 ? start : lineStart + 1, lineEnd === -1 ? end : lineEnd)
    .replace(/\s+/g, " ")
    .trim();
  const line = content.slice(0, index).split("\n").length;

  return {
    keyword,
    line,
    preview
  };
}

export function splitStaticCandidates(
  manifest: readonly StaticModuleManifestEntry[]
): {
  readExportCandidates: StaticModuleManifestEntry[];
  writeCommandCandidates: StaticModuleManifestEntry[];
} {
  return {
    readExportCandidates: manifest.filter((entry) => entry.roles.includes("read-export")).slice(0, 20),
    writeCommandCandidates: manifest.filter((entry) => entry.roles.includes("write-command")).slice(0, 20)
  };
}

async function collectScannableFiles(rootPath: string): Promise<string[]> {
  const resolved = path.resolve(rootPath);
  const stats = await fs.stat(resolved);

  if (stats.isFile()) {
    return [resolved];
  }

  const results: string[] = [];
  await walkDirectory(resolved, results);
  return results.sort((left, right) => left.localeCompare(right));
}

async function walkDirectory(directoryPath: string, results: string[]): Promise<void> {
  const entries = await fs.readdir(directoryPath, {
    withFileTypes: true
  });

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(entryPath, results);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name);
    if (SCANNABLE_EXTENSIONS.has(extension) || extension.length === 0) {
      results.push(entryPath);
    }
  }
}

function countKeywordOccurrences(content: string, keyword: string): number {
  let occurrences = 0;
  let offset = 0;

  while (offset < content.length) {
    const index = content.indexOf(keyword, offset);
    if (index === -1) {
      break;
    }
    occurrences += 1;
    offset = index + keyword.length;
  }

  return occurrences;
}

function keywordWeight(keyword: string): number {
  if (
    /^(readDocument|readText|F_r|H_r|us|as|rs|xLn|yLn|YOn|clientinfo|clientInfos|emptypara|bulletchar|clipboard|HOn|POn|LOn|ufr|FHn|UHn|DXs|Save|export|markdown|json|query|ActionManager|UIAPI|PPt|LPt|fPt|NPt|dialog_insert_table|dialog_insert_image)$/i.test(
      keyword
    )
  ) {
    return 12;
  }
  if (/^(HwpApp|Svr|Ivr|Csi|Y5n|\$5n|o6n|u6n|z5n|j5n|AMe|Gn|lr|Eni|Cni)$/i.test(keyword)) {
    return 8;
  }
  return 4;
}

function buildNextRuntimeProbe(
  roles: readonly StaticCandidateRole[],
  keywordMatches: readonly StaticKeywordMatch[]
): string | null {
  const hitSet = new Set(keywordMatches.map((match) => match.keyword));

  if (roles.includes("read-export")) {
    if (hitSet.has("HwpApp") || hitSet.has("document")) {
      return "Locate the recovered function/module owner at runtime, then sample its return payload against HwpApp.document/Svr.G0i evidence.";
    }
    return "Search the recovered symbol names in Runtime.evaluate and compare candidate payloads to current readDocument()/readText() output.";
  }
  if (roles.includes("write-command")) {
    return "Trace the recovered command symbol against live ActionManager/UIAPI/dispatcher calls before promoting it as a write surface.";
  }
  if (roles.includes("runtime-join")) {
    return "Cross-check the recovered runtime names against existing HwpApp object paths and reject aliases that do not resolve live.";
  }

  return null;
}
