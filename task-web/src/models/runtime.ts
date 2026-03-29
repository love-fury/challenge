import type { HwpJson20DocumentSnapshot } from "./types.js";

export type HancomDialogCommand =
  | "dialog_find_replace"
  | "dialog_insert_table"
  | "dialog_insert_image"
  | "dialog_edit_table";

export type HancomTableCommand =
  | "insert_upper_row"
  | "insert_lower_row"
  | "remove_row";

export interface HwpJson20Serializer {
  save(format: "hwpjson20;"): HwpJson20DocumentSnapshot;
}

export interface HwpJson20SerializerFactory {
  ENt?: () => HwpJson20Serializer | undefined;
}

export interface HwpDocumentRuntime {
  aPt?: () => HwpJson20SerializerFactory | undefined;
  open?: (...args: unknown[]) => unknown;
  save?: (...args: unknown[]) => unknown;
  rename?: (...args: unknown[]) => unknown;
  Svr?: Record<string, unknown>;
  Ivr?: Record<string, unknown>;
  Zvr?: Record<string, unknown>;
  Evr?: Record<string, unknown>;
}

export interface ActionManagerRuntime extends Record<string, unknown> {
  [key: string]: unknown;
}

export interface UiApiRuntime extends Record<string, unknown> {
  makeEventActionObj?: (...args: unknown[]) => unknown;
  addEventAction?: (...args: unknown[]) => unknown;
  getWidgetElementList?: (...args: unknown[]) => unknown;
  getSampleElementListByCmdName?: (...args: unknown[]) => unknown;
  findCommandWrapToParent?: (...args: unknown[]) => unknown;
}

export interface HwpCaretNodeRuntime extends Record<string, unknown> {
  qli?: string;
}

export interface HwpCaretPositionRuntime extends Record<string, unknown> {
  pos?: number;
  type?: number;
}

export interface HwpCaretContainerRuntime extends Record<string, unknown> {
  Eni?: HwpCaretNodeRuntime;
  Cni?: HwpCaretPositionRuntime;
}

export interface HwpCaretPageStateRuntime extends Record<string, unknown> {
  b8t?: number;
}

export interface HwpCaretRuntime extends Record<string, unknown> {
  AMe?: HwpCaretContainerRuntime;
  uIs?: HwpCaretPageStateRuntime;
}

export interface HwpCacheRuntime extends Record<string, unknown> {
  images?: Record<string, unknown>;
}

export interface HwpImageLoaderRuntime extends Record<string, unknown> {
  KYs?: (resourceName: string) => unknown;
}

export interface HwpAppRuntime extends Record<string, unknown> {
  document?: HwpDocumentRuntime;
  ActionManager?: ActionManagerRuntime;
  UIAPI?: UiApiRuntime;
  hwpCaret?: HwpCaretRuntime;
  cache?: HwpCacheRuntime;
  IMGLOADER?: HwpImageLoaderRuntime;
  docId?: string;
}

export type HancomRuntimeGlobal = typeof globalThis & {
  HwpApp?: HwpAppRuntime;
};

export function getRuntimeGlobal(): HancomRuntimeGlobal {
  return globalThis as HancomRuntimeGlobal;
}
