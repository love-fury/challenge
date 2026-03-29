import { describe, expect, it } from "vitest";

import {
  buildDeleteRowBagValues,
  buildInsertRowBagValues,
  buildInsertTableBagValues,
  buildReplaceAllBagValues,
  DELETE_ROW_AGGREGATE_COMMAND_ID,
  INSERT_LOWER_ROW_COMMAND_ID,
  INSERT_ROW_AGGREGATE_COMMAND_ID
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

  it("builds the confirmed aggregate delete-row bag values", () => {
    expect(buildDeleteRowBagValues()).toEqual({
      16384: 1
    });
  });

  it("builds the confirmed aggregate insert-row bag values", () => {
    expect(buildInsertRowBagValues("above")).toEqual({
      16384: 2,
      16385: 1
    });
    expect(buildInsertRowBagValues("below")).toEqual({
      16384: 3,
      16385: 1
    });
  });

  it("maps table row mutations to the confirmed command ids", () => {
    expect(INSERT_ROW_AGGREGATE_COMMAND_ID).toBe(35470);
    expect(INSERT_LOWER_ROW_COMMAND_ID).toBe(35474);
    expect(DELETE_ROW_AGGREGATE_COMMAND_ID).toBe(35475);
  });
});
