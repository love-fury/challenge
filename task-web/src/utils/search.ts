import type { SearchMatch, SearchOptions, SearchResult } from "../models/types.js";

const DEFAULT_CONTEXT_WINDOW = 20;

export function searchDocumentText(
  text: string,
  query: string,
  options: SearchOptions = {}
): SearchResult {
  const contextWindow = normalizeContextWindow(options.contextWindow);
  const haystack = options.caseSensitive ? text : text.toLocaleLowerCase();
  const needle = options.caseSensitive ? query : query.toLocaleLowerCase();
  const matches: SearchMatch[] = [];

  let fromIndex = 0;
  while (fromIndex <= haystack.length - needle.length) {
    const start = haystack.indexOf(needle, fromIndex);
    if (start === -1) {
      break;
    }

    const end = start + query.length;
    const match = text.slice(start, end);
    const beforeStart = Math.max(0, start - contextWindow);
    const afterEnd = Math.min(text.length, end + contextWindow);
    const before = text.slice(beforeStart, start);
    const after = text.slice(end, afterEnd);
    const crossedSeparator = /[\n\t]/.test(match);

    matches.push({
      index: matches.length,
      start,
      end,
      match,
      before,
      after,
      context: `${before}${match}${after}`,
      crossedNodeBoundary: crossedSeparator,
      crossedSeparator
    });

    fromIndex = end;
  }

  return {
    query,
    total: matches.length,
    matches
  };
}

function normalizeContextWindow(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_CONTEXT_WINDOW;
  }

  if (!Number.isFinite(value)) {
    return DEFAULT_CONTEXT_WINDOW;
  }

  return Math.max(0, Math.trunc(value));
}
