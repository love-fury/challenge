import { describe, expect, it } from "vitest";

import {
  buildInsertTableBagValues,
  buildReplaceAllBagValues,
  DELETE_ROW_COMMAND_ID,
  INSERT_LOWER_ROW_COMMAND_ID,
  INSERT_UPPER_ROW_COMMAND_ID,
  resolveInsertRowCommandId
} from "../src/hancom/directWriteSpecs.js";

describe("directWriteSpecs", () => {
  it("builds the confirmed replace-all bag values", () => {
    expect(buildReplaceAllBagValues("alpha", "omega")).toEqual({
      16384: "alpha",
      16385: "omega",
      16386: 2,
      16392: 1,
      16406: 1
    });
  });

  it("builds the confirmed insert-table bag values", () => {
    expect(buildInsertTableBagValues(2, 3)).toEqual({
      16384: 2,
      16385: 3
    });
  });

  it("maps table row mutations to the confirmed command ids", () => {
    expect(resolveInsertRowCommandId("above")).toBe(INSERT_UPPER_ROW_COMMAND_ID);
    expect(resolveInsertRowCommandId("below")).toBe(INSERT_LOWER_ROW_COMMAND_ID);
    expect(DELETE_ROW_COMMAND_ID).toBe(35477);
  });
});
