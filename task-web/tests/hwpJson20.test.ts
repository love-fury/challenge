/* eslint-disable max-lines */

import { describe, expect, it } from "vitest";

import { parseHwpJson20Document } from "../src/hancom/hwpJson20.js";
import type { HwpJson20DocumentSnapshot } from "../src/models/types.js";

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

  it("strips unresolved inline special tokens from visible paragraph text", () => {
    const snapshot: HwpJson20DocumentSnapshot = {
      ro: {
        p0: {
          tx: "목차<09/00005D8C/00200203/00200020>1"
        }
      }
    };

    const document = parseHwpJson20Document(snapshot);

    expect(document.blocks).toHaveLength(1);
    expect(document.blocks[0]?.kind).toBe("paragraph");
    if (document.blocks[0]?.kind !== "paragraph") {
      throw new Error("Expected a paragraph block.");
    }
    expect(document.blocks[0].text).toBe("목차1");
  });

  it("normalizes standalone inline placeholder tokens into visible separators", () => {
    const snapshot: HwpJson20DocumentSnapshot = {
      ro: {
        p0: {
          tx: "2024.<1F>5<0A>부록"
        }
      }
    };

    const document = parseHwpJson20Document(snapshot);

    expect(document.blocks).toHaveLength(1);
    expect(document.blocks[0]?.kind).toBe("paragraph");
    if (document.blocks[0]?.kind !== "paragraph") {
      throw new Error("Expected a paragraph block.");
    }
    expect(document.blocks[0].text).toBe("2024. 5\n부록");
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

  it("normalizes empty table cells into explicit empty paragraph blocks", () => {
    const snapshot: HwpJson20DocumentSnapshot = {
      ro: {
        p0: {
          tx: "<0B/74626C20/tbl1>"
        }
      },
      cs: {
        tbl1: {
          tr: [[{ so: "cell-a" }]],
          ch: {
            "cell-a": {}
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
    expect(table.rows[0]?.cells[0]?.blocks).toHaveLength(1);
    expect(table.rows[0]?.cells[0]?.blocks[0]?.kind).toBe("paragraph");
    if (table.rows[0]?.cells[0]?.blocks[0]?.kind !== "paragraph") {
      throw new Error("Expected a paragraph block.");
    }
    expect(table.rows[0]?.cells[0]?.blocks[0]?.text).toBe("");
  });

  it("keeps control-only empty table-cell paragraphs as explicit empty blocks", () => {
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
          tx: "<15/70676864/pghd0>",
          pp: "para0",
          si: "style0"
        }
      },
      cs: {
        tbl1: {
          tr: [[{ so: "cell0" }]],
          ch: {
            cell0: {}
          }
        },
        pghd0: {}
      },
      pp: {
        para0: {
          ah: 3,
          lv: 160
        }
      },
      st: {
        style0: {}
      }
    };

    const document = parseHwpJson20Document(snapshot);
    const table = document.blocks[0];

    expect(table?.kind).toBe("table");
    if (table?.kind !== "table") {
      throw new Error("Expected a table block.");
    }
    expect(table.rows[0]?.cells[0]?.blocks).toHaveLength(1);
    expect(table.rows[0]?.cells[0]?.blocks[0]?.kind).toBe("paragraph");
    if (table.rows[0]?.cells[0]?.blocks[0]?.kind !== "paragraph") {
      throw new Error("Expected a paragraph block.");
    }
    expect(table.rows[0]?.cells[0]?.blocks[0]?.text).toBe("");
    expect(table.rows[0]?.cells[0]?.blocks[0]?.controlIds).toEqual(["pghd0"]);
  });

  it("derives dominantTextStyle from actual runs instead of the style entry default", () => {
    const snapshot: HwpJson20DocumentSnapshot = {
      ro: {
        p0: {
          tx: "Alpha",
          tp: [0, "char-run"],
          si: "style-default"
        }
      },
      cp: {
        "char-run": {
          f1: "돋움체",
          he: 1100,
          bo: false,
          it: false,
          tc: 0
        },
        "char-default": {
          f1: "함초롬바탕",
          he: 1000,
          bo: true,
          it: false,
          tc: 0
        }
      },
      st: {
        "style-default": {
          cp: "char-default"
        }
      }
    };

    const document = parseHwpJson20Document(snapshot);
    const paragraph = document.blocks[0];

    expect(paragraph?.kind).toBe("paragraph");
    if (paragraph?.kind !== "paragraph") {
      throw new Error("Expected a paragraph block.");
    }
    expect(paragraph.runs[0]?.textStyle).toEqual({
      fontName: "돋움체",
      fontSize: 11,
      bold: false,
      italic: false,
      color: "#000000"
    });
    expect(paragraph.dominantTextStyle).toEqual(paragraph.runs[0]?.textStyle);
  });

  it("omits dominantTextStyle when a paragraph contains mixed run styles", () => {
    const snapshot: HwpJson20DocumentSnapshot = {
      ro: {
        p0: {
          tx: "ABCD",
          tp: [0, "char-a", 2, "char-b"]
        }
      },
      cp: {
        "char-a": {
          f1: "돋움체",
          he: 1000,
          bo: false,
          it: false,
          tc: 0
        },
        "char-b": {
          f1: "함초롬바탕",
          he: 1200,
          bo: true,
          it: false,
          tc: 255
        }
      }
    };

    const document = parseHwpJson20Document(snapshot);
    const paragraph = document.blocks[0];

    expect(paragraph?.kind).toBe("paragraph");
    if (paragraph?.kind !== "paragraph") {
      throw new Error("Expected a paragraph block.");
    }
    expect(paragraph.runs).toHaveLength(2);
    expect(paragraph.dominantTextStyle).toBeUndefined();
  });

  it("reads control-only non-table sl paragraphs as anchored image blocks", () => {
    const snapshot: HwpJson20DocumentSnapshot = {
      ro: {
        p0: {
          tx: "Body start"
        }
      },
      sl: {
        "sl-image": {
          tx: "<0B/67736F20/slimg1>"
        }
      },
      cs: {
        slimg1: {
          rc: {
            img: {
              bi: "sl-image.png"
            }
          }
        }
      },
      bi: [
        {
          mt: "image/png",
          sr: "sl-image.png"
        }
      ]
    };

    const document = parseHwpJson20Document(snapshot);

    expect(document.blocks.map((block) => block.kind)).toEqual(["paragraph", "image"]);
    expect(document.blocks[1]?.kind).toBe("image");
    if (document.blocks[1]?.kind !== "image") {
      throw new Error("Expected an image block.");
    }
    expect(document.blocks[1].source).toBe("sl-image.png");
    expect(document.warnings).toEqual([]);
  });

  it("does not emit duplicate blocks when an sl paragraph repeats a ro control id", () => {
    const snapshot: HwpJson20DocumentSnapshot = {
      ro: {
        p0: {
          tx: "<0B/67736F20/sharedimg>"
        }
      },
      sl: {
        "sl-image": {
          tx: "<0B/67736F20/sharedimg>"
        },
        "sl-text": {
          tx: "Trailing"
        }
      },
      cs: {
        sharedimg: {
          rc: {
            img: {
              bi: "shared-image.png"
            }
          }
        }
      },
      bi: [
        {
          mt: "image/png",
          sr: "shared-image.png"
        }
      ]
    };

    const document = parseHwpJson20Document(snapshot);
    expect(document.blocks[0]?.kind).toBe("image");
    if (document.blocks[0]?.kind !== "image") {
      throw new Error("Expected an image block.");
    }
    expect(document.blocks[1]?.kind).toBe("paragraph");
    if (document.blocks[1]?.kind !== "paragraph") {
      throw new Error("Expected a paragraph block.");
    }
    expect(document.blocks[1].text).toBe("Trailing");
    expect(document.warnings).toEqual([]);
  });

});
