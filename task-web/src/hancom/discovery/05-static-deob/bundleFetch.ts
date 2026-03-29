import { createHash } from "node:crypto";

import type {
  StaticBundleSelection,
  StaticBundleSurface,
  StaticDownloadedBundle
} from "./model.js";

interface PerformanceResourceLike {
  name?: unknown;
  initiatorType?: unknown;
}

export function pageCollectStaticBundleSurface(): StaticBundleSurface {
  const scripts = Array.from(document.scripts)
    .map((script) => script.src)
    .filter((src): src is string => typeof src === "string" && src.length > 0);
  const resourceScripts = performance
    .getEntriesByType("resource")
    .flatMap((entry) => {
      const candidate = entry as PerformanceResourceLike;
      if (candidate.initiatorType !== "script" || typeof candidate.name !== "string") {
        return [];
      }

      return [candidate.name];
    });
  const chunkGlobals = Object.keys(globalThis).filter((key) => key.startsWith("webpackChunk"));

  return {
    title: document.title,
    pageUrl: location.href,
    scriptUrls: Array.from(new Set(scripts)),
    resourceScriptUrls: Array.from(new Set(resourceScripts)),
    chunkGlobals
  };
}

export function selectPrimaryBundleUrl(surface: StaticBundleSurface): StaticBundleSelection {
  const notes: string[] = [];
  const candidateUrls = Array.from(
    new Set([...surface.scriptUrls, ...surface.resourceScriptUrls])
  ).filter((url) => url.endsWith(".js") || /\.js(\?|#)/.test(url));

  if (candidateUrls.length === 0) {
    notes.push("No external JavaScript bundle URLs were discovered from script tags or performance entries.");
    return {
      selectedBundleUrl: null,
      candidateUrls,
      notes
    };
  }

  const pageOrigin = safeOrigin(surface.pageUrl);
  const rankedCandidates = candidateUrls
    .map((url) => ({
      url,
      score: scoreBundleUrl(url, pageOrigin)
    }))
    .sort((left, right) => right.score - left.score);
  const selected = rankedCandidates[0] ?? null;

  if (surface.chunkGlobals.length > 0) {
    notes.push(
      `Webpack runtime marker(s) present in page context: ${surface.chunkGlobals.join(", ")}.`
    );
  } else {
    notes.push("No webpackChunk* marker was present in page context; static lane should treat webpack-first assumptions as provisional.");
  }
  if (selected) {
    notes.push(`Selected bundle URL ${selected.url} with heuristic score ${selected.score}.`);
  }

  return {
    selectedBundleUrl: selected?.url ?? null,
    candidateUrls,
    notes
  };
}

export async function downloadStaticBundle(
  bundleUrl: string,
  timeoutMs = 15_000
): Promise<StaticDownloadedBundle> {
  const response = await fetch(bundleUrl, {
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch bundle ${bundleUrl} (${response.status}).`);
  }

  const sourceText = await response.text();
  const sourceBytes = Buffer.byteLength(sourceText, "utf8");
  const sourceHashSha256 = createHash("sha256").update(sourceText).digest("hex");

  return {
    bundleUrl,
    sourceHashSha256,
    sourceBytes,
    sourceText
  };
}

function scoreBundleUrl(url: string, pageOrigin: string | null): number {
  let score = 0;

  if (/\/webhwp\/js\/main\.js(?:[?#]|$)/i.test(url)) {
    score += 200;
  }
  if (/\/main\.js(?:[?#]|$)/i.test(url)) {
    score += 120;
  }
  if (/webhwp/i.test(url)) {
    score += 40;
  }
  if (/\/js\//i.test(url)) {
    score += 20;
  }
  if (pageOrigin !== null && safeOrigin(url) === pageOrigin) {
    score += 10;
  }

  return score;
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
