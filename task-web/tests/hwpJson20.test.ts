import { describe, expect, it } from "vitest";

import { parseHwpJson20Document } from "../src/hancom/hwpJson20.js";
import type { HwpJson20DocumentSnapshot } from "../src/models/types.js";

// eslint-disable-next-line max-lines-per-function
describe("parseHwpJson20Document", () => {
  it("reads top-level paragraphs, table cell chains, and anchored images from hwpjson20", () => {
    const snapshot: HwpJson20DocumentSnapshot = {
      ro: {
        p0: {
          tx: "Intro paragraph"
        },
        p1: {
          tx: "<0B/74626C20/tbl1>"
        },
        p2: {
          tx: "<0B/67736F20/img1>"
        },
        p3: {
          tx: "Outro paragraph"
        }
      },
      sl: {
        "cell-a": {
          hp: "cell-a-p0"
        },
        "cell-a-p0": {
          tx: "A1"
        },
        "cell-b": {
          hp: "cell-b-p0"
        },
        "cell-b-p0": {
          tx: "B1 line 1",
          np: "cell-b-p1"
        },
        "cell-b-p1": {
          tx: "B1 line 2"
        }
      },
      cs: {
        tbl1: {
          tr: [[{ so: "cell-a" }, { so: "cell-b" }]],
          ch: {
            "cell-a": {
              ac: 0,
              ar: 0
            },
            "cell-b": {
              ac: 1,
              ar: 0
            }
          }
        },
        img1: {
          rc: {
            img: {
              bi: "placed-image.png"
            }
          }
        }
      },
      bi: [
        {
          mt: "image/png",
          sr: "placed-image.png"
        }
      ]
    };

    const document = parseHwpJson20Document(snapshot);

    expect(document.capabilities).toMatchObject({
      paragraphs: true,
      tables: true,
      images: true
    });
    expect(document.warnings).toEqual([]);
    expect(document.blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "table",
      "image",
      "paragraph"
    ]);

    const [intro, table, image, outro] = document.blocks;
    expect(intro?.kind).toBe("paragraph");
    if (intro?.kind !== "paragraph") {
      throw new Error("Expected an intro paragraph block.");
    }
    expect(intro.text).toBe("Intro paragraph");

    expect(table?.kind).toBe("table");
    if (table?.kind !== "table") {
      throw new Error("Expected a table block.");
    }
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]?.cells).toHaveLength(2);
    expect(table.rows[0]?.cells[0]?.blocks.map((block) => block.kind === "paragraph" ? block.text : block.kind)).toEqual(["A1"]);
    expect(table.rows[0]?.cells[1]?.blocks.map((block) => block.kind === "paragraph" ? block.text : block.kind)).toEqual([
      "B1 line 1",
      "B1 line 2"
    ]);

    expect(image?.kind).toBe("image");
    if (image?.kind !== "image") {
      throw new Error("Expected an image block.");
    }
    expect(image.source).toBe("placed-image.png");

    expect(outro?.kind).toBe("paragraph");
    if (outro?.kind !== "paragraph") {
      throw new Error("Expected an outro paragraph block.");
    }
    expect(outro.text).toBe("Outro paragraph");
  });

  it("keeps mixed text+image records as paragraphs instead of emitting a top-level image block", () => {
    const snapshot: HwpJson20DocumentSnapshot = {
      ro: {
        p0: {
          tx: "부<0B/67736F20/imginline>"
        }
      },
      cs: {
        imginline: {
          rc: {
            img: {
              bi: "inline-image.png"
            }
          }
        }
      },
      bi: [
        {
          mt: "image/png",
          sr: "inline-image.png"
        }
      ]
    };

    const document = parseHwpJson20Document(snapshot);

    expect(document.blocks).toHaveLength(1);
    expect(document.blocks[0]?.kind).toBe("paragraph");
    if (document.blocks[0]?.kind !== "paragraph") {
      throw new Error("Expected a paragraph block.");
    }
    expect(document.blocks[0].text).toBe("부");
    expect(document.blocks[0].controlIds).toEqual(["imginline"]);
    expect(document.capabilities.images).toBe(false);
  });

  it("promotes control-only table-cell paragraphs into nested image blocks", () => {
    const snapshot: HwpJson20DocumentSnapshot = {
      ro: {
        p0: {
          tx: "<0B/74626C20/tbl1>"
        }
      },
      sl: {
        cell0: {
          hp: "cell0-p0"
        },
        "cell0-p0": {
          tx: "<0B/67736F20/imgincell>"
        }
      },
      cs: {
        tbl1: {
          tr: [[{ so: "cell0" }]],
          ch: {
            cell0: {
              ac: 0,
              ar: 0
            }
          }
        },
        imgincell: {
          img: {
            bi: "cell-image.png"
          }
        }
      },
      bi: [
        {
          mt: "image/png",
          sr: "cell-image.png"
        }
      ]
    };

    const document = parseHwpJson20Document(snapshot);
    const table = document.blocks[0];

    expect(table?.kind).toBe("table");
    if (table?.kind !== "table") {
      throw new Error("Expected a table block.");
    }
    expect(table.rows[0]?.cells[0]?.blocks).toHaveLength(1);
    expect(table.rows[0]?.cells[0]?.blocks[0]?.kind).toBe("image");
    if (table.rows[0]?.cells[0]?.blocks[0]?.kind !== "image") {
      throw new Error("Expected an image block.");
    }
    expect(table.rows[0]?.cells[0]?.blocks[0]?.controlId).toBe("imgincell");
    expect(document.capabilities.images).toBe(true);
  });

  it("falls back to direct payload paragraphs when no sublist chain exists", () => {
    const snapshot: HwpJson20DocumentSnapshot = {
      ro: {
        p0: {
          tx: "<0B/74626C20/tbl1>"
        }
      },
      cs: {
        tbl1: {
          tr: [["cell-a"]],
          ch: {
            "cell-a": {
              tx: "Cell"
            }
          }
        }
      }
    };

    const document = parseHwpJson20Document(snapshot);
    const table = document.blocks[0];

    expect(table?.kind).toBe("table");
    if (table?.kind !== "table") {
      throw new Error("Expected a table block.");
    }
    expect(table.rows[0]?.cells[0]?.blocks[0]?.kind).toBe("paragraph");
    if (table.rows[0]?.cells[0]?.blocks[0]?.kind !== "paragraph") {
      throw new Error("Expected a paragraph block.");
    }
    expect(table.rows[0]?.cells[0]?.blocks[0]?.text).toBe("Cell");
  });

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
