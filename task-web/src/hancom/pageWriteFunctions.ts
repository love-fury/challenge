/* eslint-disable complexity, max-lines, max-lines-per-function */

import { GOTO_DIALOG_COMMAND_ID } from "./directWriteSpecs.js";

export interface WriteReplayResult {
  ok: boolean;
  reason?: string;
  dialogClosed?: boolean;
  alertText?: string | null;
  beforeCurrentPageNumber?: number | null;
  afterCurrentPageNumber?: number | null;
  beforeScrollTop?: number | null;
  afterScrollTop?: number | null;
  commandStates?: Array<{
    selector: string;
    text: string;
    disabled: boolean;
  }>;
}

export interface ImageFileUploadPrepareResult {
  ok: boolean;
  reason?: string;
  selector?: string;
  insertEnabled?: boolean;
}

export interface WriteCommandState {
  selector: string;
  text: string;
  disabled: boolean;
}

export interface SaveCommandStateSnapshot {
  title: string;
  alertText: string | null;
  hasEnabledSaveCommand: boolean;
  hasDisabledSaveCommand: boolean;
}

export interface DirectCommandStateSnapshot {
  enabled: boolean;
  update: boolean | null;
}

export interface DirectBagValues {
  [key: number]: string | number | boolean;
}

interface DirectPropertyBag {
  yHt?: (key: number, value: string) => void;
  dHt?: (key: number, type: number, value: number) => void;
  UHt?: (key: number, value: string | number) => void;
  kHt?: Record<number, string | number>;
}

interface DirectActionTupleAction {
  cPt?: (opt: unknown, bag: DirectPropertyBag) => unknown;
}

interface DirectActionTuple {
  action?: DirectActionTupleAction;
}

interface DirectCommandState {
  update?: boolean;
}

interface DirectActionManager {
  fPt?: (commandId: number, cti: unknown) => DirectActionTuple | null | undefined;
  cPt?: (tuple: DirectActionTuple, bag?: DirectPropertyBag) => unknown;
  dPt?: (tuple: DirectActionTuple, bag: DirectPropertyBag) => unknown;
  PPt?: (commandId: number, cti: unknown) => unknown;
  LPt?: (commandId: number, cti: unknown) => DirectCommandState | null | undefined;
  OnIsEnabled?: (commandId: number, cti: unknown) => unknown;
}

interface DirectDocumentRuntime {
  aPt?: () => unknown;
}

interface DirectGotoDialogEvent {
  cmd?: string;
  type?: string;
  name?: string;
  target?: EventTarget | null;
  value?: Record<string, unknown>;
}

interface DirectGotoDialog {
  active?: boolean;
  $2s?: () => boolean;
  J2s?: (event: DirectGotoDialogEvent) => unknown;
}

interface DirectUiApiRoot {
  woh?: {
    e_goto?: DirectGotoDialog;
  };
}

interface DirectUiApi {
  Ysh?: DirectUiApiRoot;
}

interface HwpAppRuntime {
  ActionManager?: DirectActionManager;
  document?: DirectDocumentRuntime;
  UIAPI?: DirectUiApi;
  hwpCaret?: {
    uIs?: {
      b8t?: number;
    };
  };
}

export async function pageExecuteDirectPropertyBagCommand(
  commandId: number,
  bagValues: DirectBagValues
): Promise<WriteReplayResult> {
  const runtime = globalThis as typeof globalThis & {
    HwpApp?: HwpAppRuntime;
  };
  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  const normalizeText = (value: string | null | undefined): string =>
    (value ?? "").trim().replace(/\s+/g, " ");
  const readLatestAlertText = (): string | null => {
    const alerts = Array.from(document.querySelectorAll('[role="alert"]'));
    const texts = alerts.map((element) => normalizeText(element.textContent)).filter(Boolean);
    return texts.at(-1) ?? null;
  };
  const readFindReplaceStatusText = (): string | null => {
    const dialogLikeNodes = Array.from(document.querySelectorAll("body *")).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        (normalizeText(element.getAttribute("aria-label")) === "찾아 바꾸기" ||
          normalizeText(element.textContent).includes("찾아 바꾸기"))
    );
    for (const element of dialogLikeNodes) {
      const text = normalizeText(element.textContent);
      const match = text.match(/문서의 끝까지 바꾸기를\s*\d+번 했습니다\./);
      if (match?.[0]) {
        return match[0];
      }
    }

    return null;
  };
  const app = runtime.HwpApp;
  const actionManager = app?.ActionManager;
  const cti = app?.document?.aPt?.();
  if (!actionManager || typeof actionManager.fPt !== "function" || typeof actionManager.cPt !== "function") {
    return {
      ok: false,
      reason: "ActionManager direct property-bag surface is unavailable."
    };
  }
  if (!cti) {
    return {
      ok: false,
      reason: "Document command context is unavailable."
    };
  }

  const tuple = actionManager.fPt(commandId, cti);
  if (!tuple || typeof tuple !== "object" || !("action" in tuple)) {
    return {
      ok: false,
      reason: `Could not create direct action tuple for command ${String(commandId)}.`
    };
  }

  const action = tuple.action;
  if (!action || typeof action !== "object" || typeof action.cPt !== "function") {
    return {
      ok: false,
      reason: `Direct command ${String(commandId)} does not expose a captureable cPt surface.`
    };
  }

  let capturedBag: DirectPropertyBag | null = null;
  const originalCapture = action.cPt;
  action.cPt = function patchedCapture(opt: unknown, bag: DirectPropertyBag): unknown {
    if (capturedBag === null && bag && typeof bag === "object") {
      capturedBag = bag;
    }
    return originalCapture.call(this, opt, bag);
  };

  try {
    const prepared = actionManager.cPt(tuple, undefined);
    if (!prepared || capturedBag === null) {
      return {
        ok: false,
        reason: `Could not capture default property bag for command ${String(commandId)}.`
      };
    }
  } finally {
    action.cPt = originalCapture;
  }

  const propertyBag: DirectPropertyBag = capturedBag;
  for (const [rawKey, rawValue] of Object.entries(bagValues) as Array<[string, string | number | boolean]>) {
    const key = Number(rawKey);
    if (!Number.isInteger(key)) {
      continue;
    }

    if (typeof rawValue === "string") {
      if (typeof propertyBag.yHt === "function") {
        propertyBag.yHt(key, rawValue);
        continue;
      }
      propertyBag.kHt ??= {};
      propertyBag.kHt[key] = rawValue;
      if (typeof propertyBag.UHt === "function") {
        propertyBag.UHt(key, rawValue);
      }
      continue;
    }

    const value = typeof rawValue === "boolean" ? (rawValue ? 1 : 0) : rawValue;
    if (typeof propertyBag.dHt === "function") {
      propertyBag.dHt(key, 0, value);
      continue;
    }
    propertyBag.kHt ??= {};
    propertyBag.kHt[key] = value;
    if (typeof propertyBag.UHt === "function") {
      propertyBag.UHt(key, value);
    }
  }

  if (typeof actionManager.dPt !== "function") {
    return {
      ok: false,
      reason: `ActionManager direct execute surface is unavailable for command ${String(commandId)}.`
    };
  }

  const ok = actionManager.dPt(tuple, propertyBag);
  await wait(150);

  return {
    ok: Boolean(ok),
    ...(ok ? {} : { reason: `Direct property-bag command ${String(commandId)} returned false.` }),
    alertText: readFindReplaceStatusText() ?? readLatestAlertText()
  };
}

export async function pageExecuteDirectActionCommand(commandId: number): Promise<WriteReplayResult> {
  const runtime = globalThis as typeof globalThis & {
    HwpApp?: HwpAppRuntime;
  };
  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  const normalizeText = (value: string | null | undefined): string =>
    (value ?? "").trim().replace(/\s+/g, " ");
  const readLatestAlertText = (): string | null => {
    const alerts = Array.from(document.querySelectorAll('[role="alert"]'));
    const texts = alerts.map((element) => normalizeText(element.textContent)).filter(Boolean);
    return texts.at(-1) ?? null;
  };
  const app = runtime.HwpApp;
  const actionManager = app?.ActionManager;
  const cti = app?.document?.aPt?.();
  if (!actionManager || typeof actionManager.PPt !== "function") {
    return {
      ok: false,
      reason: "ActionManager direct command surface is unavailable."
    };
  }
  if (!cti) {
    return {
      ok: false,
      reason: "Document command context is unavailable."
    };
  }
  if (typeof actionManager.OnIsEnabled === "function" && !actionManager.OnIsEnabled(commandId, cti)) {
    return {
      ok: false,
      reason: `Direct command ${String(commandId)} is not enabled in the current context.`
    };
  }

  const ok = actionManager.PPt(commandId, cti);
  await wait(150);

  return {
    ok: Boolean(ok),
    ...(ok ? {} : { reason: `Direct command ${String(commandId)} returned false.` }),
    alertText: readLatestAlertText()
  };
}

export async function pageExecuteDirectGotoPage(pageNumber: number): Promise<WriteReplayResult> {
  const runtime = globalThis as typeof globalThis & {
    HwpApp?: HwpAppRuntime;
  };
  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  const normalizeText = (value: string | null | undefined): string =>
    (value ?? "").trim().replace(/\s+/g, " ");
  const readLatestAlertText = (): string | null => {
    const alerts = Array.from(document.querySelectorAll('[role="alert"]'));
    const texts = alerts.map((element) => normalizeText(element.textContent)).filter(Boolean);
    return texts.at(-1) ?? null;
  };
  const readCurrentPageNumber = (): number | null => {
    const app = runtime.HwpApp;
    const pageState = app?.hwpCaret?.uIs;
    return typeof pageState?.b8t === "number" ? pageState.b8t : null;
  };
  const readScrollTop = (): number | null => {
    const scrollContainer = document.getElementById("hcwoViewScroll");
    return scrollContainer instanceof HTMLElement ? scrollContainer.scrollTop : null;
  };
  const isDialogActive = (dialog: DirectGotoDialog | undefined): boolean =>
    Boolean(dialog?.$2s?.() ?? dialog?.active);
  // Static deob shows goto as 33840 -> e_goto.J2s(...) -> pw.dPt -> jQe/QQe.
  const invokeGotoSubmit = (dialog: DirectGotoDialog, targetPage: number): void => {
    const submitTarget = document.querySelector(
      'button.e_goto.goto_confirm[data-command="e_goto"][data-value-key="execute"]'
    );
    const payload: DirectGotoDialogEvent = {
      cmd: "update",
      type: "ui",
      name: "find_goto",
      target: submitTarget instanceof HTMLElement ? submitTarget : null,
      value: {
        goto_input: String(targetPage),
        execute: "confirm"
      }
    };

    dialog.J2s?.(payload);
  };

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return {
      ok: false,
      reason: `gotoPage requires a positive integer page number. Received ${String(pageNumber)}.`
    };
  }

  const app = runtime.HwpApp;
  const actionManager = app?.ActionManager;
  const cti = app?.document?.aPt?.();
  const beforeCurrentPageNumber = readCurrentPageNumber();
  const beforeScrollTop = readScrollTop();
  if (!actionManager || typeof actionManager.PPt !== "function") {
    return {
      ok: false,
      reason: "ActionManager direct command surface is unavailable.",
      beforeCurrentPageNumber,
      beforeScrollTop
    };
  }
  if (!cti) {
    return {
      ok: false,
      reason: "Document command context is unavailable.",
      beforeCurrentPageNumber,
      beforeScrollTop
    };
  }
  if (typeof actionManager.OnIsEnabled === "function" && !actionManager.OnIsEnabled(GOTO_DIALOG_COMMAND_ID, cti)) {
    return {
      ok: false,
      reason: `Direct command ${String(GOTO_DIALOG_COMMAND_ID)} is not enabled in the current context.`,
      beforeCurrentPageNumber,
      beforeScrollTop
    };
  }

  const opened = actionManager.PPt(GOTO_DIALOG_COMMAND_ID, cti);
  await wait(50);

  const dialog = app?.UIAPI?.Ysh?.woh?.e_goto;
  if (!opened) {
    return {
      ok: false,
      reason: `Direct command ${String(GOTO_DIALOG_COMMAND_ID)} returned false.`,
      beforeCurrentPageNumber,
      beforeScrollTop,
      afterCurrentPageNumber: readCurrentPageNumber(),
      afterScrollTop: readScrollTop(),
      alertText: readLatestAlertText()
    };
  }
  if (!dialog || typeof dialog.J2s !== "function") {
    return {
      ok: false,
      reason: "Goto dialog submit surface is unavailable.",
      beforeCurrentPageNumber,
      beforeScrollTop,
      afterCurrentPageNumber: readCurrentPageNumber(),
      afterScrollTop: readScrollTop(),
      alertText: readLatestAlertText()
    };
  }
  if (!isDialogActive(dialog)) {
    return {
      ok: false,
      reason: "Goto dialog did not become active after opening the command.",
      beforeCurrentPageNumber,
      beforeScrollTop,
      afterCurrentPageNumber: readCurrentPageNumber(),
      afterScrollTop: readScrollTop(),
      alertText: readLatestAlertText()
    };
  }

  invokeGotoSubmit(dialog, pageNumber);
  await wait(150);

  let afterCurrentPageNumber = readCurrentPageNumber();
  let afterScrollTop = readScrollTop();

  if (afterCurrentPageNumber !== pageNumber && afterCurrentPageNumber === beforeCurrentPageNumber) {
    dialog.J2s({
      value: {
        goto_input: String(pageNumber),
        execute: "confirm"
      }
    });
    await wait(150);
    afterCurrentPageNumber = readCurrentPageNumber();
    afterScrollTop = readScrollTop();
  }

  const reachedRequestedPage = afterCurrentPageNumber === pageNumber;
  const alreadyOnRequestedPage = beforeCurrentPageNumber === pageNumber;
  const didScroll =
    beforeScrollTop !== null &&
    afterScrollTop !== null &&
    beforeScrollTop !== afterScrollTop;

  return {
    ok: reachedRequestedPage || alreadyOnRequestedPage || didScroll,
    ...(reachedRequestedPage || alreadyOnRequestedPage || didScroll
      ? {}
      : { reason: `gotoPage did not produce an observable move to page ${String(pageNumber)}.` }),
    beforeCurrentPageNumber,
    afterCurrentPageNumber,
    beforeScrollTop,
    afterScrollTop,
    dialogClosed: !isDialogActive(dialog),
    alertText: readLatestAlertText()
  };
}

export function pageReadDirectCommandState(commandId: number): DirectCommandStateSnapshot {
  const runtime = globalThis as typeof globalThis & {
    HwpApp?: HwpAppRuntime;
  };
  const app = runtime.HwpApp;
  const actionManager = app?.ActionManager;
  const cti = app?.document?.aPt?.();
  if (!actionManager || !cti) {
    return {
      enabled: false,
      update: null
    };
  }

  const enabled =
    typeof actionManager.OnIsEnabled === "function" ? Boolean(actionManager.OnIsEnabled(commandId, cti)) : false;
  let update: boolean | null = null;
  if (typeof actionManager.LPt === "function") {
    const state = actionManager.LPt(commandId, cti);
    if (state && typeof state === "object" && "update" in state && typeof state.update === "boolean") {
      update = state.update;
    }
  }

  return {
    enabled,
    update
  };
}

export async function pagePrepareInsertImageFileUpload(): Promise<ImageFileUploadPrepareResult> {
  const uploadTargetAttribute = "data-hancom-upload-target";
  const normalizeText = (value: string | null | undefined): string =>
    (value ?? "").trim().replace(/\s+/g, " ");
  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  const isDisabledElement = (element: HTMLElement, allowDisabled = false): boolean => {
    if (allowDisabled) {
      return false;
    }

    return (
      element.classList.contains("disabled") ||
      element.classList.contains("disable") ||
      element.getAttribute("aria-disabled") === "true" ||
      element.getAttribute("disabled") !== null
    );
  };
  const isEnabledElement = (element: Element, allowDisabled = false): boolean =>
    element instanceof HTMLElement && !isDisabledElement(element, allowDisabled);
  const openDialog = (dialog: string): ImageFileUploadPrepareResult => {
    const launcher = Array.from(
      document.querySelectorAll(`[data-ui-value="${dialog}"][data-ui-command="show"]`)
    ).find((element) => isEnabledElement(element));

    if (!(launcher instanceof HTMLElement)) {
      return {
        ok: false,
        reason: `Could not find enabled launcher for ${dialog}.`
      };
    }

    launcher.click();
    return { ok: true };
  };
  const clickByRoleText = (role: string, text: string): boolean => {
    const candidate = Array.from(document.querySelectorAll(`[role="${role}"]`)).find(
      (element) => normalizeText(element.textContent) === text && isEnabledElement(element)
    );
    if (!(candidate instanceof HTMLElement)) {
      return false;
    }

    candidate.click();
    return true;
  };
  const findInsertButton = (): HTMLButtonElement | null => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (element) =>
        element instanceof HTMLButtonElement &&
        normalizeText(element.textContent) === "넣기"
    );
    return button instanceof HTMLButtonElement ? button : null;
  };

  const opened = openDialog("dialog_insert_image");
  if (!opened.ok) {
    return opened;
  }

  await wait(50);
  clickByRoleText("radio", "장치");
  await wait(50);

  Array.from(document.querySelectorAll(`[${uploadTargetAttribute}]`)).forEach((element) => {
    if (element instanceof HTMLElement) {
      element.removeAttribute(uploadTargetAttribute);
    }
  });

  const fileInput = Array.from(document.querySelectorAll("input")).find(
    (element) => element instanceof HTMLInputElement && element.type === "file"
  );
  if (!(fileInput instanceof HTMLInputElement)) {
    return {
      ok: false,
      reason: "Could not find local file input in image dialog."
    };
  }

  fileInput.setAttribute(uploadTargetAttribute, "true");
  return {
    ok: true,
    selector: `input[${uploadTargetAttribute}="true"]`,
    insertEnabled: (() => {
      const insertButton = findInsertButton();
      return insertButton instanceof HTMLButtonElement ? !isDisabledElement(insertButton) : false;
    })()
  };
}

export function pageReadSaveCommandState(): SaveCommandStateSnapshot {
  const normalizeText = (value: string | null | undefined): string =>
    (value ?? "").trim().replace(/\s+/g, " ");
  const isDisabledElement = (element: HTMLElement, allowDisabled = false): boolean => {
    if (allowDisabled) {
      return false;
    }

    return (
      element.classList.contains("disabled") ||
      element.classList.contains("disable") ||
      element.getAttribute("aria-disabled") === "true" ||
      element.getAttribute("disabled") !== null
    );
  };
  const readLatestAlertText = (): string | null => {
    const alerts = Array.from(document.querySelectorAll('[role="alert"]'));
    const texts = alerts.map((element) => normalizeText(element.textContent)).filter(Boolean);
    return texts.at(-1) ?? null;
  };
  const saveCommands = Array.from(document.querySelectorAll('[data-command="d_save"]')).filter(
    (element): element is HTMLElement => element instanceof HTMLElement
  );

  return {
    title: document.title,
    alertText: readLatestAlertText(),
    hasEnabledSaveCommand: saveCommands.some((element) => !isDisabledElement(element)),
    hasDisabledSaveCommand:
      saveCommands.length > 0 && saveCommands.every((element) => isDisabledElement(element))
  };
}

export async function pageFinalizeInsertImageFileUpload(): Promise<WriteReplayResult> {
  const uploadTargetAttribute = "data-hancom-upload-target";
  const normalizeText = (value: string | null | undefined): string =>
    (value ?? "").trim().replace(/\s+/g, " ");
  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  const isDisabledElement = (element: HTMLElement, allowDisabled = false): boolean => {
    if (allowDisabled) {
      return false;
    }

    return (
      element.classList.contains("disabled") ||
      element.classList.contains("disable") ||
      element.getAttribute("aria-disabled") === "true" ||
      element.getAttribute("disabled") !== null
    );
  };
  const isEnabledElement = (element: Element, allowDisabled = false): boolean =>
    element instanceof HTMLElement && !isDisabledElement(element, allowDisabled);
  const clickButton = (text: string): boolean => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (element) => normalizeText(element.textContent) === text && isEnabledElement(element)
    );
    if (!(button instanceof HTMLElement)) {
      return false;
    }

    button.click();
    return true;
  };
  const collectCommandStates = (
    selectors: string[]
  ): Array<{
    selector: string;
    text: string;
    disabled: boolean;
  }> =>
    selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll(selector))
        .filter((element): element is HTMLElement => element instanceof HTMLElement)
        .map((element) => ({
          selector,
          text: normalizeText(element.textContent),
          disabled: isDisabledElement(element)
        }))
    );
  const readLatestAlertText = (): string | null => {
    const alerts = Array.from(document.querySelectorAll('[role="alert"]'));
    const texts = alerts.map((element) => normalizeText(element.textContent)).filter(Boolean);
    return texts.at(-1) ?? null;
  };
  const hasVisibleText = (text: string): boolean =>
    Array.from(document.querySelectorAll("body *")).some((element) => {
      if (!(element instanceof HTMLElement) || !isEnabledElement(element, true)) {
        return false;
      }

      return normalizeText(element.textContent) === text;
    });

  await wait(200);
  const clicked = clickButton("넣기");
  await wait(500);

  Array.from(document.querySelectorAll(`[${uploadTargetAttribute}]`)).forEach((element) => {
    if (element instanceof HTMLElement) {
      element.removeAttribute(uploadTargetAttribute);
    }
  });

  return {
    ok: clicked,
    dialogClosed: !hasVisibleText("그림 넣기"),
    commandStates: collectCommandStates([
      '[data-command="modify_object_properties"]',
      '[data-command="e_insert_caption"]'
    ]),
    alertText: readLatestAlertText()
  };
}

export function pageReadWriteCommandStates(selectors: string[]): WriteCommandState[] {
  const normalizeText = (value: string | null | undefined): string =>
    (value ?? "").trim().replace(/\s+/g, " ");
  const isDisabledElement = (element: HTMLElement): boolean =>
    element.classList.contains("disabled") ||
    element.classList.contains("disable") ||
    element.getAttribute("aria-disabled") === "true" ||
    element.getAttribute("disabled") !== null;

  return selectors.flatMap((selector) =>
    Array.from(document.querySelectorAll(selector))
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .map((element) => ({
        selector,
        text: normalizeText(element.textContent),
        disabled: isDisabledElement(element)
      }))
  );
}
