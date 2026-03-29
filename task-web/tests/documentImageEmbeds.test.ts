import { describe, expect, it } from "vitest";

import { applyEmbeddedImages, collectDocumentImageSources } from "../src/hancom/documentImageEmbeds.js";
import type { HancomDocument } from "../src/models/types.js";

const sampleDocument: HancomDocument = {
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
      source: "https://example.com/top.png"
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
                  source: "https://example.com/nested.png"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

describe("documentImageEmbeds", () => {
  it("collects unique image sources across top-level and nested blocks", () => {
    expect(collectDocumentImageSources(sampleDocument)).toEqual([
      "https://example.com/top.png",
      "https://example.com/nested.png"
    ]);
  });

  it("applies base64 data to top-level and nested image blocks", () => {
    const embedded = applyEmbeddedImages(sampleDocument, {
      "https://example.com/top.png": {
        mimeType: "image/png",
        base64: "AAA="
      },
      "https://example.com/nested.png": {
        mimeType: "image/png",
        base64: "BBB="
      }
    });

    expect(embedded.warnings).toEqual([]);
    expect(embedded.document.blocks[0]).toMatchObject({
      kind: "image",
      mimeType: "image/png",
      base64: "AAA="
    });
    expect(embedded.document.blocks[1]?.kind).toBe("table");
    if (embedded.document.blocks[1]?.kind !== "table") {
      throw new Error("Expected a table block.");
    }
    expect(embedded.document.blocks[1].rows[0]?.cells[0]?.blocks[0]).toMatchObject({
      kind: "image",
      mimeType: "image/png",
      base64: "BBB="
    });
  });

  it("reports warnings when an image source cannot be embedded", () => {
    const embedded = applyEmbeddedImages(sampleDocument, {
      "https://example.com/top.png": {
        mimeType: "image/png",
        base64: "AAA="
      }
    });

    expect(embedded.warnings).toEqual([
      "Could not embed base64 data for image source https://example.com/nested.png."
    ]);
  });
});
