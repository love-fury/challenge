import { describe, expect, it } from "vitest";

import { HancomReadService } from "../src/hancom/HancomReadService.js";
import { exportDocumentToJson } from "../src/operations/json.js";
import type { HancomDocument, JsonExportPayload } from "../src/models/types.js";

const sampleDocument: HancomDocument = {
  metadata: {
    capturedAt: "2026-03-29T00:00:00.000Z",
    source: "hwpjson20",
    title: "Sample"
  },
  capabilities: {
    paragraphs: true,
    inlineRuns: true,
    tables: false,
    images: false,
    pageBoundaries: false
  },
  warnings: ["warn-a", "warn-a", "warn-b"],
  blocks: [
    {
      id: "p0",
      kind: "paragraph",
      text: "Alpha",
      runs: [
        {
          text: "Alpha",
          start: 0,
          end: 5,
          textStyle: {
            bold: true,
            color: "#000000"
          }
        }
      ],
      paragraphStyle: {
        headingLevel: 1
      },
      rawNodeIds: ["raw-0"]
    }
  ],
  raw: {
    ro: {
      p0: {
        tx: "Alpha"
      }
    }
  }
};

describe("exportDocumentToJson", () => {
  it("returns a serialized JSON envelope", () => {
    const payload = JSON.parse(exportDocumentToJson(sampleDocument)) as JsonExportPayload;

    expect(payload.schemaVersion).toBe("2026-03-29");
    expect(payload.document.metadata.title).toBe("Sample");
    expect(payload.document.blocks[0]).toMatchObject({
      id: "p0",
      kind: "paragraph"
    });
    expect(payload.warnings).toEqual(["warn-a", "warn-b"]);
  });

  it("can omit warnings and include the raw snapshot", () => {
    const payload = JSON.parse(exportDocumentToJson(sampleDocument, {
      includeWarnings: false,
      includeRawSnapshot: true,
      pretty: false
    })) as JsonExportPayload;

    expect(payload.warnings).toBeUndefined();
    expect(payload.rawSnapshot).toEqual(sampleDocument.raw);
  });
});

describe("HancomReadService.exportJson", () => {
  it("serializes the internal document snapshot to JSON text", async () => {
    const service = new HancomReadService({} as never);
    service.readDocument = () => Promise.resolve(sampleDocument);

    const payload = JSON.parse(await service.exportJson()) as JsonExportPayload;

    expect(payload.document.blocks).toHaveLength(1);
    expect(payload.document.blocks[0]?.id).toBe("p0");
  });

  it("can embed image blocks as base64 when requested", async () => {
    const service = new HancomReadService({} as never);
    service.readDocument = () =>
      Promise.resolve({
        ...sampleDocument,
        capabilities: {
          ...sampleDocument.capabilities,
          images: true
        },
        blocks: [
          ...sampleDocument.blocks,
          {
            id: "img-0",
            kind: "image",
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

    const payload = JSON.parse(await service.exportJson({ includeImages: true })) as JsonExportPayload;

    expect(payload.document.blocks[1]).toMatchObject({
      kind: "image",
      mimeType: "image/png",
      base64: "AAA="
    });
  });
});
