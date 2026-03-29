import { describe, expect, it } from "vitest";

import {
  flattenDocumentText,
  normalizeTableMatrix,
  resolveParagraphBlock,
  resolveTableBlock,
  summarizeParagraphFormatting
} from "../src/utils/document.js";
import type {
  HancomDocument,
  ParagraphBlock,
  TableCellMatrix
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

describe("document utils", () => {
  it("flattens paragraphs, table cells, nested tables, and image labels into a single text view", () => {
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
        createParagraph("p0", "Intro"),
        {
          id: "table-0",
          kind: "table",
          rows: [
            {
              cells: [
                {
                  id: "cell-0-0",
                  blocks: [
                    createParagraph("cell-p0", "A1"),
                    {
                      id: "nested-table",
                      kind: "table",
                      rows: [
                        {
                          cells: [
                            {
                              id: "nested-cell",
                              blocks: [createParagraph("nested-p0", "Nested")]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  id: "cell-0-1",
                  blocks: [
                    {
                      id: "img-0",
                      kind: "image",
                      altText: "Diagram",
                      caption: "Overview"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          id: "img-1",
          kind: "image",
          altText: "Hero"
        }
      ]
    };

    expect(flattenDocumentText(document)).toBe("Intro\nA1\nNested\tDiagram Overview\nHero");
  });

  it("rejects empty or irregular table matrices", () => {
    expect(() => normalizeTableMatrix([])).toThrow("at least one row");
    expect(() => normalizeTableMatrix([[]])).toThrow("at least one column");
    expect(() => normalizeTableMatrix([["A"], ["B", "C"]])).toThrow("rectangular");
  });

  it("returns the same matrix when table data is rectangular", () => {
    const matrix: TableCellMatrix = [["A", "B"], ["C", "D"]];

    expect(normalizeTableMatrix(matrix)).toBe(matrix);
  });

  it("resolves paragraph and table blocks by index and id", () => {
    const document: HancomDocument = {
      metadata: {
        capturedAt: "2026-03-29T00:00:00.000Z",
        source: "hwpjson20"
      },
      capabilities: {
        paragraphs: true,
        inlineRuns: false,
        tables: true,
        images: false,
        pageBoundaries: false
      },
      warnings: [],
      blocks: [
        createParagraph("p0", "First"),
        {
          id: "table-0",
          kind: "table",
          rows: [{ cells: [{ id: "cell-0", blocks: [createParagraph("cell-p0", "A1")] }] }]
        },
        createParagraph("p1", "Second")
      ]
    };

    expect(resolveParagraphBlock(document, 1)).toMatchObject({
      paragraph: { id: "p1" },
      blockIndex: 2,
      paragraphIndex: 1
    });
    expect(resolveParagraphBlock(document, "p0")).toMatchObject({
      paragraph: { id: "p0" },
      blockIndex: 0,
      paragraphIndex: 0
    });
    expect(resolveParagraphBlock(document, "missing")).toBeNull();

    expect(resolveTableBlock(document, 0)).toMatchObject({
      table: { id: "table-0" },
      blockIndex: 1,
      tableIndex: 0
    });
    expect(resolveTableBlock(document, "table-0")).toMatchObject({
      table: { id: "table-0" },
      blockIndex: 1,
      tableIndex: 0
    });
    expect(resolveTableBlock(document, 1)).toBeNull();
  });

  it("summarizes deduplicated text and paragraph style variants", () => {
    const paragraph = createParagraph("p0", "AlphaBeta", {
      runs: [
        {
          text: "Alpha",
          start: 0,
          end: 5,
          textStyle: {
            color: "#111111",
            bold: true,
            fontName: "Han Sans",
            fontSize: 11,
            italic: false
          }
        },
        {
          text: "Beta",
          start: 5,
          end: 9,
          textStyle: {
            fontSize: 11,
            italic: false,
            bold: true,
            fontName: "Han Sans",
            color: "#111111"
          }
        }
      ],
      paraStyleRefs: ["style-0", "style-0", "style-1"],
      paraStyleVariants: [
        {
          paraStyleCode: "body",
          rawCUt: 384,
          alignment: "justify"
        },
        {
          alignment: "justify",
          paraStyleCode: "body",
          rawCUt: 384
        }
      ],
      paragraphStyleConsistent: true
    });

    expect(summarizeParagraphFormatting(paragraph)).toEqual({
      paragraphId: "p0",
      dominantTextStyle: {
        bold: true,
        color: "#111111",
        fontName: "Han Sans",
        fontSize: 11,
        italic: false
      },
      paragraphStyle: {},
      hasMixedTextStyles: false,
      textStyleVariants: [
        {
          bold: true,
          color: "#111111",
          fontName: "Han Sans",
          fontSize: 11,
          italic: false
        }
      ],
      paraStyleRefs: ["style-0", "style-1"],
      paragraphStyleConsistent: true,
      paraStyleVariants: [
        {
          paraStyleCode: "body",
          alignment: "justify",
          rawCUt: 384
        }
      ],
      hasMixedParagraphStyles: false
    });
  });
});
