/* eslint-disable complexity, max-lines */

import fs from "node:fs/promises";
import path from "node:path";

import {
  CapabilityUnavailableError,
  EditorPreconditionError
} from "../client/errors.js";
import type { CdpSession } from "../client/CdpSession.js";
import type {
  DeleteTableRowRequest,
  DocumentBlock,
  DocumentTableCell,
  FillTableCellsRequest,
  FillTableCellsResult,
  ImageInsertResult,
  InsertImageRequest,
  InsertTableRequest,
  InsertTableResult,
  InsertTableRowRequest,
  PageNavigationResult,
  ParagraphBlock,
  ReplaceAllRequest,
  ReplaceAllResult,
  SaveOptions,
  SaveResult,
  TableBlock,
  TableMutationResult,
  TableRowInsertPosition,
  TableSpec,
  HwpJson20ControlPayload,
  HwpJson20DocumentSnapshot,
  HwpJson20SublistRecord
} from "../models/types.js";
import { normalizeTableMatrix } from "../utils/document.js";
import { serializePageFunctionCall } from "./evaluation.js";
import { HwpJson20Reader } from "./HwpJson20Reader.js";
import {
  ACTIVE_TABLE_SELECTION_GATE_COMMAND_ID,
  buildDeleteRowBagValues,
  buildInsertRowBagValues,
  buildInsertTableBagValues,
  buildReplaceAllBagValues,
  DELETE_ROW_AGGREGATE_COMMAND_ID,
  INSERT_ROW_AGGREGATE_COMMAND_ID,
  INSERT_TABLE_COMMAND_ID,
  REPLACE_ALL_COMMAND_ID,
} from "./directWriteSpecs.js";
import { HancomWriteDispatcher } from "./HancomWriteDispatcher.js";
import { isSaveNoOpState } from "./pageSaveFunctions.js";
import {
  pageReadCaretState,
  pageReadCurrentTableCellState,
  pageDetectPlatform
} from "./pageFunctions.js";

interface RawCaretState {
  nodeId: string | null;
  textOffset: number | null;
  positionType: number | null;
  currentPageNumber: number | null;
}

interface PendingInsertQueueSummary {
  cmd: string | null;
  type: number | null;
  text: string | null;
}

export class HancomWriteService {
  private activeTableSpec: TableSpec | null = null;

  private observedActiveTable: TableBlock | null = null;

  private readonly hwpJson20Reader: HwpJson20Reader;

  private readonly writeDispatcher: HancomWriteDispatcher;

  constructor(private readonly session: CdpSession) {
    this.hwpJson20Reader = new HwpJson20Reader(session);
    this.writeDispatcher = new HancomWriteDispatcher(session);
  }

  async typeText(text: string): Promise<void> {
    await this.session.insertText(text);
  }

  async replaceAll(request: ReplaceAllRequest): Promise<ReplaceAllResult> {
    if (request.find.length === 0) {
      throw new EditorPreconditionError("replaceAll requires a non-empty find string.");
    }

    const replay = await this.writeDispatcher.executeDirectPropertyBagCommand(
      REPLACE_ALL_COMMAND_ID,
      buildReplaceAllBagValues(request.find, request.replace)
    );
    const replaceAllFalseNegative =
      replay.ok === false &&
      replay.reason === `Direct property-bag command ${String(REPLACE_ALL_COMMAND_ID)} returned false.`;
    if (!replay.ok && !replaceAllFalseNegative) {
      throw new CapabilityUnavailableError(`replaceAll is unavailable. ${replay.reason}`);
    }

    const replacements = parseReplaceCount(replay.alertText);
    return {
      ...(replacements === undefined ? {} : { replacements }),
      ...(replay.alertText === undefined ? {} : { alertText: replay.alertText }),
      ...(replay.dialogClosed === undefined ? {} : { dialogClosed: replay.dialogClosed })
    };
  }

  async insertTable(request: InsertTableRequest): Promise<InsertTableResult> {
    validateTableDimensions(request);

    const replay = await this.writeDispatcher.executeDirectPropertyBagCommand(
      INSERT_TABLE_COMMAND_ID,
      buildInsertTableBagValues(request.rows, request.cols)
    );
    if (!replay.ok) {
      throw new CapabilityUnavailableError(`insertTable is unavailable. ${replay.reason}`);
    }

    this.setObservedActiveTable(request);

    return {
      rows: request.rows,
      cols: request.cols
    };
  }

  async fillTableCells(request: FillTableCellsRequest): Promise<FillTableCellsResult> {
    const values = normalizeTableMatrix(request.values);
    const providedCellCount = countMatrixCells(values);

    if (request.table !== undefined || request.startCell !== undefined) {
      throw new EditorPreconditionError(
        "fillTableCells overwrites the current table and does not support explicit table/startCell targeting."
      );
    }

    let tableContext = await this.resolveCurrentTableFillContext();
    const expectedCellCount = countTableCells(tableContext.table);
    if (providedCellCount !== expectedCellCount) {
      throw new EditorPreconditionError(
        `fillTableCells must overwrite the entire current table. Expected ${String(expectedCellCount)} cells but received ${String(providedCellCount)}.`
      );
    }
    if (!tableContext.isFirstCell) {
      tableContext = await this.moveToFirstCellOfCurrentTable(
        tableContext.table.id,
        Math.max(8, expectedCellCount * 8)
      );
    }

    const observedValues = createBlankMatrixFromTable(tableContext.table);
    for (const [rowIndex, row] of values.entries()) {
      for (const [columnIndex, cell] of row.entries()) {
        const writtenCell = await this.writeCurrentTableCell(cell);
        observedValues[rowIndex]![columnIndex] = writtenCell.text;

        const isLastCell = rowIndex === values.length - 1 && columnIndex === row.length - 1;
        if (!isLastCell) {
          await this.moveToNextObservedTableCell();
        }
      }
    }

    this.observedActiveTable = this.createObservedTableBlockFromTemplate(
      tableContext.table,
      observedValues
    );
    this.activeTableSpec = resolveRectangularTableSpec(tableContext.table);

    return {
      writtenCellCount: providedCellCount,
      ...(this.observedActiveTable === null ? {} : { tableId: this.observedActiveTable.id })
    };
  }

  async save(options: SaveOptions = {}): Promise<SaveResult> {
    const before = await this.writeDispatcher.readSaveActorState();
    if (!before.actorAvailable) {
      throw new CapabilityUnavailableError("save is unavailable. The runtime save actor surface is unavailable.");
    }
    if (isSaveNoOpState(before)) {
      return {
        savedAt: new Date().toISOString(),
        beforeSaveCommandEnabled: before.hasEnabledSaveCommand,
        afterSaveCommandEnabled: before.hasEnabledSaveCommand,
        titleBefore: before.title,
        titleAfter: before.title,
        alertText: before.alertText
      };
    }
    if (before.actorEnabled === false) {
      throw new CapabilityUnavailableError(
        "save is unavailable. The runtime save actor is disabled in the current editor state."
      );
    }

    const replay = await this.writeDispatcher.executeSaveActorCommand(options.timeoutMs ?? 900);
    if (!replay.ok) {
      throw new CapabilityUnavailableError(`save is unavailable. ${replay.reason}`);
    }

    return {
      savedAt: new Date().toISOString(),
      beforeSaveCommandEnabled: replay.before.hasEnabledSaveCommand,
      afterSaveCommandEnabled: replay.after.hasEnabledSaveCommand,
      titleBefore: replay.before.title,
      titleAfter: replay.after.title,
      alertText: replay.after.alertText
    };
  }

  async gotoPage(pageNumber: number): Promise<PageNavigationResult> {
    const replay = await this.writeDispatcher.executeDirectGotoPage(pageNumber);
    if (!replay.ok) {
      throw new CapabilityUnavailableError(`gotoPage is unavailable. ${replay.reason}`);
    }
    const rawCaretState = await this.session.evaluate<RawCaretState | null>(
      serializePageFunctionCall(pageReadCaretState)
    );

    return {
      pageNumber,
      ...(rawCaretState?.currentPageNumber === null || rawCaretState?.currentPageNumber === undefined
        ? replay.afterCurrentPageNumber === null || replay.afterCurrentPageNumber === undefined
          ? {}
          : { resolvedPageNumber: replay.afterCurrentPageNumber }
        : { resolvedPageNumber: rawCaretState.currentPageNumber }),
      ...(replay.beforeScrollTop === undefined ? {} : { beforeScrollTop: replay.beforeScrollTop }),
      ...(replay.afterScrollTop === undefined ? {} : { afterScrollTop: replay.afterScrollTop }),
      ...(replay.beforeScrollTop === undefined || replay.afterScrollTop === undefined
        ? {}
        : { didScroll: replay.beforeScrollTop !== replay.afterScrollTop }),
      ...(replay.dialogClosed === undefined ? {} : { dialogClosed: replay.dialogClosed }),
      ...(replay.alertText === undefined ? {} : { alertText: replay.alertText })
    };
  }

  async insertImage(request: InsertImageRequest): Promise<ImageInsertResult> {
    const rawPath = request.path.trim();
    if (rawPath.length === 0) {
      throw new EditorPreconditionError("insertImage requires a non-empty file path.");
    }

    const resolvedPath = path.resolve(rawPath);
    try {
      await fs.access(resolvedPath);
    } catch {
      throw new EditorPreconditionError(`Image file was not found or is not readable: ${resolvedPath}`);
    }

    const fileBuffer = await fs.readFile(resolvedPath);
    const replay = await this.writeDispatcher.executeDirectInsertImageBlob(
      fileBuffer.toString("base64"),
      inferImageMimeType(resolvedPath)
    );
    if (!replay.ok) {
      throw new CapabilityUnavailableError(`insertImage is unavailable. ${replay.reason}`);
    }

    return {
      source: "file",
      path: resolvedPath
    };
  }

  async insertTableRow(request: InsertTableRowRequest): Promise<TableMutationResult> {
    const count = validateTableMutationCount(request.count);
    await this.ensureActiveTableSelection("insertTableRow");
    const appliedCommand = mapInsertRowCommand(request.position);

    for (let iteration = 0; iteration < count; iteration += 1) {
      const replay = await this.writeDispatcher.executeDirectPropertyBagCommand(
        INSERT_ROW_AGGREGATE_COMMAND_ID,
        buildInsertRowBagValues(request.position)
      );
      if (!replay.ok) {
        throw new CapabilityUnavailableError(`insertTableRow is unavailable. ${replay.reason}`);
      }
      if (iteration < count - 1 && !(await this.hasActiveTableSelection())) {
        throw new EditorPreconditionError(
          "insertTableRow lost the active table selection before all requested insertions completed."
        );
      }
    }

    this.applyObservedRowMutation(count);

    return {
      ...(this.observedActiveTable === null ? {} : { tableId: this.observedActiveTable.id }),
      rowCountDelta: count,
      appliedCommand
    };
  }

  async deleteTableRow(request: DeleteTableRowRequest): Promise<TableMutationResult> {
    const count = validateTableMutationCount(request.count);
    await this.ensureActiveTableSelection("deleteTableRow");

    for (let iteration = 0; iteration < count; iteration += 1) {
      const replay = await this.writeDispatcher.executeDirectPropertyBagCommand(
        DELETE_ROW_AGGREGATE_COMMAND_ID,
        buildDeleteRowBagValues()
      );
      if (!replay.ok) {
        throw new CapabilityUnavailableError(`deleteTableRow is unavailable. ${replay.reason}`);
      }
      if (iteration < count - 1 && !(await this.hasActiveTableSelection())) {
        throw new EditorPreconditionError(
          "deleteTableRow lost the active table selection before all requested deletions completed."
        );
      }
    }

    this.applyObservedRowMutation(-count);

    return {
      ...(this.observedActiveTable === null ? {} : { tableId: this.observedActiveTable.id }),
      rowCountDelta: -count,
      appliedCommand: "remove_row"
    };
  }

  async insertImageFromFile(imagePath: string): Promise<void> {
    await this.insertImage({ path: imagePath });
  }

  async dispose(): Promise<void> {
    await Promise.resolve();
  }

  private async wait(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private async ensureActiveTableSelection(operation: string): Promise<void> {
    if (await this.hasActiveTableSelection()) {
      return;
    }

    if (await this.tryPromoteCurrentCellToTableSelection()) {
      return;
    }

    if (await this.tryReadCurrentTableCell()) {
      throw new EditorPreconditionError(
        `${operation} requires a table cell block selection. The caret is inside a table cell, but the runtime row-command gate is still disabled in this context.`
      );
    }

    throw new EditorPreconditionError(`${operation} requires an active table-cell selection.`);
  }

  private async hasActiveTableSelection(): Promise<boolean> {
    const state = await this.writeDispatcher.readDirectCommandState(
      ACTIVE_TABLE_SELECTION_GATE_COMMAND_ID
    );
    return state.enabled;
  }

  private setObservedActiveTable(spec: TableSpec): void {
    this.activeTableSpec = {
      rows: spec.rows,
      cols: spec.cols
    };
    this.observedActiveTable = this.createObservedTableBlock(spec.rows, spec.cols);
  }

  private createObservedTableBlock(
    rows: number,
    cols: number,
    values?: readonly string[][]
  ): TableBlock {
    const tableId = "sdk-observed-active-table";
    return {
      id: tableId,
      kind: "table",
      rows: Array.from({ length: rows }, (_, rowIndex) => ({
        cells: Array.from({ length: cols }, (_, columnIndex) => {
          const value = values?.[rowIndex]?.[columnIndex] ?? "";
          return {
            id: `${tableId}:r${rowIndex}c${columnIndex}`,
            blocks: value.length === 0
              ? []
              : [
                  {
                    id: `${tableId}:r${rowIndex}c${columnIndex}:p0`,
                    kind: "paragraph",
                    text: value,
                    runs: [
                      {
                        text: value,
                        start: 0,
                        end: value.length,
                        textStyle: {}
                      }
                    ],
                    paragraphStyle: {}
                  }
                ]
          };
        })
      }))
    };
  }

  private createObservedTableBlockFromTemplate(
    table: TableBlock,
    values: readonly string[][]
  ): TableBlock {
    return {
      id: table.id,
      kind: "table",
      ...(table.controlId === undefined ? {} : { controlId: table.controlId }),
      ...(table.pageRange === undefined ? {} : { pageRange: table.pageRange }),
      rows: table.rows.map((row, rowIndex) => ({
        cells: row.cells.map((cell, columnIndex) =>
          this.createObservedTableCellBlock(cell, values[rowIndex]?.[columnIndex] ?? "")
        )
      }))
    };
  }

  private async tryReadCurrentTableCell(): Promise<ParagraphBlock | null> {
    return await this.session.evaluate<ParagraphBlock | null>(
      serializePageFunctionCall(pageReadCurrentTableCellState)
    );
  }

  private async ensureCurrentTableCellContext(operation: string): Promise<ParagraphBlock> {
    const currentCell = await this.tryReadCurrentTableCell();
    if (currentCell === null) {
      throw new EditorPreconditionError(
        `${operation} requires the caret to be inside the SDK-tracked active table.`
      );
    }

    return currentCell;
  }

  private async resolveCurrentTableFillContext(): Promise<{
    table: TableBlock;
    isFirstCell: boolean;
    currentCell: ParagraphBlock;
  }> {
    const currentCell = await this.ensureCurrentTableCellContext("fillTableCells");
    const currentNodeId = getParagraphIdentity(currentCell);
    if (currentNodeId === null) {
      throw new EditorPreconditionError(
        "fillTableCells could not resolve the current table cell identity."
      );
    }

    const snapshot = await this.readHwpJson20Snapshot();
    const tableLocation = locateTableCellInSnapshot(snapshot, currentNodeId);
    if (tableLocation === null) {
      throw new EditorPreconditionError(
        `fillTableCells could not resolve the current table from caret node ${currentNodeId}.`
      );
    }

    return {
      table: tableLocation.table,
      isFirstCell: tableLocation.isFirstCell,
      currentCell
    };
  }

  private async tryPromoteCurrentCellToTableSelection(): Promise<boolean> {
    const currentCell = await this.tryReadCurrentTableCell();
    if (currentCell === null) {
      return false;
    }

    await this.session.pressF5();
    await this.wait(140);
    return await this.hasActiveTableSelection();
  }

  private applyObservedRowMutation(rowCountDelta: number): void {
    if (this.activeTableSpec === null) {
      return;
    }

    const nextRowCount = this.activeTableSpec.rows + rowCountDelta;
    if (nextRowCount <= 0) {
      this.activeTableSpec = null;
      this.observedActiveTable = null;
      return;
    }

    this.activeTableSpec = {
      rows: nextRowCount,
      cols: this.activeTableSpec.cols
    };
    this.observedActiveTable = this.createObservedTableBlock(nextRowCount, this.activeTableSpec.cols);
  }

  private async moveToNextObservedTableCell(): Promise<void> {
    const before = await this.ensureCurrentTableCellContext("fillTableCells");
    const beforeIdentity = getParagraphIdentity(before);
    const beforeText = before.text;

    await this.session.pressEscape();
    await this.wait(80);
    await this.session.pressTab();
    await this.wait(120);

    const after = await this.tryReadCurrentTableCell();
    if (after === null) {
      throw new EditorPreconditionError(
        "fillTableCells could not confirm movement to the next table cell after leaving edit mode."
      );
    }

    const afterIdentity = getParagraphIdentity(after);
    if (beforeIdentity !== null && afterIdentity !== null && beforeIdentity !== afterIdentity) {
      return;
    }

    if (after.text !== beforeText) {
      await this.undoLastEdit();
      throw new EditorPreconditionError(
        "fillTableCells aborted because Tab mutated the current cell instead of moving to the next cell."
      );
    }

    throw new EditorPreconditionError(
      "fillTableCells could not confirm movement to a different table cell after Tab."
    );
  }

  private async moveToPreviousObservedTableCell(): Promise<void> {
    const before = await this.ensureCurrentTableCellContext("fillTableCells");
    const beforeIdentity = getParagraphIdentity(before);
    const beforeText = before.text;

    await this.session.pressEscape();
    await this.wait(80);
    await this.session.pressArrowLeft();
    await this.wait(120);

    const after = await this.tryReadCurrentTableCell();
    if (after === null) {
      throw new EditorPreconditionError(
        "fillTableCells could not confirm movement to the previous table cell after leaving edit mode."
      );
    }

    const afterIdentity = getParagraphIdentity(after);
    if (beforeIdentity !== null && afterIdentity !== null && beforeIdentity !== afterIdentity) {
      return;
    }

    if (after.text !== beforeText) {
      await this.undoLastEdit();
      throw new EditorPreconditionError(
        "fillTableCells aborted because ArrowLeft mutated the current cell instead of moving to the previous cell."
      );
    }

    throw new EditorPreconditionError(
      "fillTableCells could not confirm movement to a different table cell after ArrowLeft."
    );
  }

  private async writeCurrentTableCell(text: string): Promise<ParagraphBlock> {
    const attemptSummaries: string[] = [];
    const enterEditModeCandidates = [
      async (): Promise<void> => {
        await this.session.pressEnter();
        await this.wait(80);
        await this.session.pressEnter();
      },
      async (): Promise<void> => {
        await this.session.pressF2();
        await this.wait(80);
        await this.session.pressF2();
      }
    ];

    for (const [candidateIndex, enterEditMode] of enterEditModeCandidates.entries()) {
      await enterEditMode();
      await this.wait(120);
      const before = await this.tryReadCurrentTableCell();
      await this.session.insertText(text);
      await this.wait(160);

      const after = await this.tryReadCurrentTableCell();
      const queue = await this.readPendingInsertQueueSummary();
      attemptSummaries.push(
        `${candidateIndex}:${queue?.cmd ?? "null"}/${queue?.type ?? "null"}/${queue?.text ?? "null"}`
      );
      if (
        after !== null &&
        after.text.endsWith(text) &&
        (before === null || after.text !== before.text)
      ) {
        return after;
      }

      if (candidateIndex < enterEditModeCandidates.length - 1) {
        await this.session.pressEscape();
        await this.wait(80);
      }
    }

    throw new EditorPreconditionError(
      `Could not confirm table-cell text write for "${text}" after entering cell edit mode. Attempt queue states: ${attemptSummaries.join(", ")}`
    );
  }

  private async readPendingInsertQueueSummary(): Promise<PendingInsertQueueSummary | null> {
    return await this.session.evaluate<PendingInsertQueueSummary | null>(`(() => {
      const entries = globalThis.HwpApp?.document?.Evr?.wVs?.vqs;
      if (!Array.isArray(entries) || entries.length === 0) {
        return null;
      }
      const last = entries.at(-1);
      if (!last || typeof last !== "object") {
        return null;
      }
      const value = typeof last.value === "object" && last.value !== null ? last.value : null;
      return {
        cmd: typeof last.cmd === "string" ? last.cmd : null,
        type: typeof last.type === "number" ? last.type : null,
        text: value !== null && typeof value.t === "string" ? value.t : null
      };
    })()`);
  }

  private async undoLastEdit(): Promise<void> {
    const platform = await this.session.evaluate<string>(
      serializePageFunctionCall(pageDetectPlatform)
    );
    const modifier = platform.toLocaleLowerCase().includes("mac") ? "Meta" : "Control";
    await this.session.pressShortcut("z", modifier);
    await this.wait(120);
  }

  private async moveToFirstCellOfCurrentTable(
    tableId: string,
    maxSteps: number
  ): Promise<{
    table: TableBlock;
    isFirstCell: boolean;
    currentCell: ParagraphBlock;
  }> {
    let context = await this.resolveCurrentTableFillContext();
    if (context.table.id !== tableId) {
      throw new EditorPreconditionError(
        "fillTableCells lost the current table context before repositioning to the first cell."
      );
    }
    if (context.isFirstCell) {
      return context;
    }

    for (let step = 0; step < maxSteps; step += 1) {
      await this.moveToPreviousObservedTableCell();
      context = await this.resolveCurrentTableFillContext();
      if (context.table.id !== tableId) {
        throw new EditorPreconditionError(
          "fillTableCells moved out of the current table while repositioning to the first cell."
        );
      }
      if (context.isFirstCell) {
        return context;
      }
    }

    throw new EditorPreconditionError(
      "fillTableCells could not reposition the caret to the first cell of the current table."
    );
  }

  private async readHwpJson20Snapshot(): Promise<HwpJson20DocumentSnapshot> {
    const snapshot = await this.hwpJson20Reader.readSnapshot();
    if (snapshot === null) {
      throw new CapabilityUnavailableError(
        "fillTableCells is unavailable. Could not obtain the runtime hwpjson20 snapshot."
      );
    }

    return snapshot;
  }

  private createObservedTableCellBlock(cell: DocumentTableCell, value: string): DocumentTableCell {
    const paragraphId = findFirstParagraphId(cell.blocks) ?? `${cell.id}:sdk-observed-paragraph`;

    return {
      id: cell.id,
      blocks:
        value.length === 0
          ? []
          : [
              {
                id: paragraphId,
                kind: "paragraph",
                text: value,
                runs: [
                  {
                    text: value,
                    start: 0,
                    end: value.length,
                    textStyle: {}
                  }
                ],
                paragraphStyle: {},
                rawNodeIds: [paragraphId]
              }
            ]
    };
  }
}

function inferImageMimeType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".bmp":
      return "image/bmp";
    case ".svg":
    case ".svgz":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function countMatrixCells(matrix: readonly string[][]): number {
  return matrix.reduce((sum, row) => sum + row.length, 0);
}

function countTableCells(table: TableBlock): number {
  return table.rows.reduce((sum, row) => sum + row.cells.length, 0);
}

function createBlankMatrixFromTable(table: TableBlock): string[][] {
  return table.rows.map((row) => row.cells.map(() => ""));
}

function getParagraphIdentity(paragraph: ParagraphBlock | null): string | null {
  if (paragraph === null) {
    return null;
  }

  return paragraph.rawNodeIds?.[0] ?? paragraph.id;
}

function parseReplaceCount(alertText: string | null | undefined): number | undefined {
  if (!alertText) {
    return undefined;
  }

  const match = alertText.match(/(\d+)/);
  if (!match) {
    return undefined;
  }

  const countText = match[1];
  if (countText === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(countText, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function validateTableDimensions(request: TableSpec): void {
  if (!Number.isInteger(request.rows) || request.rows <= 0) {
    throw new EditorPreconditionError("Table rows must be a positive integer.");
  }

  if (!Number.isInteger(request.cols) || request.cols <= 0) {
    throw new EditorPreconditionError("Table cols must be a positive integer.");
  }
}

function validateTableMutationCount(count: number | undefined): number {
  if (count === undefined) {
    return 1;
  }

  if (!Number.isInteger(count) || count <= 0) {
    throw new EditorPreconditionError("Table row mutation count must be a positive integer.");
  }

  return count;
}

function mapInsertRowCommand(
  position: TableRowInsertPosition
): "insert_upper_row" | "insert_lower_row" {
  return position === "above" ? "insert_upper_row" : "insert_lower_row";
}

function resolveRectangularTableSpec(table: TableBlock): TableSpec | null {
  if (table.rows.length === 0) {
    return null;
  }

  const firstRowCellCount = table.rows[0]?.cells.length ?? 0;
  if (firstRowCellCount === 0) {
    return null;
  }

  if (table.rows.some((row) => row.cells.length !== firstRowCellCount)) {
    return null;
  }

  return {
    rows: table.rows.length,
    cols: firstRowCellCount
  };
}

function locateTableCellInSnapshot(
  snapshot: HwpJson20DocumentSnapshot,
  nodeId: string
): { table: TableBlock; isFirstCell: boolean } | null {
  const controlMap = normalizeIndexedCollection<HwpJson20ControlPayload>(snapshot.cs);
  const sublistMap = normalizeIndexedCollection<HwpJson20SublistRecord>(snapshot.sl);

  for (const [tableId, control] of Object.entries(controlMap)) {
    const rowEntries = Array.isArray(control.tr) ? control.tr : [];
    const rows = rowEntries
      .map((rowEntry) => extractSnapshotRowCells(rowEntry, control, sublistMap))
      .filter((row) => row.cells.length > 0);

    if (rows.length === 0) {
      continue;
    }

    for (const [rowIndex, row] of rows.entries()) {
      for (const [columnIndex, cell] of row.cells.entries()) {
        if (!cell.paragraphIds.includes(nodeId)) {
          continue;
        }

        return {
          table: createSnapshotTableBlock(tableId, rows),
          isFirstCell: rowIndex === 0 && columnIndex === 0
        };
      }
    }
  }

  const tokenFallback = locateTableByNearestToken(snapshot, nodeId, controlMap, sublistMap);
  if (tokenFallback !== null) {
    return tokenFallback;
  }

  return null;
}

function extractSnapshotRowCells(
  rowEntry: unknown,
  control: HwpJson20ControlPayload,
  sublistMap: Record<string, HwpJson20SublistRecord>
): { cells: Array<{ id: string; paragraphIds: string[] }> } {
  const cellMap = normalizeIndexedCollection<unknown>(control.ch);
  const knownCellIds = new Set(Object.keys(cellMap));
  const cellIds = extractCellIds(rowEntry, knownCellIds);
  return {
    cells: cellIds.map((cellId) => ({
      id: cellId,
      paragraphIds: followTableCellParagraphIds(cellId, sublistMap)
    }))
  };
}

function followTableCellParagraphIds(
  cellId: string,
  sublistMap: Record<string, HwpJson20SublistRecord>
): string[] {
  const cellRecord = sublistMap[cellId];
  const firstParagraphId = resolveRef(cellRecord?.hp);
  if (firstParagraphId === null) {
    return [];
  }

  const paragraphIds: string[] = [];
  const seen = new Set<string>();
  let currentParagraphId: string | null = firstParagraphId;

  while (currentParagraphId !== null && !seen.has(currentParagraphId)) {
    seen.add(currentParagraphId);
    paragraphIds.push(currentParagraphId);
    currentParagraphId = resolveRef(sublistMap[currentParagraphId]?.np);
  }

  return paragraphIds;
}

function locateTableByNearestToken(
  snapshot: HwpJson20DocumentSnapshot,
  nodeId: string,
  controlMap: Record<string, HwpJson20ControlPayload>,
  sublistMap: Record<string, HwpJson20SublistRecord>
): { table: TableBlock; isFirstCell: boolean } | null {
  const roMap = normalizeIndexedCollection<Record<string, unknown>>(snapshot.ro);
  const prevMap = buildPreviousNodeMap(snapshot);
  const seen = new Set<string>();
  let currentNodeId: string | null = nodeId;

  while (currentNodeId !== null && !seen.has(currentNodeId)) {
    seen.add(currentNodeId);
    const record = roMap[currentNodeId];
    const tableTokenId = extractLastTableTokenId(record?.tx);
    if (tableTokenId !== null) {
      const control = controlMap[tableTokenId];
      if (control !== undefined && Array.isArray(control.tr)) {
        const rows = control.tr
          .map((rowEntry) => extractSnapshotRowCells(rowEntry, control, sublistMap))
          .filter((row) => row.cells.length > 0);
        if (rows.length > 0) {
          return {
            table: createSnapshotTableBlock(tableTokenId, rows),
            isFirstCell: resolveRef(record?.np) === nodeId
          };
        }
      }
    }

    currentNodeId = prevMap.get(currentNodeId) ?? null;
  }

  return null;
}

function buildPreviousNodeMap(snapshot: HwpJson20DocumentSnapshot): Map<string, string> {
  const previousNodeMap = new Map<string, string>();
  const roMap = normalizeIndexedCollection<Record<string, unknown>>(snapshot.ro);
  const slMap = normalizeIndexedCollection<Record<string, unknown>>(snapshot.sl);

  for (const [recordId, record] of Object.entries(roMap)) {
    const nextId = resolveRef(record.np);
    if (nextId !== null && !previousNodeMap.has(nextId)) {
      previousNodeMap.set(nextId, recordId);
    }
  }

  for (const [recordId, record] of Object.entries(slMap)) {
    const nextId = resolveRef(record.np);
    if (nextId !== null && !previousNodeMap.has(nextId)) {
      previousNodeMap.set(nextId, recordId);
    }
  }

  return previousNodeMap;
}

function extractLastTableTokenId(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  const matches = Array.from(value.matchAll(/<0B\/74626C20\/([A-Za-z0-9]+)>/g));
  const last = matches.at(-1);
  return last?.[1] ?? null;
}

function createSnapshotTableBlock(
  tableId: string,
  rows: Array<{ cells: Array<{ id: string; paragraphIds: string[] }> }>
): TableBlock {
  return {
    id: tableId,
    kind: "table",
    controlId: tableId,
    rows: rows.map((snapshotRow) => ({
      cells: snapshotRow.cells.map((snapshotCell) => ({
        id: snapshotCell.id,
        blocks:
          snapshotCell.paragraphIds.length === 0
            ? []
            : [
                {
                  id: snapshotCell.paragraphIds[0] ?? `${snapshotCell.id}:p0`,
                  kind: "paragraph",
                  text: "",
                  runs: [],
                  paragraphStyle: {},
                  rawNodeIds: snapshotCell.paragraphIds
                }
              ]
      }))
    }))
  };
}

function extractCellIds(value: unknown, knownCellIds: ReadonlySet<string>): string[] {
  const matches: string[] = [];
  walkCellIds(value, knownCellIds, matches, 0);
  return uniqueStrings(matches);
}

function walkCellIds(
  value: unknown,
  knownCellIds: ReadonlySet<string>,
  matches: string[],
  depth: number
): void {
  if (depth > 6) {
    return;
  }

  if (typeof value === "string" || typeof value === "number") {
    const ref = String(value);
    if (knownCellIds.has(ref)) {
      matches.push(ref);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      walkCellIds(entry, knownCellIds, matches, depth + 1);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  Object.values(value).forEach((entry) => {
    walkCellIds(entry, knownCellIds, matches, depth + 1);
  });
}

function normalizeIndexedCollection<T>(input: unknown): Record<string, T> {
  if (Array.isArray(input)) {
    const entries = input.flatMap<[string, T]>((entry, index) => {
      if (!isRecord(entry)) {
        return [];
      }

      const id = resolveRef(entry.id) ?? String(index);
      return [[id, entry as T]];
    });
    return Object.fromEntries(entries);
  }

  if (!isRecord(input)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value as T])
  );
}

function resolveRef(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function findFirstParagraphId(blocks: readonly DocumentBlock[]): string | null {
  for (const block of blocks) {
    if (block.kind === "paragraph") {
      return block.rawNodeIds?.[0] ?? block.id;
    }

    if (block.kind !== "table") {
      continue;
    }

    for (const row of block.rows) {
      for (const cell of row.cells) {
        const nestedId = findFirstParagraphId(cell.blocks);
        if (nestedId !== null) {
          return nestedId;
        }
      }
    }
  }

  return null;
}
