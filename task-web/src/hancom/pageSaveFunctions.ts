/* eslint-disable complexity, max-lines-per-function */

export interface SaveActorStateSnapshot {
  title: string;
  alertText: string | null;
  hasEnabledSaveCommand: boolean;
  hasDisabledSaveCommand: boolean;
  actorAvailable: boolean;
  actorEnabled: boolean | null;
  actorUpdate: boolean | null;
}

export interface SaveActorReplayResult {
  ok: boolean;
  reason?: string;
  actorCommandAccepted?: boolean;
  callbackValue?: boolean | null;
  before: SaveActorStateSnapshot;
  after: SaveActorStateSnapshot;
}

export function isSaveNoOpState(snapshot: SaveActorStateSnapshot): boolean {
  return (
    snapshot.actorAvailable &&
    snapshot.actorEnabled === false &&
    snapshot.hasEnabledSaveCommand === false &&
    snapshot.hasDisabledSaveCommand === true
  );
}

export function didSaveStateChange(
  before: SaveActorStateSnapshot,
  after: SaveActorStateSnapshot
): boolean {
  return (
    (before.hasEnabledSaveCommand && !after.hasEnabledSaveCommand) ||
    before.alertText !== after.alertText ||
    before.title !== after.title ||
    (before.actorEnabled === true && after.actorEnabled === false)
  );
}

export function pageReadSaveActorState(): SaveActorStateSnapshot {
  interface SaveActorState {
    enable?: boolean;
    update?: boolean;
  }

  interface SaveActorDispatcher {
    LPt?: (command: string) => SaveActorState | null | undefined;
  }

  interface SaveRuntime {
    INt?: (installIfMissing?: boolean) => SaveActorDispatcher | null | undefined;
  }

  const runtime = globalThis as typeof globalThis & {
    HwpApp?: SaveRuntime;
  };
  const normalizeText = (value: string | null | undefined): string =>
    (value ?? "").trim().replace(/\s+/g, " ");
  const isDisabledElement = (element: HTMLElement): boolean =>
    element.classList.contains("disabled") ||
    element.classList.contains("disable") ||
    element.getAttribute("aria-disabled") === "true" ||
    element.getAttribute("disabled") !== null;
  const readLatestAlertText = (): string | null => {
    const alerts = Array.from(document.querySelectorAll('[role="alert"]'));
    const texts = alerts.map((element) => normalizeText(element.textContent)).filter(Boolean);
    return texts.at(-1) ?? null;
  };

  const actor = runtime.HwpApp?.INt?.(true);
  const actorState = actor?.LPt?.("d_save");
  const saveCommands = Array.from(document.querySelectorAll('[data-command="d_save"]')).filter(
    (element): element is HTMLElement => element instanceof HTMLElement
  );

  return {
    title: document.title,
    alertText: readLatestAlertText(),
    hasEnabledSaveCommand: saveCommands.some((element) => !isDisabledElement(element)),
    hasDisabledSaveCommand:
      saveCommands.length > 0 && saveCommands.every((element) => isDisabledElement(element)),
    actorAvailable: actor !== null && actor !== undefined,
    actorEnabled: typeof actorState?.enable === "boolean" ? actorState.enable : null,
    actorUpdate: typeof actorState?.update === "boolean" ? actorState.update : null
  };
}

export async function pageExecuteSaveActorCommand(timeoutMs = 900): Promise<SaveActorReplayResult> {
  interface SaveActorState {
    enable?: boolean;
    update?: boolean;
  }

  interface SaveActorDispatcher {
    LPt?: (command: string) => SaveActorState | null | undefined;
    PPt?: (
      command: string,
      context?: unknown,
      callback?: (result: unknown) => void
    ) => unknown;
  }

  interface SaveRuntime {
    INt?: (installIfMissing?: boolean) => SaveActorDispatcher | null | undefined;
  }

  const runtime = globalThis as typeof globalThis & {
    HwpApp?: SaveRuntime;
  };
  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  const readState = (): SaveActorStateSnapshot => {
    const normalizeText = (value: string | null | undefined): string =>
      (value ?? "").trim().replace(/\s+/g, " ");
    const isDisabledElement = (element: HTMLElement): boolean =>
      element.classList.contains("disabled") ||
      element.classList.contains("disable") ||
      element.getAttribute("aria-disabled") === "true" ||
      element.getAttribute("disabled") !== null;
    const readLatestAlertText = (): string | null => {
      const alerts = Array.from(document.querySelectorAll('[role="alert"]'));
      const texts = alerts.map((element) => normalizeText(element.textContent)).filter(Boolean);
      return texts.at(-1) ?? null;
    };

    const actor = runtime.HwpApp?.INt?.(true);
    const actorState = actor?.LPt?.("d_save");
    const saveCommands = Array.from(document.querySelectorAll('[data-command="d_save"]')).filter(
      (element): element is HTMLElement => element instanceof HTMLElement
    );

    return {
      title: document.title,
      alertText: readLatestAlertText(),
      hasEnabledSaveCommand: saveCommands.some((element) => !isDisabledElement(element)),
      hasDisabledSaveCommand:
        saveCommands.length > 0 && saveCommands.every((element) => isDisabledElement(element)),
      actorAvailable: actor !== null && actor !== undefined,
      actorEnabled: typeof actorState?.enable === "boolean" ? actorState.enable : null,
      actorUpdate: typeof actorState?.update === "boolean" ? actorState.update : null
    };
  };
  const didStateChange = (before: SaveActorStateSnapshot, after: SaveActorStateSnapshot): boolean =>
    (before.hasEnabledSaveCommand && !after.hasEnabledSaveCommand) ||
    before.alertText !== after.alertText ||
    before.title !== after.title ||
    (before.actorEnabled === true && after.actorEnabled === false);

  const before = readState();
  const actor = runtime.HwpApp?.INt?.(true);
  if (!actor || typeof actor.PPt !== "function" || typeof actor.LPt !== "function") {
    return {
      ok: false,
      reason: "Save actor runtime surface is unavailable.",
      before,
      after: before
    };
  }
  if (before.actorEnabled === false) {
    return {
      ok: false,
      reason: "Save actor is disabled in the current editor state.",
      before,
      after: before
    };
  }

  let callbackValue: boolean | null = null;
  let callbackCalled = false;
  const actorCommandAccepted = Boolean(
    actor.PPt("d_save", null, (result: unknown) => {
      callbackCalled = true;
      callbackValue = typeof result === "boolean" ? result : Boolean(result);
    })
  );
  if (!actorCommandAccepted) {
    return {
      ok: false,
      reason: 'Save actor command `PPt("d_save")` returned false.',
      actorCommandAccepted,
      before,
      after: readState()
    };
  }

  const maxAttempts = Math.max(1, Math.ceil(Math.max(150, timeoutMs) / 150));
  let after = before;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await wait(150);
    after = readState();
    if (callbackCalled || didStateChange(before, after)) {
      break;
    }
  }

  if (callbackValue === false) {
    return {
      ok: false,
      reason: "Save actor callback reported failure.",
      actorCommandAccepted,
      callbackValue,
      before,
      after
    };
  }

  if (!didStateChange(before, after) && !callbackCalled) {
    return {
      ok: false,
      reason: `Save actor did not produce an observable state change within ${Math.max(150, timeoutMs)}ms.`,
      actorCommandAccepted,
      callbackValue,
      before,
      after
    };
  }

  return {
    ok: true,
    actorCommandAccepted,
    callbackValue,
    before,
    after
  };
}
