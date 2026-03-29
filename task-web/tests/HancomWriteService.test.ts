import { describe, expect, it, vi } from "vitest";

import {
  buildDeleteRowBagValues,
  buildInsertRowBagValues,
  buildInsertTableBagValues,
  buildReplaceAllBagValues,
  DELETE_ROW_AGGREGATE_COMMAND_ID,
  INSERT_ROW_AGGREGATE_COMMAND_ID,
  INSERT_TABLE_COMMAND_ID,
  REPLACE_ALL_COMMAND_ID
} from "../src/hancom/directWriteSpecs.js";
import { HancomWriteService } from "../src/hancom/HancomWriteService.js";
import type { ParagraphBlock, TableBlock, TableSpec } from "../src/models/types.js";

function createSessionStub() {
  return {
    evaluate: vi.fn(),
    insertText: vi.fn(),
    pressF5: vi.fn(),
    pressEscape: vi.fn(),
    pressTab: vi.fn(),
    pressShiftTab: vi.fn(),
    pressArrowLeft: vi.fn(),
    pressEnter: vi.fn(),
    pressF2: vi.fn(),
    pressShortcut: vi.fn()
  };
}

function createDispatcherStub() {
  return {
    executeDirectPropertyBagCommand: vi.fn(),
    executeDirectActionCommand: vi.fn(),
    readDirectCommandState: vi.fn(),
    readSaveActorState: vi.fn(),
    executeSaveActorCommand: vi.fn(),
    executeDirectGotoPage: vi.fn(),
    executeDirectInsertImageBlob: vi.fn()
  };
}

function createCurrentCell(text = ""): ParagraphBlock {
  return {
    id: "cell-p0",
    kind: "paragraph",
    text,
    runs: [],
    paragraphStyle: {},
    rawNodeIds: ["cell-p0"]
  };
}

function createTableBlock(rows: number, cols: number): TableBlock {
  return {
    id: "table-1",
    kind: "table",
    rows: Array.from({ length: rows }, (_, rowIndex) => ({
      cells: Array.from({ length: cols }, (_, columnIndex) => ({
        id: `cell-${rowIndex}-${columnIndex}`,
        blocks: [
          {
            id: `cell-${rowIndex}-${columnIndex}-p0`,
            kind: "paragraph",
            text: "",
            runs: [],
            paragraphStyle: {},
            rawNodeIds: [`cell-${rowIndex}-${columnIndex}-p0`]
          }
        ]
      }))
    }))
  };
}

function createService() {
  const session = createSessionStub();
  const service = new HancomWriteService(session as never);
  const dispatcher = createDispatcherStub();
  (service as unknown as { writeDispatcher: unknown }).writeDispatcher = dispatcher;
  return { service, session, dispatcher };
}

describe("HancomWriteService table contracts", () => {
  it("allows replaceAll with caseSensitive=true on the confirmed direct command path", async () => {
    const { service, dispatcher } = createService();
    dispatcher.executeDirectPropertyBagCommand.mockResolvedValue({ ok: true, alertText: "없음" });

    await expect(
      service.replaceAll({
        find: "mdis",
        replace: "mdis_caseprobe",
        caseSensitive: true
      })
    ).resolves.toEqual({
      alertText: "없음"
    });
    expect(dispatcher.executeDirectPropertyBagCommand).toHaveBeenCalledWith(
      REPLACE_ALL_COMMAND_ID,
      buildReplaceAllBagValues("mdis", "mdis_caseprobe")
    );
  });

  it("treats the confirmed replace-all false return as a non-fatal runtime quirk", async () => {
    const { service, dispatcher } = createService();
    dispatcher.executeDirectPropertyBagCommand.mockResolvedValue({
      ok: false,
      reason: "Direct property-bag command 33810 returned false.",
      alertText: "없음"
    });

    await expect(
      service.replaceAll({
        find: "alpha",
        replace: "omega",
        caseSensitive: true
      })
    ).resolves.toEqual({
      alertText: "없음"
    });
  });

  it("allows insertTable even when the caret is already inside a table cell", async () => {
    const { service, session, dispatcher } = createService();
    session.evaluate.mockResolvedValue(createCurrentCell());
    dispatcher.executeDirectPropertyBagCommand.mockResolvedValue({ ok: true });

    await expect(service.insertTable({ rows: 2, cols: 3 })).resolves.toEqual({
      rows: 2,
      cols: 3
    });
    expect(dispatcher.executeDirectPropertyBagCommand).toHaveBeenCalledWith(
      INSERT_TABLE_COMMAND_ID,
      buildInsertTableBagValues(2, 3)
    );
  });

  it("rejects insertTableRow when the caret is in a table cell but the row-command gate is disabled", async () => {
    const { service, session, dispatcher } = createService();
    dispatcher.readDirectCommandState.mockResolvedValue({ enabled: false, update: false });
    session.evaluate.mockResolvedValue(createCurrentCell());

    await expect(service.insertTableRow({ position: "above" })).rejects.toMatchObject({
      name: "EditorPreconditionError",
      message:
        "insertTableRow requires a table cell block selection. The caret is inside a table cell, but the runtime row-command gate is still disabled in this context."
    });
    expect(session.pressF5).toHaveBeenCalledTimes(1);
  });

  it("rejects deleteTableRow when the caret is in a table cell but the row-command gate is disabled", async () => {
    const { service, session, dispatcher } = createService();
    dispatcher.readDirectCommandState.mockResolvedValue({ enabled: false, update: false });
    session.evaluate.mockResolvedValue(createCurrentCell());

    await expect(service.deleteTableRow({ count: 1 })).rejects.toMatchObject({
      name: "EditorPreconditionError",
      message:
        "deleteTableRow requires a table cell block selection. The caret is inside a table cell, but the runtime row-command gate is still disabled in this context."
    });
    expect(session.pressF5).toHaveBeenCalledTimes(1);
  });

  it("uses the aggregate insert-row bag command once the active table selection gate is enabled", async () => {
    const { service, dispatcher } = createService();
    dispatcher.readDirectCommandState.mockResolvedValue({ enabled: true, update: false });
    dispatcher.executeDirectPropertyBagCommand.mockResolvedValue({ ok: true });
    (service as unknown as { activeTableSpec: TableSpec | null }).activeTableSpec = {
      rows: 2,
      cols: 2
    };

    await expect(service.insertTableRow({ position: "above" })).resolves.toMatchObject({
      tableId: "sdk-observed-active-table",
      rowCountDelta: 1,
      appliedCommand: "insert_upper_row"
    });
    expect(dispatcher.executeDirectPropertyBagCommand).toHaveBeenCalledWith(
      INSERT_ROW_AGGREGATE_COMMAND_ID,
      buildInsertRowBagValues("above")
    );
  });

  it("uses the aggregate delete-row bag command once the active table selection gate is enabled", async () => {
    const { service, dispatcher } = createService();
    dispatcher.readDirectCommandState.mockResolvedValue({ enabled: true, update: false });
    dispatcher.executeDirectPropertyBagCommand.mockResolvedValue({ ok: true });
    (service as unknown as { activeTableSpec: TableSpec | null }).activeTableSpec = {
      rows: 2,
      cols: 2
    };

    await expect(service.deleteTableRow({ count: 1 })).resolves.toMatchObject({
      tableId: "sdk-observed-active-table",
      rowCountDelta: -1,
      appliedCommand: "remove_row"
    });
    expect(dispatcher.executeDirectPropertyBagCommand).toHaveBeenCalledWith(
      DELETE_ROW_AGGREGATE_COMMAND_ID,
      buildDeleteRowBagValues()
    );
  });

  it("rejects fillTableCells when the provided value count does not match the current table cell count", async () => {
    const { service } = createService();
    vi.spyOn(service as never, "resolveCurrentTableFillContext" as never).mockResolvedValue({
      table: createTableBlock(2, 2),
      isFirstCell: true,
      currentCell: createCurrentCell()
    });

    await expect(
      service.fillTableCells({
        values: [["A1", "A2", "A3"]]
      })
    ).rejects.toMatchObject({
      name: "EditorPreconditionError",
      message:
        "fillTableCells must overwrite the entire current table. Expected 4 cells but received 3."
    });
  });

  it("attempts to reposition to the first cell before filling the current table", async () => {
    const { service } = createService();
    vi.spyOn(service as never, "resolveCurrentTableFillContext" as never)
      .mockResolvedValueOnce({
        table: createTableBlock(2, 2),
        isFirstCell: false,
        currentCell: createCurrentCell()
      })
      .mockResolvedValueOnce({
        table: createTableBlock(2, 2),
        isFirstCell: true,
        currentCell: createCurrentCell()
      });
    const moveToFirstCellSpy = vi
      .spyOn(service as never, "moveToFirstCellOfCurrentTable" as never)
      .mockResolvedValue({
        table: createTableBlock(2, 2),
        isFirstCell: true,
        currentCell: createCurrentCell()
      });
    vi.spyOn(service as never, "writeCurrentTableCell" as never)
      .mockResolvedValueOnce(createCurrentCell("A1"))
      .mockResolvedValueOnce(createCurrentCell("A2"))
      .mockResolvedValueOnce(createCurrentCell("B1"))
      .mockResolvedValueOnce(createCurrentCell("B2"));
    const moveSpy = vi
      .spyOn(service as never, "moveToNextObservedTableCell" as never)
      .mockResolvedValue(undefined);

    await expect(
      service.fillTableCells({
        values: [["A1", "A2"], ["B1", "B2"]]
      })
    ).resolves.toEqual({
      writtenCellCount: 4,
      tableId: "table-1"
    });
    expect(moveToFirstCellSpy).toHaveBeenCalledWith("table-1", 32);
    expect(moveSpy).toHaveBeenCalledTimes(3);
  });

  it("fills the entire current table when the value count matches and the caret is in the first cell", async () => {
    const { service } = createService();
    vi.spyOn(service as never, "resolveCurrentTableFillContext" as never).mockResolvedValue({
      table: createTableBlock(2, 2),
      isFirstCell: true,
      currentCell: createCurrentCell()
    });
    vi.spyOn(service as never, "writeCurrentTableCell" as never)
      .mockResolvedValueOnce(createCurrentCell("A1"))
      .mockResolvedValueOnce(createCurrentCell("A2"))
      .mockResolvedValueOnce(createCurrentCell("B1"))
      .mockResolvedValueOnce(createCurrentCell("B2"));
    const moveSpy = vi
      .spyOn(service as never, "moveToNextObservedTableCell" as never)
      .mockResolvedValue(undefined);

    await expect(
      service.fillTableCells({
        values: [["A1", "A2"], ["B1", "B2"]]
      })
    ).resolves.toEqual({
      writtenCellCount: 4,
      tableId: "table-1"
    });
    expect(moveSpy).toHaveBeenCalledTimes(3);
  });
});
