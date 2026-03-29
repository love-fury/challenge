import { describe, expect, it } from "vitest";

import { parseHwpJson20Document } from "../src/hancom/hwpJson20.js";
import type { HwpJson20DocumentSnapshot } from "../src/models/types.js";

describe("parseHwpJson20Document style and image metadata", () => {
  it("infers heading level from style name when parseable", () => {
    const snapshot: HwpJson20DocumentSnapshot = {
      ro: {
        p0: {
          si: "style1",
          tx: "제목 문단"
        }
      },
      st: {
        style1: {
          na: "Heading 2",
          pp: "paraHeading2"
        }
      },
      pp: {
        paraHeading2: {
          lv: 160
        }
      },
      cs: {},
      cp: {}
    };

    const document = parseHwpJson20Document(snapshot);
    const paragraph = document.blocks[0];

    expect(paragraph?.kind).toBe("paragraph");
    if (paragraph?.kind !== "paragraph") {
      throw new Error("Expected a paragraph block.");
    }
    expect(paragraph.paragraphStyle.headingLevel).toBe(2);
  });

  it("reads static paragraph alignment and line spacing from para-shape", () => {
    const snapshot: HwpJson20DocumentSnapshot = {
      ro: {
        p0: {
          si: "styleLeft",
          tx: "왼쪽 문단"
        },
        p1: {
          si: "styleCenter",
          tx: "가운데 문단"
        },
        p2: {
          si: "styleRight",
          tx: "오른쪽 문단"
        },
        p3: {
          si: "styleJustify",
          tx: "양쪽 정렬 문단"
        },
        p4: {
          si: "styleUnknown",
          tx: "미해석 정렬 문단"
        }
      },
      st: {
        styleLeft: {
          pp: "paraLeft"
        },
        styleCenter: {
          pp: "paraCenter"
        },
        styleRight: {
          pp: "paraRight"
        },
        styleJustify: {
          pp: "paraJustify"
        },
        styleUnknown: {
          pp: "paraUnknown"
        }
      },
      pp: {
        paraLeft: {
          ah: 1,
          lv: 150
        },
        paraCenter: {
          ah: 3,
          lv: 160
        },
        paraRight: {
          ah: 2,
          lv: 170
        },
        paraJustify: {
          ah: 0,
          lv: 180
        },
        paraUnknown: {
          ah: 4,
          lv: 190
        }
      },
      cs: {},
      cp: {}
    };

    const document = parseHwpJson20Document(snapshot);
    const paragraphs = document.blocks;

    expect(paragraphs[0]?.kind).toBe("paragraph");
    if (paragraphs[0]?.kind !== "paragraph") {
      throw new Error("Expected a paragraph block.");
    }
    expect(paragraphs[0].paragraphStyle).toEqual({
      alignment: "left",
      lineSpacing: 1.5
    });
    expect(paragraphs[0].paraStyleVariants).toEqual([
      {
        paraStyleCode: "paraLeft",
        alignment: "left",
        lineSpacing: 1.5,
        rawCUt: 1
      }
    ]);

    expect(paragraphs[1]?.kind).toBe("paragraph");
    if (paragraphs[1]?.kind !== "paragraph") {
      throw new Error("Expected a paragraph block.");
    }
    expect(paragraphs[1].paragraphStyle.alignment).toBe("center");

    expect(paragraphs[2]?.kind).toBe("paragraph");
    if (paragraphs[2]?.kind !== "paragraph") {
      throw new Error("Expected a paragraph block.");
    }
    expect(paragraphs[2].paragraphStyle.alignment).toBe("right");

    expect(paragraphs[3]?.kind).toBe("paragraph");
    if (paragraphs[3]?.kind !== "paragraph") {
      throw new Error("Expected a paragraph block.");
    }
    expect(paragraphs[3].paragraphStyle.alignment).toBe("justify");

    expect(paragraphs[4]?.kind).toBe("paragraph");
    if (paragraphs[4]?.kind !== "paragraph") {
      throw new Error("Expected a paragraph block.");
    }
    expect(paragraphs[4].paragraphStyle).toEqual({
      lineSpacing: 1.9
    });
    expect(paragraphs[4].paraStyleVariants).toEqual([
      {
        paraStyleCode: "paraUnknown",
        lineSpacing: 1.9,
        rawCUt: 4
      }
    ]);
  });

  it("appends unanchored images after anchored blocks with a warning", () => {
    const snapshot: HwpJson20DocumentSnapshot = {
      ro: {
        p0: {
          tx: "Anchored paragraph"
        }
      },
      cs: {
        imgorphan: {
          rc: {
            img: {
              bi: "orphan-image.png"
            }
          }
        }
      },
      bi: [
        {
          mt: "image/png",
          sr: "orphan-image.png"
        }
      ]
    };

    const document = parseHwpJson20Document(snapshot);

    expect(document.blocks.map((block) => block.kind)).toEqual(["paragraph", "image"]);
    expect(document.warnings).toEqual([
      "Image control imgorphan has no traversed paragraph anchor in hwpjson20; it was appended after anchored blocks."
    ]);
    expect(document.capabilities.images).toBe(true);
  });
});
