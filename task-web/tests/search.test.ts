import { describe, expect, it } from "vitest";

import { EditorPreconditionError } from "../src/client/errors.js";
import { HancomReadService } from "../src/hancom/HancomReadService.js";
import { searchDocumentText } from "../src/utils/search.js";
import type { HancomDocument } from "../src/models/types.js";

describe("searchDocumentText", () => {
  it("returns non-overlapping matches with offsets and context", () => {
    expect(searchDocumentText("alpha beta alpha", "alpha", { contextWindow: 3 })).toEqual({
      query: "alpha",
      total: 2,
      matches: [
        {
          index: 0,
          start: 0,
          end: 5,
          match: "alpha",
          before: "",
          after: " be",
          context: "alpha be",
          crossedNodeBoundary: false,
          crossedSeparator: false
        },
        {
          index: 1,
          start: 11,
          end: 16,
          match: "alpha",
          before: "ta ",
          after: "",
          context: "ta alpha",
          crossedNodeBoundary: false,
          crossedSeparator: false
        }
      ]
    });
  });

  it("defaults to case-insensitive search while preserving original match casing", () => {
    const result = searchDocumentText("Alpha alpha ALPHA", "alpha");

    expect(result.total).toBe(3);
    expect(result.matches.map((match) => match.match)).toEqual(["Alpha", "alpha", "ALPHA"]);
  });

  it("marks separators when the match spans a flattened document boundary", () => {
    const result = searchDocumentText("alpha\nbeta\tgamma", "a\nb");

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      start: 4,
      end: 7,
      match: "a\nb",
      crossedNodeBoundary: true,
      crossedSeparator: true
    });
  });

  it("uses non-overlapping matching for repeated substrings", () => {
    const result = searchDocumentText("aaaa", "aa", { caseSensitive: true, contextWindow: 0 });

    expect(result.total).toBe(2);
    expect(result.matches.map((match) => [match.start, match.end])).toEqual([
      [0, 2],
      [2, 4]
    ]);
  });
});

describe("HancomReadService.search", () => {
  it("searches the same flattened document text used by readText", async () => {
    const service = new HancomReadService({} as never);
    const document: HancomDocument = {
      metadata: {
        capturedAt: "2026-03-29T00:00:00.000Z",
        source: "hwpjson20"
      },
      capabilities: {
        paragraphs: true,
        inlineRuns: false,
        tables: true,
        images: true,
        pageBoundaries: false
      },
      warnings: [],
      blocks: [
        {
          id: "p0",
          kind: "paragraph",
          text: "alpha",
          runs: [],
          paragraphStyle: {}
        },
        {
          id: "t0",
          kind: "table",
          rows: [
            {
              cells: [
                {
                  id: "c0",
                  blocks: [
                    {
                      id: "p1",
                      kind: "paragraph",
                      text: "beta",
                      runs: [],
                      paragraphStyle: {}
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          id: "i0",
          kind: "image",
          altText: "gamma"
        }
      ]
    };

    service.readDocument = async () => document;

    const result = await service.search("ha\nbe", { caseSensitive: true, contextWindow: 2 });

    expect(result).toMatchObject({
      query: "ha\nbe",
      total: 1
    });
    expect(result.matches[0]).toMatchObject({
      start: 3,
      end: 8,
      match: "ha\nbe",
      context: "phha\nbeta",
      crossedNodeBoundary: true,
      crossedSeparator: true
    });
  });

  it("rejects empty queries", async () => {
    const service = new HancomReadService({} as never);

    await expect(service.search("   ")).rejects.toBeInstanceOf(EditorPreconditionError);
  });
});
