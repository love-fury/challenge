import { describe, expect, it } from "vitest";

import {
  didSaveStateChange,
  isSaveNoOpState,
  type SaveActorStateSnapshot
} from "../src/hancom/pageSaveFunctions.js";

function createState(overrides: Partial<SaveActorStateSnapshot> = {}): SaveActorStateSnapshot {
  return {
    title: "doc",
    alertText: null,
    hasEnabledSaveCommand: true,
    hasDisabledSaveCommand: false,
    actorAvailable: true,
    actorEnabled: true,
    actorUpdate: false,
    ...overrides
  };
}

describe("pageSaveFunctions", () => {
  it("recognizes clean disabled save state as a no-op success candidate", () => {
    expect(
      isSaveNoOpState(
        createState({
          hasEnabledSaveCommand: false,
          hasDisabledSaveCommand: true,
          actorEnabled: false
        })
      )
    ).toBe(true);
  });

  it("does not treat ambiguous disabled state as a no-op", () => {
    expect(
      isSaveNoOpState(
        createState({
          hasEnabledSaveCommand: false,
          hasDisabledSaveCommand: false,
          actorEnabled: false
        })
      )
    ).toBe(false);
  });

  it("treats actor enablement drop as an observable save state change", () => {
    expect(
      didSaveStateChange(
        createState(),
        createState({
          hasEnabledSaveCommand: false,
          hasDisabledSaveCommand: true,
          actorEnabled: false
        })
      )
    ).toBe(true);
  });
});
