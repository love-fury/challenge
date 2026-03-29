import { describe, expect, it } from "vitest";

import { applyLiveImageSources } from "../src/hancom/documentImageSources.js";
import type { HancomDocument } from "../src/models/types.js";

describe("applyLiveImageSources", () => {
  it("replaces image asset filenames with live URLs in top-level and nested image blocks", () => {
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
          id: "image-top",
          kind: "image",
          source: "asset-top.png"
        },
        {
          id: "table-0",
          kind: "table",
          rows: [
            {
              cells: [
                {
                  id: "cell-0",
                  blocks: [
                    {
                      id: "image-nested",
                      kind: "image",
                      source: "asset-nested.png"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    const enriched = applyLiveImageSources(document, {
      "asset-top.png": "blob:top",
      "asset-nested.png": "blob:nested"
    });

    expect(enriched.blocks[0]).toMatchObject({
      kind: "image",
      source: "blob:top"
    });
    expect(enriched.blocks[1]).toMatchObject({
      kind: "table"
    });
    if (enriched.blocks[1]?.kind !== "table") {
      throw new Error("Expected a table block.");
    }
    expect(enriched.blocks[1].rows[0]?.cells[0]?.blocks[0]).toMatchObject({
      kind: "image",
      source: "blob:nested"
    });
  });
});
