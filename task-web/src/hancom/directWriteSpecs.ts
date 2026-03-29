import type { TableRowInsertPosition } from "../models/types.js";

export const REPLACE_ALL_COMMAND_ID = 33810;
export const GOTO_DIALOG_COMMAND_ID = 33840;
export const INSERT_TABLE_COMMAND_ID = 35456;
export const INSERT_IMAGE_COMMAND_ID = 34736;
export const INSERT_ROW_AGGREGATE_COMMAND_ID = 35470;
export const INSERT_LOWER_ROW_COMMAND_ID = 35474;
export const DELETE_ROW_AGGREGATE_COMMAND_ID = 35475;
export const ACTIVE_TABLE_SELECTION_GATE_COMMAND_ID = INSERT_LOWER_ROW_COMMAND_ID;

export interface DirectBagValues {
  [key: number]: string | number | boolean;
}

export function buildReplaceAllBagValues(
  findText: string,
  replaceText: string
): DirectBagValues {
  return {
    16384: findText,
    16385: replaceText,
    16386: 2,
    16392: 1,
    16406: 1
  };
}

export function buildInsertTableBagValues(rows: number, cols: number): DirectBagValues {
  return {
    16384: rows,
    16385: cols
  };
}

export function buildDeleteRowBagValues(): DirectBagValues {
  return {
    16384: 1
  };
}

export function buildInsertRowBagValues(position: TableRowInsertPosition): DirectBagValues {
  return {
    16384: position === "above" ? 2 : 3,
    16385: 1
  };
}
