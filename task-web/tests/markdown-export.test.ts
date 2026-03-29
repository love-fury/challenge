import { describe, expect, it } from "vitest";

import { HancomReadService } from "../src/hancom/HancomReadService.js";
import { exportDocumentToMarkdown } from "../src/operations/markdown.js";
import type { HancomDocument } from "../src/models/types.js";

const sampleDocument: HancomDocument = {
  metadata: {
    capturedAt: "2026-03-29T00:00:00.000Z",
    source: "hwpjson20"
  },
  capabilities: {
    paragraphs: true,
    inlineRuns: true,
    tables: true,
    images: true,
    pageBoundaries: false
  },
  warnings: ["page-boundary-not-rendered"],
  blocks: [
    {
      id: "p0",
      kind: "paragraph",
      text: "Alpha Beta",
      runs: [
        {
          text: "Alpha",
          start: 0,
          end: 5,
          textStyle: {
            bold: true
          }
        },
        {
          text: " Beta",
          start: 5,
          end: 10,
          textStyle: {
            italic: true
          }
        }
      ],
      paragraphStyle: {
        headingLevel: 2
      }
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
                  text: "H1",
                  runs: [],
                  paragraphStyle: {}
                }
              ]
            },
            {
              id: "c1",
              blocks: [
                {
                  id: "p2",
                  kind: "paragraph",
                  text: "H2",
                  runs: [],
                  paragraphStyle: {}
                }
              ]
            }
          ]
        },
        {
          cells: [
            {
              id: "c2",
              blocks: [
                {
                  id: "p3",
                  kind: "paragraph",
                  text: "A",
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
      altText: "diagram",
      source: "blob:alpha"
    }
  ]
};

describe("exportDocumentToMarkdown", () => {
  it("renders headings, inline emphasis, tables, and images", () => {
    expect(exportDocumentToMarkdown(sampleDocument)).toContain("## **Alpha*** Beta*");
    expect(exportDocumentToMarkdown(sampleDocument)).toContain("| H1 | H2 |");
    expect(exportDocumentToMarkdown(sampleDocument)).toContain("| A |  |");
    expect(exportDocumentToMarkdown(sampleDocument)).toContain("![diagram](blob:alpha)");
  });

  it("can render images as data URLs when base64 is available", () => {
    const markdown = exportDocumentToMarkdown({
      ...sampleDocument,
      blocks: sampleDocument.blocks.map((block) =>
        block.kind === "image"
          ? {
              ...block,
              mimeType: "image/png",
              base64: "AAA="
            }
          : block
      )
    }, {
      includeImagesAsDataUrls: true
    });

    expect(markdown).toContain("![diagram](data:image/png;base64,AAA=)");
  });

  it("adds warning comments when requested", () => {
    const markdown = exportDocumentToMarkdown(sampleDocument, {
      includeWarningsAsComments: true
    });

    expect(markdown).toContain("<!--");
    expect(markdown).toContain("table-irregular-row");
    expect(markdown).toContain("table-span-unresolved");
    expect(markdown).toContain("page-boundary-not-rendered");
  });

  it("falls back to HTML when a table cell contains a nested table", () => {
    const markdown = exportDocumentToMarkdown({
      ...sampleDocument,
      blocks: [
        {
          id: "t-parent",
          kind: "table",
          rows: [
            {
              cells: [
                {
                  id: "parent-cell",
                  blocks: [
                    {
                      id: "nested",
                      kind: "table",
                      rows: [
                        {
                          cells: [
                            {
                              id: "nested-cell",
                              blocks: [
                                {
                                  id: "nested-paragraph",
                                  kind: "paragraph",
                                  text: "X",
                                  runs: [],
                                  paragraphStyle: {}
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }, {
      includeWarningsAsComments: true
    });

    expect(markdown).toContain("<table>");
    expect(markdown).toContain("table-nested-table-html-fallback");
  });
});

describe("HancomReadService.exportMarkdown", () => {
  it("uses the same internal document snapshot pipeline as other read helpers", async () => {
    const service = new HancomReadService({} as never);
    service.readDocument = () => Promise.resolve(sampleDocument);

    await expect(service.exportMarkdown()).resolves.toContain("![diagram](blob:alpha)");
  });

  it("can embed images as data URLs when requested", async () => {
    const service = new HancomReadService({} as never);
    service.readDocument = () =>
      Promise.resolve({
        ...sampleDocument,
        blocks: [
          ...sampleDocument.blocks.slice(0, -1),
          {
            id: "i0",
            kind: "image" as const,
            altText: "diagram",
            source: "https://example.com/image.png"
          }
        ]
      });
    (service as unknown as {
      hwpJson20Reader: {
        readImageBase64Map: (sources: string[]) => Promise<Record<string, { mimeType?: string; base64: string }>>;
      };
    }).hwpJson20Reader = {
      readImageBase64Map: (sources) =>
        Promise.resolve({
          [sources[0] ?? ""]: {
            mimeType: "image/png",
            base64: "AAA="
          }
        })
    };

    await expect(service.exportMarkdown({ includeImagesAsDataUrls: true })).resolves.toContain(
      "![diagram](data:image/png;base64,AAA=)"
    );
  });
});
