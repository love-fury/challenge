import type { HancomDocument } from "../src/models/types.js";

export const sampleDocument: HancomDocument = {
  metadata: {
    title: "Sample Hancom Document",
    capturedAt: "2026-03-29T00:00:00.000Z",
    source: "text-chain"
  },
  capabilities: {
    paragraphs: true,
    inlineRuns: true,
    tables: true,
    images: true,
    pageBoundaries: false
  },
  warnings: [],
  blocks: [
    {
      id: "sample-paragraph-0",
      kind: "paragraph",
      text: "Quarterly Summary",
      runs: [
        {
          text: "Quarterly Summary",
          start: 0,
          end: "Quarterly Summary".length,
          textStyle: {
            bold: true
          }
        }
      ],
      dominantTextStyle: {
        bold: true
      },
      paragraphStyle: {
        headingLevel: 2
      }
    },
    {
      id: "sample-paragraph-1",
      kind: "paragraph",
      text: "Hancom Docs reverse engineering notes",
      runs: [
        {
          text: "Hancom Docs reverse engineering notes",
          start: 0,
          end: "Hancom Docs reverse engineering notes".length,
          textStyle: {
            italic: true
          }
        }
      ],
      dominantTextStyle: {
        italic: true
      },
      paragraphStyle: {}
    },
    {
      id: "sample-table-0",
      kind: "table",
      rows: [
        {
          cells: [
            {
              id: "sample-table-0-cell-0-0",
              blocks: [
                {
                  id: "sample-table-0-paragraph-0-0",
                  kind: "paragraph",
                  text: "Capability",
                  runs: [
                    {
                      text: "Capability",
                      start: 0,
                      end: "Capability".length,
                      textStyle: {}
                    }
                  ],
                  paragraphStyle: {}
                }
              ]
            },
            {
              id: "sample-table-0-cell-0-1",
              blocks: [
                {
                  id: "sample-table-0-paragraph-0-1",
                  kind: "paragraph",
                  text: "Status",
                  runs: [
                    {
                      text: "Status",
                      start: 0,
                      end: "Status".length,
                      textStyle: {}
                    }
                  ],
                  paragraphStyle: {}
                }
              ]
            }
          ]
        },
        {
          cells: [
            {
              id: "sample-table-0-cell-1-0",
              blocks: [
                {
                  id: "sample-table-0-paragraph-1-0",
                  kind: "paragraph",
                  text: "readText",
                  runs: [
                    {
                      text: "readText",
                      start: 0,
                      end: "readText".length,
                      textStyle: {}
                    }
                  ],
                  paragraphStyle: {}
                }
              ]
            },
            {
              id: "sample-table-0-cell-1-1",
              blocks: [
                {
                  id: "sample-table-0-paragraph-1-1",
                  kind: "paragraph",
                  text: "planned",
                  runs: [
                    {
                      text: "planned",
                      start: 0,
                      end: "planned".length,
                      textStyle: {}
                    }
                  ],
                  paragraphStyle: {}
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: "sample-image-0",
      kind: "image",
      altText: "canvas architecture",
      source: "https://example.com/canvas.png"
    }
  ]
};
