import { describe, expect, it } from "vitest";

import {
  executeExactSave,
  normalizeSaveActorState,
  pageExecuteExactSave,
  pageReadSaveActorSnapshot,
  planExactSave,
  readSaveActorSnapshot,
  type SaveActorRuntime
} from "../src/hancom/pageSaveFunctions.js";

describe("pageSaveFunctions", () => {
  it("normalizes runtime LPt state across the observed enable/update shapes", () => {
    expect(normalizeSaveActorState({ enable: false, update: true })).toEqual({
      enabled: false,
      update: true
    });
    expect(normalizeSaveActorState({ enabled: true })).toEqual({
      enabled: true,
      update: null
    });
    expect(normalizeSaveActorState(true)).toEqual({
      enabled: true,
      update: null
    });
    expect(normalizeSaveActorState(null)).toEqual({
      enabled: null,
      update: null
    });
  });

  it("reads a save actor snapshot without requiring DOM access", () => {
    const runtime = createRuntime({
      lpState: { enable: false, update: false }
    });

    const snapshot = readSaveActorSnapshot(runtime, {
      readTitle: () => "Doc Title",
      readAlertText: () => "clean"
    });

    expect(snapshot).toMatchObject({
      commandName: "d_save",
      available: true,
      enabled: false,
      update: false,
      title: "Doc Title",
      alertText: "clean",
      rawState: { enable: false, update: false }
    });
  });

  it("plans save attempts only when the actor is available and enabled", () => {
    expect(planExactSave(buildSnapshot({ available: false }))).toEqual({
      canAttempt: false,
      reason: "d_save actor surface is unavailable."
    });
    expect(planExactSave(buildSnapshot({ available: true, enabled: false }))).toEqual({
      canAttempt: false,
      reason: "d_save actor is disabled in the current context."
    });
    expect(planExactSave(buildSnapshot({ available: true, enabled: true }))).toEqual({
      canAttempt: true
    });
  });

  it("does not invoke PPt when the actor is unavailable or disabled", () => {
    const missing = executeExactSave(createRuntime({}), {
      now: () => "2026-03-29T00:00:00.000Z"
    });
    expect(missing.ok).toBe(false);
    expect(missing.invoked).toBe(false);
    expect(missing.reason).toBe("d_save actor surface is unavailable.");

    const disabledRuntime = createRuntime({
      lpState: { enable: false, update: false }
    });
    const disabled = executeExactSave(disabledRuntime, {
      now: () => "2026-03-29T00:00:00.000Z"
    });
    expect(disabled.ok).toBe(false);
    expect(disabled.invoked).toBe(false);
    expect(disabled.reason).toBe("d_save actor is disabled in the current context.");
    expect(disabledRuntime.calls).toEqual(["INt(true)", "LPt(d_save)"]);
  });

  it("invokes the exact save command when the actor reports enabled", () => {
    const runtime = createRuntime({
      lpState: { enable: true, update: false },
      ppResult: true
    });

    const result = executeExactSave(runtime, {
      readTitle: () => "Working doc",
      readAlertText: () => null,
      now: () => "2026-03-29T00:00:00.000Z"
    });

    expect(result.ok).toBe(true);
    expect(result.invoked).toBe(true);
    expect(result.rawResult).toBe(true);
    expect(result.before.enabled).toBe(true);
    expect(result.after.enabled).toBe(true);
    expect(runtime.calls).toEqual([
      "INt(true)",
      "LPt(d_save)",
      "INt(true)",
      "PPt(d_save)",
      "INt(true)",
      "LPt(d_save)"
    ]);
  });

  it("exposes browser-style page wrappers over the pure helpers", () => {
    const snapshotRuntime = createRuntime({
      lpState: { enable: true, update: false }
    });
    const executionRuntime = createRuntime({
      lpState: { enable: true, update: false },
      ppResult: true
    });

    expect(pageReadSaveActorSnapshot(snapshotRuntime, {
      readTitle: () => "Title",
      readAlertText: () => "Alert"
    })).toMatchObject({
      available: true,
      enabled: true,
      title: "Title",
      alertText: "Alert"
    });

    expect(pageExecuteExactSave(executionRuntime, {
      readTitle: () => "Title",
      readAlertText: () => "Alert",
      now: () => "2026-03-29T00:00:00.000Z"
    }).ok).toBe(true);
  });
});

function buildSnapshot(overrides: Partial<{
  commandName: "d_save";
  available: boolean;
  enabled: boolean | null;
  update: boolean | null;
  title: string | null;
  alertText: string | null;
  rawState: unknown;
}>) {
  return {
    commandName: "d_save" as const,
    available: false,
    enabled: null,
    update: null,
    title: null,
    alertText: null,
    rawState: null,
    ...overrides
  };
}

function createRuntime({
  lpState,
  ppResult
}: {
  lpState?: unknown;
  ppResult?: unknown;
}): SaveActorRuntime & {
  calls: string[];
} {
  const calls: string[] = [];

  return {
    calls,
    HwpApp: {
      INt(includeInactive?: boolean) {
        calls.push(`INt(${String(includeInactive)})`);
        return {
          LPt(commandName) {
            calls.push(`LPt(${commandName})`);
            return lpState;
          },
          PPt(commandName) {
            calls.push(`PPt(${commandName})`);
            return ppResult;
          }
        };
      }
    }
  };
}
