import { describe, expect, it } from "vitest";

import { isInsertImageDialogCandidate } from "../src/hancom/pageInsertImageFunctions.js";

describe("pageInsertImageFunctions", () => {
  it("accepts objects that match the insert-image dialog runtime surface", () => {
    expect(
      isInsertImageDialogCandidate({
        x2s: {
          R7s: () => "from_computer"
        },
        L2s: () => true
      })
    ).toBe(true);
  });

  it("rejects values without the dialog runtime methods", () => {
    expect(isInsertImageDialogCandidate(null)).toBe(false);
    expect(isInsertImageDialogCandidate({ x2s: {} })).toBe(false);
  });
});
