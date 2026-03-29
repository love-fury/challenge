export type SaveCommandName = "d_save";

export interface SaveActorSnapshot {
  commandName: SaveCommandName;
  available: boolean;
  enabled: boolean | null;
  update: boolean | null;
  title: string | null;
  alertText: string | null;
  rawState: unknown;
}

export interface SaveActorReplayResult {
  commandName: SaveCommandName;
  ok: boolean;
  invoked: boolean;
  reason?: string;
  savedAt: string;
  before: SaveActorSnapshot;
  after: SaveActorSnapshot;
  rawResult?: unknown;
}

export interface SaveActorSurface {
  LPt?: (commandName: SaveCommandName, cti?: unknown) => unknown;
  PPt?: (commandName: SaveCommandName, cti?: unknown) => unknown;
}

export interface SaveActorRuntime {
  HwpApp?: {
    INt?: (includeInactive?: boolean) => SaveActorSurface | null | undefined;
  };
}

export interface SaveSnapshotHooks {
  readTitle?: () => string | null;
  readAlertText?: () => string | null;
  now?: () => string;
}

export interface SaveExecutionHooks extends SaveSnapshotHooks {}

const SAVE_COMMAND_NAME: SaveCommandName = "d_save";

export function normalizeSaveActorState(rawState: unknown): {
  enabled: boolean | null;
  update: boolean | null;
} {
  if (typeof rawState === "boolean") {
    return {
      enabled: rawState,
      update: null
    };
  }

  if (!isRecord(rawState)) {
    return {
      enabled: null,
      update: null
    };
  }

  const enabled = readOptionalBoolean(rawState, "enable", "enabled");
  const update = readOptionalBoolean(rawState, "update");

  return {
    enabled,
    update
  };
}

export function resolveSaveActorSurface(runtime: SaveActorRuntime): SaveActorSurface | null {
  try {
    const surface = runtime.HwpApp?.INt?.(true);
    return isRecord(surface) ? (surface as SaveActorSurface) : null;
  } catch {
    return null;
  }
}

export function readSaveActorSnapshot(
  runtime: SaveActorRuntime,
  hooks: SaveSnapshotHooks = {}
): SaveActorSnapshot {
  const surface = resolveSaveActorSurface(runtime);
  let rawState: unknown = null;

  if (surface !== null && typeof surface.LPt === "function") {
    try {
      rawState = surface.LPt(SAVE_COMMAND_NAME);
    } catch {
      rawState = null;
    }
  }

  const normalized = normalizeSaveActorState(rawState);

  return {
    commandName: SAVE_COMMAND_NAME,
    available: surface !== null,
    enabled: normalized.enabled,
    update: normalized.update,
    title: hooks.readTitle?.() ?? readBrowserTitle(),
    alertText: hooks.readAlertText?.() ?? readBrowserAlertText(),
    rawState
  };
}

export function planExactSave(snapshot: SaveActorSnapshot): {
  canAttempt: boolean;
  reason?: string;
} {
  if (!snapshot.available) {
    return {
      canAttempt: false,
      reason: "d_save actor surface is unavailable."
    };
  }

  if (snapshot.enabled === false) {
    return {
      canAttempt: false,
      reason: "d_save actor is disabled in the current context."
    };
  }

  if (snapshot.enabled === null) {
    return {
      canAttempt: false,
      reason: "d_save actor state could not be normalized."
    };
  }

  return {
    canAttempt: true
  };
}

export function executeExactSave(
  runtime: SaveActorRuntime,
  hooks: SaveExecutionHooks = {}
): SaveActorReplayResult {
  const now = hooks.now ?? (() => new Date().toISOString());
  const before = readSaveActorSnapshot(runtime, hooks);
  const plan = planExactSave(before);
  if (!plan.canAttempt) {
    return {
      commandName: SAVE_COMMAND_NAME,
      ok: false,
      invoked: false,
      reason: plan.reason,
      savedAt: now(),
      before,
      after: before
    };
  }

  const surface = resolveSaveActorSurface(runtime);
  if (surface === null || typeof surface.PPt !== "function") {
    return {
      commandName: SAVE_COMMAND_NAME,
      ok: false,
      invoked: false,
      reason: "d_save actor submit surface is unavailable.",
      savedAt: now(),
      before,
      after: before
    };
  }

  let rawResult: unknown;
  try {
    rawResult = surface.PPt(SAVE_COMMAND_NAME);
  } catch (error) {
    const after = readSaveActorSnapshot(runtime, hooks);
    return {
      commandName: SAVE_COMMAND_NAME,
      ok: false,
      invoked: true,
      reason: error instanceof Error ? error.message : "d_save actor execution threw an unknown error.",
      savedAt: now(),
      before,
      after
    };
  }

  const after = readSaveActorSnapshot(runtime, hooks);
  const ok = Boolean(rawResult);

  return {
    commandName: SAVE_COMMAND_NAME,
    ok,
    invoked: true,
    ...(ok ? {} : { reason: "d_save actor submit returned a falsy value." }),
    savedAt: now(),
    before,
    after,
    rawResult
  };
}

export function pageReadSaveActorSnapshot(
  runtime: SaveActorRuntime = globalSaveRuntime(),
  hooks: SaveSnapshotHooks = {}
): SaveActorSnapshot {
  return readSaveActorSnapshot(runtime, hooks);
}

export function pageExecuteExactSave(
  runtime: SaveActorRuntime = globalSaveRuntime(),
  hooks: SaveExecutionHooks = {}
): SaveActorReplayResult {
  return executeExactSave(runtime, hooks);
}

function globalSaveRuntime(): SaveActorRuntime {
  return globalThis as typeof globalThis & SaveActorRuntime;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptionalBoolean(
  record: Record<string, unknown>,
  ...keys: string[]
): boolean | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return null;
}

function readBrowserTitle(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  return typeof document.title === "string" ? document.title : null;
}

function readBrowserAlertText(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const alerts = Array.from(document.querySelectorAll?.('[role="alert"]') ?? []);
  const texts = alerts
    .map((element) => (element instanceof HTMLElement ? normalizeText(element.textContent) : ""))
    .filter(Boolean);

  return texts.at(-1) ?? null;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}
