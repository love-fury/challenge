/* eslint-disable complexity, max-lines */

import fs from "node:fs/promises";
import path from "node:path";

import {
  CapabilityUnavailableError,
  EditorPreconditionError
} from "../client/errors.js";
import type { CdpSession } from "../client/CdpSession.js";
import type {
  CaretPosition,
  CaretTarget,
  DeleteTableRowRequest,
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
  TableSpec
} from "../models/types.js";
import { normalizeTableMatrix } from "../utils/document.js";
import { serializePageFunctionCall } from "./evaluation.js";
import {
  ACTIVE_TABLE_SELECTION_GATE_COMMAND_ID,
  buildInsertTableBagValues,
  buildReplaceAllBagValues,
  DELETE_ROW_COMMAND_ID,
  INSERT_TABLE_COMMAND_ID,
  REPLACE_ALL_COMMAND_ID,
  resolveInsertRowCommandId
} from "./directWriteSpecs.js";
import { HancomWriteDispatcher } from "./HancomWriteDispatcher.js";
import {
  pageDetectPlatform,
  pageReadCaretState,
  pageReadCurrentTableCellState
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

  private readonly writeDispatcher: HancomWriteDispatcher;

  constructor(private readonly session: CdpSession) {
    this.writeDispatcher = new HancomWriteDispatcher(session);
  }

  // TODO(static-deob): promote moveCaret to an exact ActionManager/UIAPI-backed path once the
  // runtime command/context mapping is confirmed.
  moveCaret(target: CaretTarget): Promise<CaretPosition> {
    return Promise.reject(new CapabilityUnavailableError(
      `moveCaret is unavailable. The SDK does not have a non-hook runtime path for caret movement yet: ${JSON.stringify(target)}`
    ));
  }

  async typeText(text: string): Promise<void> {
    await this.session.insertText(text);
  }

  async replaceAll(request: ReplaceAllRequest): Promise<ReplaceAllResult> {
    if (request.find.length === 0) {
      throw new EditorPreconditionError("replaceAll requires a non-empty find string.");
    }

    if (request.caseSensitive === true) {
      throw new CapabilityUnavailableError(
        "replaceAll with caseSensitive=true is unavailable without an exact runtime command path."
      );
    }

    const replay = await this.writeDispatcher.executeDirectPropertyBagCommand(
      REPLACE_ALL_COMMAND_ID,
      buildReplaceAllBagValues(request.find, request.replace)
    );
    if (!replay.ok) {
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

    if (request.table !== undefined || request.startCell !== undefined) {
      throw new EditorPreconditionError(
        "fillTableCells fallback only supports writing from the current selected cell."
      );
    }

    if (this.activeTableSpec === null) {
      throw new EditorPreconditionError(
        "fillTableCells fallback requires a preceding insertTable() call so the SDK can track the active table shape."
      );
    }

    await this.ensureCurrentTableCellContext("fillTableCells");

    const activeTableSpec = this.activeTableSpec;
    const firstRow = values[0];
    const columnCount = firstRow === undefined ? 0 : firstRow.length;
    if (values.length > activeTableSpec.rows || columnCount > activeTableSpec.cols) {
      throw new EditorPreconditionError(
        "fillTableCells fallback matrix exceeds the dimensions of the SDK-tracked active table."
      );
    }

    const observedValues = createBlankMatrix(this.activeTableSpec.rows, this.activeTableSpec.cols);
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

    this.observedActiveTable = this.createObservedTableBlock(
      this.activeTableSpec.rows,
      this.activeTableSpec.cols,
      observedValues
    );

    return {
      writtenCellCount: countMatrixCells(values),
      tableId: this.observedActiveTable.id
    };
  }

  async save(options: SaveOptions = {}): Promise<SaveResult> {
    // TODO(static-deob): replace shortcut-based save with exact internal `d_save` dispatch path.
    const platform = await this.session.evaluate<string>(
      serializePageFunctionCall(pageDetectPlatform)
    );
    const before = await this.writeDispatcher.readSaveCommandState();
    const modifier = platform.toLocaleLowerCase().includes("mac") ? "Meta" : "Control";
    await this.session.pressShortcut("s", modifier);
    let after = before;
    const timeoutMs = Math.max(150, options.timeoutMs ?? 900);
    const maxAttempts = Math.max(1, Math.ceil(timeoutMs / 150));

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await this.wait(150);
      after = await this.writeDispatcher.readSaveCommandState();

      const saveCommandSettled = before.hasEnabledSaveCommand && !after.hasEnabledSaveCommand;
      const alertChanged = after.alertText !== before.alertText;
      const titleChanged = after.title !== before.title;
      if (saveCommandSettled || alertChanged || titleChanged) {
        break;
      }
    }

    const saveCommandSettled = before.hasEnabledSaveCommand && !after.hasEnabledSaveCommand;
    const alertChanged = after.alertText !== before.alertText;
    const titleChanged = after.title !== before.title;
    if (before.hasEnabledSaveCommand && !saveCommandSettled && !alertChanged && !titleChanged) {
      throw new CapabilityUnavailableError(
        `save shortcut did not produce an observable save confirmation signal within ${timeoutMs}ms.`
      );
    }

    return {
      savedAt: new Date().toISOString(),
      beforeSaveCommandEnabled: before.hasEnabledSaveCommand,
      afterSaveCommandEnabled: after.hasEnabledSaveCommand,
      titleBefore: before.title,
      titleAfter: after.title,
      alertText: after.alertText
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

    // TODO(static-deob): replace upload finalization fallback with exact ActionManager/UIAPI image insert flow.
    const prepared = await this.writeDispatcher.prepareInsertImageFileUpload();
    if (!prepared.ok || !prepared.selector) {
      throw new CapabilityUnavailableError(`insertImage is unavailable. ${prepared.reason}`);
    }

    await this.session.setFileInputFiles(prepared.selector, [resolvedPath]);

    const replay = await this.writeDispatcher.finalizeInsertImageFileUpload();
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
    const commandId = resolveInsertRowCommandId(request.position);
    const appliedCommand = mapInsertRowCommand(request.position);

    for (let iteration = 0; iteration < count; iteration += 1) {
      const replay = await this.writeDispatcher.executeDirectActionCommand(commandId);
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
      const replay = await this.writeDispatcher.executeDirectActionCommand(DELETE_ROW_COMMAND_ID);
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
}

function countMatrixCells(matrix: readonly string[][]): number {
  return matrix.reduce((sum, row) => sum + row.length, 0);
}

function createBlankMatrix(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
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
