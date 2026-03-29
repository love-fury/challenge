import { describe, expect, it } from "vitest";

import {
  collectFrTableBlocks,
  parseFrLine,
  parseFrLineExport
} from "../src/hancom/discovery/05-static-deob/frLineExport.js";

describe("parseFrLine", () => {
  it("parses paragraph style, table coordinates, and text", () => {
    const line = parseFrLine("<$p8:0;s바탕글 사본16;t4:0:0$>담당 부서");

    expect(line).toEqual({
      raw: "<$p8:0;s바탕글 사본16;t4:0:0$>담당 부서",
      listId: 8,
      paraId: 0,
      styleName: "바탕글 사본16",
      parentRef: {
        kind: "table",
        name: "t4",
        rowAddr: 0,
        colAddr: 0
      },
      text: "담당 부서"
    });
  });

  it("parses heading and bullet markers", () => {
    const outline = parseFrLine("<$p0:1;s본문;h12:2$>Heading");
    const charBullet = parseFrLine("<$p0:2;b7:•$>Bullet");
    const imageBullet = parseFrLine("<$p0:3;i9$>Image bullet");

    expect(outline?.heading).toEqual({
      type: "para",
      id: 12,
      level: 2
    });
    expect(charBullet?.heading).toEqual({
      type: "charbullet",
      id: 7,
      char: "•"
    });
    expect(imageBullet?.heading).toEqual({
      type: "imgbullet",
      id: 9
    });
  });

  it("parses nested table cell references with parentCellPos", () => {
    const line = parseFrLine("<$p4:1;t1:0:0;t2:1:3$>Nested");

    expect(line?.parentRef).toEqual({
      kind: "table",
      parentCellPos: "t1:0:0",
      name: "t2",
      rowAddr: 1,
      colAddr: 3
    });
  });

  it("parses textbox/object refs", () => {
    const line = parseFrLine("<$p64:0;s바탕글 사본16;x1$>");

    expect(line?.parentRef).toEqual({
      kind: "textbox",
      name: "x1"
    });
    expect(line?.styleName).toBe("바탕글 사본16");
    expect(line?.text).toBe("");
  });
});

describe("parseFrLineExport", () => {
  it("ignores malformed lines and groups table cells by generated table name", () => {
    const parsed = parseFrLineExport(
      [
        "<$p3:0;t1:0:1$>보도자료",
        "<$p8:0;s바탕글 사본16;t4:0:0$>담당 부서",
        "<$p9:0;s바탕글 사본16;t4:0:1$>국토교통부",
        "<$p9:1;s바탕글 사본16;t4:0:1$>주택정책과",
        "<$p14:0;s바탕글 사본16;t4:1:2$>담당자",
        "not a fr line"
      ].join("\n")
    );
    const tables = collectFrTableBlocks(parsed);

    expect(parsed).toHaveLength(5);
    expect(tables).toEqual([
      {
        name: "t1",
        rowAddrs: [0],
        colAddrs: [1],
        cells: [
          {
            rowAddr: 0,
            colAddr: 1,
            paragraphs: [parsed[0]]
          }
        ]
      },
      {
        name: "t4",
        rowAddrs: [0, 1],
        colAddrs: [0, 1, 2],
        cells: [
          {
            rowAddr: 0,
            colAddr: 0,
            paragraphs: [parsed[1]]
          },
          {
            rowAddr: 0,
            colAddr: 1,
            paragraphs: [parsed[2], parsed[3]]
          },
          {
            rowAddr: 1,
            colAddr: 2,
            paragraphs: [parsed[4]]
          }
        ]
      }
    ]);
  });
});
