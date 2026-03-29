import { describe, expect, it, vi } from "vitest";

import { HancomBridge } from "../src/hancom/HancomBridge.js";

function createReadServiceStub() {
  return {
    readDocument: vi.fn().mockResolvedValue({ blocks: [] }),
    readText: vi.fn().mockResolvedValue("text"),
    readStructure: vi.fn().mockResolvedValue([]),
    exportMarkdown: vi.fn().mockResolvedValue("# doc"),
    exportJson: vi.fn().mockResolvedValue("{}"),
    getParagraphFormatting: vi.fn().mockResolvedValue({ paragraphId: "p0" }),
    search: vi.fn().mockResolvedValue({ total: 0, matches: [] }),
    getCaretPosition: vi.fn().mockResolvedValue({ paragraphId: "p0" })
  };
}

function createWriteServiceStub() {
  return {
    typeText: vi.fn().mockResolvedValue(undefined),
    replaceAll: vi.fn().mockResolvedValue({ replacements: 1 }),
    insertTable: vi.fn().mockResolvedValue({ rows: 2, cols: 2 }),
    fillTableCells: vi.fn().mockResolvedValue({ writtenCellCount: 4 }),
    save: vi.fn().mockResolvedValue({ savedAt: "2026-03-29T00:00:00.000Z" }),
    gotoPage: vi.fn().mockResolvedValue({ pageNumber: 3 }),
    insertImage: vi.fn().mockResolvedValue({ source: "file", path: "/tmp/a.png" }),
    insertTableRow: vi.fn().mockResolvedValue({ rowCountDelta: 1 }),
    deleteTableRow: vi.fn().mockResolvedValue({ rowCountDelta: -1 }),
    insertImageFromFile: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined)
  };
}

describe("HancomBridge", () => {
  it("delegates read and write methods to the underlying services", async () => {
    const bridge = new HancomBridge({} as never);
    const readService = createReadServiceStub();
    const writeService = createWriteServiceStub();

    (bridge as unknown as { readService: typeof readService }).readService = readService;
    (bridge as unknown as { writeService: typeof writeService }).writeService = writeService;

    await expect(bridge.readDocument()).resolves.toEqual({ blocks: [] });
    await expect(bridge.readText()).resolves.toBe("text");
    await expect(bridge.readStructure()).resolves.toEqual([]);
    await expect(bridge.exportMarkdown()).resolves.toBe("# doc");
    await expect(bridge.exportJson()).resolves.toBe("{}");
    await expect(bridge.getParagraphFormatting("p0")).resolves.toEqual({ paragraphId: "p0" });
    await expect(bridge.search("alpha")).resolves.toMatchObject({ total: 0 });
    await expect(bridge.getCaretPosition()).resolves.toEqual({ paragraphId: "p0" });
    await expect(bridge.replaceAll({ find: "a", replace: "b" })).resolves.toEqual({ replacements: 1 });
    await expect(bridge.insertTable({ rows: 2, cols: 2 })).resolves.toEqual({ rows: 2, cols: 2 });
    await expect(bridge.fillTableCells({ values: [["A"]] })).resolves.toEqual({ writtenCellCount: 4 });
    await expect(bridge.save()).resolves.toMatchObject({ savedAt: "2026-03-29T00:00:00.000Z" });
    await expect(bridge.gotoPage(3)).resolves.toEqual({ pageNumber: 3 });
    await expect(bridge.insertImage({ path: "/tmp/a.png" })).resolves.toEqual({
      source: "file",
      path: "/tmp/a.png"
    });
    await expect(bridge.insertTableRow({ position: "above" })).resolves.toEqual({ rowCountDelta: 1 });
    await expect(bridge.deleteTableRow({ count: 1 })).resolves.toEqual({ rowCountDelta: -1 });

    await bridge.typeText("hello");
    await bridge.dispose();

    expect(readService.readDocument).toHaveBeenCalledTimes(1);
    expect(writeService.typeText).toHaveBeenCalledWith("hello");
    expect(writeService.dispose).toHaveBeenCalledTimes(1);
  });
});
