export interface StaticBundleSurface {
  title: string;
  pageUrl: string;
  scriptUrls: string[];
  resourceScriptUrls: string[];
  chunkGlobals: string[];
}

export interface StaticBundleSelection {
  selectedBundleUrl: string | null;
  candidateUrls: string[];
  notes: string[];
}

export interface StaticDownloadedBundle {
  bundleUrl: string;
  sourceHashSha256: string;
  sourceBytes: number;
  sourceText: string;
}

export interface StaticKeywordMatch {
  keyword: string;
  occurrences: number;
}

export interface StaticCandidateSnippet {
  keyword: string;
  line: number;
  preview: string;
}

export type StaticCandidateRole =
  | "read-export"
  | "runtime-join"
  | "write-command"
  | "bundle-runtime";

export type StaticVerifiedFindingKind = "read" | "write" | "runtime-join" | "gap";

export interface StaticVerifiedEvidenceRef {
  path: string;
  symbols: string[];
  note: string;
}

export interface StaticVerifiedFinding {
  key: string;
  kind: StaticVerifiedFindingKind;
  capability: string;
  summary: string;
  staticEvidence: StaticVerifiedEvidenceRef[];
  runtimeEvidence: string[];
  unresolved: string[];
}

export interface StaticModuleManifestEntry {
  path: string;
  bytes: number;
  score: number;
  roles: StaticCandidateRole[];
  keywordMatches: StaticKeywordMatch[];
  snippets: StaticCandidateSnippet[];
  nextRuntimeProbe: string | null;
}

export interface StaticWebcrackRunResult {
  command: string[];
  success: boolean;
  outputPath: string;
  stdout: string;
  stderr: string;
}

export interface StaticEntryPointReport {
  generatedAt: string;
  pageUrl: string;
  title: string;
  selectedBundleUrl: string | null;
  rawBundlePath: string;
  rawBundleSha256: string;
  deobOutputPath: string;
  usedFallbackScanRoot: boolean;
  candidateCount: number;
  readExportCandidates: StaticModuleManifestEntry[];
  writeCommandCandidates: StaticModuleManifestEntry[];
  notes: string[];
}
