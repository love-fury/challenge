import { describe, expect, it, vi } from "vitest";

import { HancomReadService } from "../src/hancom/HancomReadService.js";
import type {
  HancomDocument,
  HwpJson20DocumentSnapshot,
  ParagraphBlock
} from "../src/models/types.js";

function createParagraph(
  id: string,
  text: string,
  overrides: Partial<ParagraphBlock> = {}
): ParagraphBlock {
  return {
    id,
    kind: "paragraph",
    text,
    runs: [],
    paragraphStyle: {},
    ...overrides
  };
}

function createDocument(): HancomDocument {
  return {
    metadata: {
      capturedAt: "2026-03-29T00:00:00.000Z",
      source: "hwpjson20"
    },
    capabilities: {
      paragraphs: true,
      inlineRuns: true,
      tables: false,
      images: true,
      pageBoundaries: true
    },
    warnings: [],
    blocks: [
      createParagraph("p0", "AlphaBeta", {
        rawNodeIds: ["node-0"],
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
            text: "Beta",
            start: 5,
            end: 9,
            textStyle: {
              italic: true
            }
          }
        ],
        paragraphStyle: {
          headingLevel: 1
        },
        pageRange: {
          start: 4,
          end: 4
        },
        dominantTextStyle: {
          bold: true
        },
        paraStyleRefs: ["body"],
        paraStyleVariants: [
          {
            paraStyleCode: "body",
            alignment: "justify"
          }
        ]
      }),
      {
        id: "img-0",
        kind: "image",
        source: "blob:original"
      }
    ]
  };
}

describe("HancomReadService", () => {
  it("throws when the runtime hwpjson20 snapshot is unavailable", async () => {
    const service = new HancomReadService({} as never);
    (service as unknown as {
      hwpJson20Reader: { readSnapshot: () => Promise<null> };
    }).hwpJson20Reader = {
      readSnapshot: vi.fn().mockResolvedValue(null)
    };

    await expect(service.readDocument()).rejects.toMatchObject({
      name: "CapabilityUnavailableError",
      message: expect.stringContaining("runtime hwpjson20 snapshot")
    });
  });

  it("parses the snapshot and merges live image sources", async () => {
    const snapshot: HwpJson20DocumentSnapshot = {
      ro: {
        p0: {
          tx: "Alpha"
        },
        p1: {
          tx: "<0B/67736F20/img1>"
        }
      },
      cs: {
        img1: {
          rc: {
            img: {
              bi: "asset.png"
            }
          }
        }
      },
      bi: [
        {
          mt: "image/png",
          sr: "asset.png"
        }
      ]
    };
    const service = new HancomReadService({} as never);
    (service as unknown as {
      hwpJson20Reader: {
        readSnapshot: () => Promise<HwpJson20DocumentSnapshot>;
        readLiveImageSourceMap: () => Promise<Record<string, string>>;
      };
    }).hwpJson20Reader = {
      readSnapshot: vi.fn().mockResolvedValue(snapshot),
      readLiveImageSourceMap: vi.fn().mockResolvedValue({
        "asset.png": "blob:live-image"
      })
    };

    const document = await service.readDocument();

    expect(document.blocks[1]).toMatchObject({
      kind: "image",
      source: "blob:live-image"
    });
  });

  it("merges image embedding warnings into markdown and json exports", async () => {
    const service = new HancomReadService({} as never);
    service.readDocument = vi.fn().mockResolvedValue({
      ...createDocument(),
      warnings: ["base-warning"]
    });
    (service as unknown as {
      hwpJson20Reader: {
        readImageBase64Map: (sources: string[]) => Promise<Record<string, { mimeType?: string; base64: string }>>;
      };
    }).hwpJson20Reader = {
      readImageBase64Map: vi.fn().mockResolvedValue({})
    };

    const markdown = await service.exportMarkdown({
      includeImagesAsDataUrls: true,
      includeWarningsAsComments: true
    });
    const json = JSON.parse(await service.exportJson({ includeImages: true })) as {
      warnings?: string[];
    };

    expect(markdown).toContain("base-warning");
    expect(markdown).toContain("Could not embed base64 data for image source blob:original.");
    expect(json.warnings).toEqual([
      "base-warning",
      "Could not embed base64 data for image source blob:original."
    ]);
  });

  it("returns paragraph formatting for a resolved locator and rejects missing paragraphs", async () => {
    const service = new HancomReadService({} as never);
    service.readDocument = vi.fn().mockResolvedValue(createDocument());

    await expect(service.getParagraphFormatting("p0")).resolves.toMatchObject({
      paragraphId: "p0",
      hasMixedTextStyles: true,
      paraStyleRefs: ["body"]
    });
    await expect(service.getParagraphFormatting("missing")).rejects.toMatchObject({
      name: "EditorPreconditionError"
    });
  });

  it("prefers the live caret page number and resolves the run index from the text offset", async () => {
    const session = {
      evaluate: vi.fn().mockResolvedValue({
        nodeId: "node-0",
        textOffset: 6,
        currentPageNumber: 9,
        positionType: 0
      })
    };
    const service = new HancomReadService(session as never);
    service.readDocument = vi.fn().mockResolvedValue(createDocument());

    await expect(service.getCaretPosition()).resolves.toEqual({
      blockId: "p0",
      blockIndex: 0,
      pageNumber: 9,
      paragraphId: "p0",
      runIndex: 1,
      textOffset: 6
    });
  });

  it("falls back to the paragraph page range when the live caret page is unavailable", async () => {
    const session = {
      evaluate: vi.fn().mockResolvedValue({
        nodeId: "node-0",
        textOffset: 9,
        currentPageNumber: null,
        positionType: 0
      })
    };
    const service = new HancomReadService(session as never);
    service.readDocument = vi.fn().mockResolvedValue(createDocument());

    await expect(service.getCaretPosition()).resolves.toMatchObject({
      pageNumber: 4,
      runIndex: 1
    });
  });

  it("throws when the caret runtime state is missing or cannot be mapped", async () => {
    const session = {
      evaluate: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          nodeId: "missing-node",
          textOffset: 0,
          currentPageNumber: null,
          positionType: 0
        })
    };
    const service = new HancomReadService(session as never);
    service.readDocument = vi.fn().mockResolvedValue(createDocument());

    await expect(service.getCaretPosition()).rejects.toMatchObject({
      name: "CapabilityUnavailableError",
      message: expect.stringContaining("Current caret position is unavailable")
    });
    await expect(service.getCaretPosition()).rejects.toMatchObject({
      name: "CapabilityUnavailableError",
      message: expect.stringContaining("Could not map caret node")
    });
  });
});
