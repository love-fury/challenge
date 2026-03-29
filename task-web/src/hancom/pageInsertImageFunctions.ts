/* eslint-disable complexity, max-lines, max-lines-per-function */

import type { WriteReplayResult } from "./pageWriteFunctions.js";

export interface ImageFileUploadPrepareResult {
  ok: boolean;
  reason?: string;
  selector?: string;
  insertEnabled?: boolean;
}

export interface DirectImageInsertReplayResult extends WriteReplayResult {
  beforeImageControlCount?: number;
  afterImageControlCount?: number;
  beforeBinaryAssetCount?: number;
  afterBinaryAssetCount?: number;
}

export function isInsertImageDialogCandidate(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    x2s?: { R7s?: (key: string) => unknown };
    L2s?: unknown;
  };
  return typeof candidate.L2s === "function" && typeof candidate.x2s?.R7s === "function";
}

export async function pagePrepareInsertImageFileUpload(): Promise<ImageFileUploadPrepareResult> {
  const insertImageCommandId = 34736;

  interface DirectCommandState {
    enable?: boolean;
  }

  interface DirectActionManager {
    PPt?: (commandId: number, cti: unknown) => unknown;
    LPt?: (commandId: number, cti: unknown) => DirectCommandState | null | undefined;
  }

  interface WidgetDomApi {
    getInputElementByWidget?: (widget: unknown) => HTMLInputElement | null | undefined;
  }

  interface DirectUiApiRoot {
    woh?: Record<string, unknown>;
  }

  interface DirectUiApi {
    Ysh?: DirectUiApiRoot;
    D0s?: WidgetDomApi;
    getWidgetElementList?: (...args: unknown[]) => unknown;
  }

  interface DirectDocumentRuntime {
    aPt?: () => unknown;
  }

  interface HwpAppRuntime {
    ActionManager?: DirectActionManager;
    document?: DirectDocumentRuntime;
    UIAPI?: DirectUiApi;
  }

  const runtime = globalThis as typeof globalThis & {
    HwpApp?: HwpAppRuntime;
  };
  const uploadTargetAttribute = "data-hancom-upload-target";
  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  const isDialogCandidate = (value: unknown): boolean => {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as {
      x2s?: { R7s?: (key: string) => unknown };
      L2s?: unknown;
    };
    return typeof candidate.L2s === "function" && typeof candidate.x2s?.R7s === "function";
  };
  const isDisabledElement = (element: HTMLElement): boolean =>
    element.classList.contains("disabled") ||
    element.classList.contains("disable") ||
    element.getAttribute("aria-disabled") === "true" ||
    element.getAttribute("disabled") !== null;
  const findInsertImageDialog = (uiapi: DirectUiApi | undefined): {
    x2s: { R7s?: (key: string) => unknown; A7s?: (key: string, value: unknown) => void };
    L2s: (mode: number) => unknown;
    Vih?: (value: string) => void;
  } | null => {
    const store = uiapi?.Ysh?.woh;
    if (!store || typeof store !== "object") {
      return null;
    }

    for (const candidate of Object.values(store)) {
      if (!isDialogCandidate(candidate)) {
        continue;
      }

      const dialog = candidate as {
        x2s: { R7s?: (key: string) => unknown; A7s?: (key: string, value: unknown) => void };
        L2s: (mode: number) => unknown;
        Vih?: (value: string) => void;
      };
      const locationType = dialog.x2s.R7s?.("location_type");
      const fromComputer = dialog.x2s.R7s?.("from_computer");
      if (locationType === "from_computer" || fromComputer !== undefined) {
        return dialog;
      }
    }

    return null;
  };
  const resolveWidget = (uiapi: DirectUiApi | undefined, dialog: ReturnType<typeof findInsertImageDialog>): unknown => {
    const widgetFromDialog = dialog?.x2s.R7s?.("from_computer");
    if (widgetFromDialog !== undefined) {
      return widgetFromDialog;
    }

    const widgetList = uiapi?.getWidgetElementList?.("i_insert_image", null, "from_computer");
    if (Array.isArray(widgetList) && widgetList.length > 0) {
      return widgetList[0];
    }

    return null;
  };
  const resolveInput = (uiapi: DirectUiApi | undefined, widget: unknown): HTMLInputElement | null => {
    if (widget instanceof HTMLInputElement && widget.type === "file") {
      return widget;
    }

    const widgetInput = uiapi?.D0s?.getInputElementByWidget?.(widget);
    if (widgetInput instanceof HTMLInputElement && widgetInput.type === "file") {
      return widgetInput;
    }

    const allInputs = Array.from(document.querySelectorAll("input")).filter(
      (element): element is HTMLInputElement =>
        element instanceof HTMLInputElement && element.type === "file"
    );
    return allInputs[0] ?? null;
  };
  const findInsertButton = (): HTMLButtonElement | null => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (element) =>
        element instanceof HTMLButtonElement &&
        element.textContent?.trim().replace(/\s+/g, " ") === "넣기"
    );
    return button instanceof HTMLButtonElement ? button : null;
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
  if (typeof actionManager.LPt === "function") {
    const state = actionManager.LPt(insertImageCommandId, cti);
    if (state && typeof state.enable === "boolean" && state.enable === false) {
      return {
        ok: false,
        reason: `Direct command ${String(insertImageCommandId)} is disabled in the current context.`
      };
    }
  }

  const opened = Boolean(actionManager.PPt(insertImageCommandId, cti));
  await wait(100);
  if (!opened) {
    return {
      ok: false,
      reason: `Direct command ${String(insertImageCommandId)} returned false.`
    };
  }

  const dialog = findInsertImageDialog(app?.UIAPI);
  if (dialog?.x2s.A7s) {
    dialog.x2s.A7s("location_type", "from_computer");
    dialog.Vih?.("from_computer");
  }

  Array.from(document.querySelectorAll(`[${uploadTargetAttribute}]`)).forEach((element) => {
    if (element instanceof HTMLElement) {
      element.removeAttribute(uploadTargetAttribute);
    }
  });

  const widget = resolveWidget(app?.UIAPI, dialog);
  const fileInput = resolveInput(app?.UIAPI, widget);
  if (!(fileInput instanceof HTMLInputElement)) {
    return {
      ok: false,
      reason: "Could not resolve the local file widget for insert-image."
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

export async function pageFinalizeInsertImageFileUpload(): Promise<WriteReplayResult> {
  interface DirectUiApiRoot {
    woh?: Record<string, unknown>;
  }

  interface DirectUiApi {
    Ysh?: DirectUiApiRoot;
  }

  interface HwpAppRuntime {
    UIAPI?: DirectUiApi;
  }

  const runtime = globalThis as typeof globalThis & {
    HwpApp?: HwpAppRuntime;
  };
  const uploadTargetAttribute = "data-hancom-upload-target";
  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  const isDialogCandidate = (value: unknown): boolean => {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as {
      x2s?: { R7s?: (key: string) => unknown };
      L2s?: unknown;
    };
    return typeof candidate.L2s === "function" && typeof candidate.x2s?.R7s === "function";
  };
  const normalizeText = (value: string | null | undefined): string =>
    (value ?? "").trim().replace(/\s+/g, " ");
  const isDisabledElement = (element: HTMLElement): boolean =>
    element.classList.contains("disabled") ||
    element.classList.contains("disable") ||
    element.getAttribute("aria-disabled") === "true" ||
    element.getAttribute("disabled") !== null;
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
  const findInsertImageDialog = (): {
    x2s: { R7s?: (key: string) => unknown };
    L2s: (mode: number) => unknown;
    $2s?: () => boolean;
    active?: boolean;
  } | null => {
    const store = runtime.HwpApp?.UIAPI?.Ysh?.woh;
    if (!store || typeof store !== "object") {
      return null;
    }

    for (const candidate of Object.values(store)) {
      if (!isDialogCandidate(candidate)) {
        continue;
      }

      const dialog = candidate as {
        x2s: { R7s?: (key: string) => unknown };
        L2s: (mode: number) => unknown;
        $2s?: () => boolean;
        active?: boolean;
      };
      const locationType = dialog.x2s.R7s?.("location_type");
      const fromComputer = dialog.x2s.R7s?.("from_computer");
      if (locationType === "from_computer" || fromComputer !== undefined) {
        return dialog;
      }
    }

    return null;
  };

  await wait(200);
  const dialog = findInsertImageDialog();
  if (!dialog || typeof dialog.L2s !== "function") {
    return {
      ok: false,
      reason: "Insert-image dialog runtime surface is unavailable."
    };
  }

  const ok = Boolean(dialog.L2s(1));
  await wait(500);

  Array.from(document.querySelectorAll(`[${uploadTargetAttribute}]`)).forEach((element) => {
    if (element instanceof HTMLElement) {
      element.removeAttribute(uploadTargetAttribute);
    }
  });

  return {
    ok,
    ...(ok ? {} : { reason: "Insert-image dialog confirm surface returned false." }),
    dialogClosed: !(dialog.$2s?.() ?? dialog.active ?? false),
    commandStates: collectCommandStates([
      '[data-command="modify_object_properties"]',
      '[data-command="e_insert_caption"]'
    ]),
    alertText: readLatestAlertText()
  };
}

export async function pageExecuteDirectInsertImageBlob(
  base64: string,
  mimeType: string
): Promise<DirectImageInsertReplayResult> {
  const insertImageCommandId = 34736;
  const insertImageBagTypeId = 518;
  const imagePayloadKey = 615;
  const imageSourceKey = 16414;
  const imageSourceModeKey = 16415;
  const imageInsertModeKey = 16436;

  interface DirectPropertyBag {
    KHt?: (key: number, type: number) => DirectPropertyBag | null;
    yHt?: (key: number, value: string) => boolean | void;
    dHt?: (key: number, type: number, value: number | boolean) => boolean | void;
    QAt?: () => void;
  }

  interface DirectBagConstructor {
    jHt?: (type: number) => DirectPropertyBag | null;
  }

  interface DirectActionTuple {
    action?: unknown;
    OPt?: unknown;
  }

  interface DirectActionManager {
    fPt?: (commandId: number, cti: unknown) => DirectActionTuple | null | undefined;
    dPt?: (tuple: DirectActionTuple, bag: DirectPropertyBag) => unknown;
    QAt?: (action: unknown, opt: unknown, bag?: DirectPropertyBag) => unknown;
  }

  interface DirectDocumentRuntime {
    aPt?: () => {
      ENt?: () => {
        save?: (format: string) => unknown;
      };
    } | null | undefined;
  }

  interface HwpAppRuntime {
    ActionManager?: DirectActionManager;
    appState?: {
      constructor?: DirectBagConstructor;
    };
    document?: DirectDocumentRuntime;
  }

  interface HwpJson20LikeSnapshot {
    cs?: Record<string, { img?: { bi?: unknown }; rc?: { img?: { bi?: unknown } } }> | unknown[];
    bi?: Record<string, unknown> | unknown[];
  }

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
  const decodeBase64 = (value: string): ArrayBuffer => {
    const decoded = atob(value);
    const buffer = new ArrayBuffer(decoded.length);
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index);
    }
    return buffer;
  };
  const readSnapshot = (): HwpJson20LikeSnapshot | null => {
    const cti = runtime.HwpApp?.document?.aPt?.();
    const exported = cti?.ENt?.()?.save?.("hwpjson20;");
    return exported && typeof exported === "object" ? (exported as HwpJson20LikeSnapshot) : null;
  };
  const countImages = (snapshot: HwpJson20LikeSnapshot | null): {
    imageControls: number;
    binaryAssets: number;
  } => {
    const controlEntries = Array.isArray(snapshot?.cs)
      ? snapshot?.cs
      : Object.values(snapshot?.cs ?? {});
    const imageControls = controlEntries.filter((control) => {
      if (!control || typeof control !== "object") {
        return false;
      }

      const candidate = control as {
        img?: { bi?: unknown };
        rc?: { img?: { bi?: unknown } };
      };
      return candidate.img?.bi !== undefined || candidate.rc?.img?.bi !== undefined;
    }).length;
    const binaryAssets = Array.isArray(snapshot?.bi)
      ? snapshot.bi.length
      : Object.keys(snapshot?.bi ?? {}).length;

    return {
      imageControls,
      binaryAssets
    };
  };

  const app = runtime.HwpApp;
  const actionManager = app?.ActionManager;
  const bagConstructor = app?.appState?.constructor;
  const cti = app?.document?.aPt?.();
  if (!actionManager || typeof actionManager.fPt !== "function" || typeof actionManager.dPt !== "function") {
    return {
      ok: false,
      reason: "ActionManager direct insert-image surface is unavailable."
    };
  }
  if (!bagConstructor || typeof bagConstructor.jHt !== "function") {
    return {
      ok: false,
      reason: "Direct property-bag factory is unavailable for insert-image."
    };
  }
  if (!cti) {
    return {
      ok: false,
      reason: "Document command context is unavailable."
    };
  }

  const beforeSnapshot = readSnapshot();
  const beforeCounts = countImages(beforeSnapshot);
  const tuple = actionManager.fPt(insertImageCommandId, cti);
  if (!tuple || typeof tuple !== "object") {
    return {
      ok: false,
      reason: `Could not create direct action tuple for command ${String(insertImageCommandId)}.`,
      beforeImageControlCount: beforeCounts.imageControls,
      beforeBinaryAssetCount: beforeCounts.binaryAssets
    };
  }

  const bag = bagConstructor.jHt(insertImageBagTypeId);
  const imagePayload = bag?.KHt?.(imagePayloadKey, imagePayloadKey);
  if (!bag || !imagePayload) {
    return {
      ok: false,
      reason: "Could not create the direct insert-image property bag.",
      beforeImageControlCount: beforeCounts.imageControls,
      beforeBinaryAssetCount: beforeCounts.binaryAssets
    };
  }

  const blobUrl = URL.createObjectURL(new Blob([decodeBase64(base64)], { type: mimeType }));
  try {
    imagePayload.yHt?.(imageSourceKey, blobUrl);
    imagePayload.dHt?.(imageSourceModeKey, 1, 1);
    imagePayload.dHt?.(imageInsertModeKey, 1, 1);

    const ok = Boolean(actionManager.dPt(tuple, bag));
    if (typeof actionManager.QAt === "function") {
      actionManager.QAt(tuple.action, tuple.OPt, bag);
    }

    await wait(1200);
    const afterSnapshot = readSnapshot();
    const afterCounts = countImages(afterSnapshot);
    const didGrow =
      afterCounts.imageControls > beforeCounts.imageControls ||
      afterCounts.binaryAssets > beforeCounts.binaryAssets;

    return {
      ok: ok && didGrow,
      ...(ok && didGrow
        ? {}
        : {
            reason: ok
              ? "Direct insert-image replay completed but hwpjson20 read-back did not change."
              : "Direct insert-image replay returned false."
          }),
      alertText: readLatestAlertText(),
      beforeImageControlCount: beforeCounts.imageControls,
      afterImageControlCount: afterCounts.imageControls,
      beforeBinaryAssetCount: beforeCounts.binaryAssets,
      afterBinaryAssetCount: afterCounts.binaryAssets
    };
  } finally {
    URL.revokeObjectURL(blobUrl);
    imagePayload.QAt?.();
    bag.QAt?.();
  }
}
