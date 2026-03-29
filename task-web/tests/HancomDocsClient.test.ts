import { afterEach, describe, expect, it, vi } from "vitest";

const discoverChromeTargetMock = vi.fn();
const connectMock = vi.fn();
const closeMock = vi.fn();
const disposeMock = vi.fn();

vi.mock("../src/client/chromeDiscovery.js", () => ({
  discoverChromeTarget: discoverChromeTargetMock
}));

vi.mock("../src/client/CdpSession.js", () => ({
  CdpSession: vi.fn().mockImplementation(() => ({
    connect: connectMock,
    close: closeMock
  }))
}));

vi.mock("../src/hancom/HancomBridge.js", () => ({
  HancomBridge: vi.fn().mockImplementation(() => ({
    dispose: disposeMock,
    readText: vi.fn().mockResolvedValue("text"),
    readStructure: vi.fn().mockResolvedValue([]),
    exportMarkdown: vi.fn().mockResolvedValue("# doc"),
    exportJson: vi.fn().mockResolvedValue("{}"),
    getParagraphFormatting: vi.fn().mockResolvedValue({ paragraphId: "p0" }),
    search: vi.fn().mockResolvedValue({ total: 0 }),
    getCaretPosition: vi.fn().mockResolvedValue({ paragraphId: "p0" }),
    typeText: vi.fn().mockResolvedValue(undefined),
    replaceAll: vi.fn().mockResolvedValue({ replacements: 1 }),
    insertTable: vi.fn().mockResolvedValue({ rows: 2, cols: 2 }),
    fillTableCells: vi.fn().mockResolvedValue({ writtenCellCount: 1 }),
    gotoPage: vi.fn().mockResolvedValue({ pageNumber: 1 }),
    insertImage: vi.fn().mockResolvedValue({ source: "file", path: "/tmp/a.png" }),
    insertTableRow: vi.fn().mockResolvedValue({ rowCountDelta: 1 }),
    deleteTableRow: vi.fn().mockResolvedValue({ rowCountDelta: -1 }),
    save: vi.fn().mockResolvedValue({ savedAt: "2026-03-29T00:00:00.000Z" })
  }))
}));

describe("HancomDocsClient", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("connects through target discovery, cdp session, and bridge setup", async () => {
    discoverChromeTargetMock.mockResolvedValue({
      id: "target-1",
      type: "page",
      title: "Hancom",
      url: "https://webhwp.hancomdocs.com/webhwp/?docId=1",
      webSocketDebuggerUrl: "ws://chrome/target-1"
    });
    connectMock.mockResolvedValue(undefined);

    const { HancomDocsClient } = await import("../src/HancomDocsClient.js");
    const client = await HancomDocsClient.connect({ port: 9333 });

    expect(client.target).toMatchObject({ id: "target-1" });
    expect(discoverChromeTargetMock).toHaveBeenCalledWith({ port: 9333 });
    expect(connectMock).toHaveBeenCalledWith("ws://chrome/target-1");
  });

  it("forwards public sdk methods to the bridge and disconnects cleanly", async () => {
    const { HancomDocsClient } = await import("../src/HancomDocsClient.js");
    const client = new (HancomDocsClient as unknown as {
      new(target: unknown, session: unknown, bridge: Record<string, (...args: unknown[]) => Promise<unknown>>): {
        disconnect: () => Promise<void>;
        readText: () => Promise<string>;
        readStructure: () => Promise<unknown[]>;
        exportMarkdown: () => Promise<string>;
        exportJson: () => Promise<string>;
        getParagraphFormatting: (locator: string) => Promise<unknown>;
        search: (query: string) => Promise<unknown>;
        getCaretPosition: () => Promise<unknown>;
        typeText: (text: string) => Promise<void>;
        replaceAll: (request: unknown) => Promise<unknown>;
        insertTable: (request: unknown) => Promise<unknown>;
        fillTableCells: (request: unknown) => Promise<unknown>;
        gotoPage: (pageNumber: number) => Promise<unknown>;
        insertImage: (request: unknown) => Promise<unknown>;
        insertTableRow: (request: unknown) => Promise<unknown>;
        deleteTableRow: (request: unknown) => Promise<unknown>;
        save: () => Promise<unknown>;
      };
    })(
      { id: "target-1" },
      { close: closeMock },
      {
        dispose: disposeMock,
        readText: vi.fn().mockResolvedValue("text"),
        readStructure: vi.fn().mockResolvedValue([]),
        exportMarkdown: vi.fn().mockResolvedValue("# doc"),
        exportJson: vi.fn().mockResolvedValue("{}"),
        getParagraphFormatting: vi.fn().mockResolvedValue({ paragraphId: "p0" }),
        search: vi.fn().mockResolvedValue({ total: 0 }),
        getCaretPosition: vi.fn().mockResolvedValue({ paragraphId: "p0" }),
        typeText: vi.fn().mockResolvedValue(undefined),
        replaceAll: vi.fn().mockResolvedValue({ replacements: 1 }),
        insertTable: vi.fn().mockResolvedValue({ rows: 2, cols: 2 }),
        fillTableCells: vi.fn().mockResolvedValue({ writtenCellCount: 1 }),
        gotoPage: vi.fn().mockResolvedValue({ pageNumber: 3 }),
        insertImage: vi.fn().mockResolvedValue({ source: "file", path: "/tmp/a.png" }),
        insertTableRow: vi.fn().mockResolvedValue({ rowCountDelta: 1 }),
        deleteTableRow: vi.fn().mockResolvedValue({ rowCountDelta: -1 }),
        save: vi.fn().mockResolvedValue({ savedAt: "2026-03-29T00:00:00.000Z" })
      }
    );

    await expect(client.readText()).resolves.toBe("text");
    await expect(client.readStructure()).resolves.toEqual([]);
    await expect(client.exportMarkdown()).resolves.toBe("# doc");
    await expect(client.exportJson()).resolves.toBe("{}");
    await expect(client.getParagraphFormatting("p0")).resolves.toEqual({ paragraphId: "p0" });
    await expect(client.search("alpha")).resolves.toEqual({ total: 0 });
    await expect(client.getCaretPosition()).resolves.toEqual({ paragraphId: "p0" });
    await expect(client.replaceAll({ find: "a", replace: "b" })).resolves.toEqual({ replacements: 1 });
    await expect(client.insertTable({ rows: 2, cols: 2 })).resolves.toEqual({ rows: 2, cols: 2 });
    await expect(client.fillTableCells({ values: [["A"]] })).resolves.toEqual({ writtenCellCount: 1 });
    await expect(client.gotoPage(3)).resolves.toEqual({ pageNumber: 3 });
    await expect(client.insertImage({ path: "/tmp/a.png" })).resolves.toEqual({
      source: "file",
      path: "/tmp/a.png"
    });
    await expect(client.insertTableRow({ position: "above" })).resolves.toEqual({ rowCountDelta: 1 });
    await expect(client.deleteTableRow({ count: 1 })).resolves.toEqual({ rowCountDelta: -1 });
    await expect(client.save()).resolves.toMatchObject({ savedAt: "2026-03-29T00:00:00.000Z" });

    await client.typeText("hello");
    await client.disconnect();

    expect(disposeMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
