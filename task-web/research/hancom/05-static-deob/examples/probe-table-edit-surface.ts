// Repro:
// npx tsx research/hancom/05-static-deob/examples/probe-table-edit-surface.ts --port 9333
// npx tsx research/hancom/05-static-deob/examples/probe-table-edit-surface.ts --port 9333 tmp/discovery/05-static-deob/manual-probe enter,f2,tab,shift-tab,escape
//
// Run this while the editor caret is inside or on a table cell. The probe installs a runtime
// ActionManager hook, presses the requested keys in sequence, and records selection/edit-state
// snapshots after each step.

import fs from "node:fs/promises";
import path from "node:path";

import { discoverChromeTarget } from "../../../../src/client/chromeDiscovery.js";
import { CdpSession } from "../../../../src/client/CdpSession.js";
import { serializePageFunctionCall } from "../../../../src/hancom/evaluation.js";
import { pageReadCurrentTableCellState } from "../../../../src/hancom/pageFunctions.js";
import { parseExampleCliOptions } from "../../../../examples/_cli.js";

const TABLE_COMMAND_IDS = [35456, 35473, 35474, 35477] as const;
const DEFAULT_SEQUENCE: ProbeKey[] = ["enter", "f2", "tab", "shift-tab", "escape"];

type ProbeKey = "enter" | "f2" | "tab" | "shift-tab" | "escape";

interface ProbeHookLog {
  method: string;
  commandId: number | string | null;
  tupleCommandId: number | null;
  bagKeyCount: number;
  timestamp: number;
}

interface ProbeSnapshot {
  step: string;
  title: string;
  url: string;
  currentCell: unknown | null;
  selection: {
    selectedCellCount: number;
    selectedMultiCount: number;
  };
  commands: Array<{
    commandId: number;
    enabled: boolean | null;
    update: boolean | null;
  }>;
  editorState: {
    viewWritable: boolean | null;
    selectionMode: number | null;
    caretNodeId: string | null;
    caretPositionType: number | null;
    currentPageNumber: number | null;
  };
  queue: {
    cmd: string | null;
    type: number | null;
    text: string | null;
    charShapeId: string | number | null;
  } | null;
  hook: {
    totalLogCount: number;
    nextLogIndex: number;
    newLogs: ProbeHookLog[];
  };
}

interface ProbeArtifact {
  generatedAt: string;
  targetId: string;
  targetTitle: string;
  targetUrl: string;
  clickPoint: { x: number; y: number } | null;
  sourceNotes: string[];
  sequence: ProbeKey[];
  snapshots: ProbeSnapshot[];
}

async function main(): Promise<void> {
  const { connectionOptions, positionals } = parseExampleCliOptions(process.argv.slice(2));
  const target = await discoverChromeTarget(connectionOptions);
  const session = new CdpSession();
  await session.connect(target.webSocketDebuggerUrl);

  try {
    const artifactRoot =
      positionals[0] ??
      path.join(
        "tmp/discovery/05-static-deob",
        `table-edit-surface-${new Date().toISOString().replace(/[:.]/g, "-")}-${target.id.slice(0, 8)}`
      );
    const sequence = parseSequence(positionals[1]);
    const clickPoint = parsePoint(positionals[2]);

    await session.evaluate<{ installed: boolean; availableMethods: string[] }>(
      serializePageFunctionCall(pageInstallTableActionHook)
    );

    if (clickPoint !== null) {
      await clickEditorPoint(session, clickPoint);
      await wait(180);
    }

    const snapshots: ProbeSnapshot[] = [];
    let logIndex = 0;

    const baseline = await readSnapshot(session, "baseline", logIndex);
    snapshots.push(baseline);
    logIndex = baseline.hook.nextLogIndex;

    for (const key of sequence) {
      await dispatchProbeKey(session, key);
      await wait(180);
      const snapshot = await readSnapshot(session, `after:${key}`, logIndex);
      snapshots.push(snapshot);
      logIndex = snapshot.hook.nextLogIndex;
    }

    await fs.mkdir(artifactRoot, { recursive: true });
    const artifactPath = path.join(artifactRoot, "table-edit-surface.json");
    const artifact: ProbeArtifact = {
      generatedAt: new Date().toISOString(),
      targetId: target.id,
      targetTitle: target.title,
      targetUrl: target.url,
      clickPoint,
      sourceNotes: [
        "1556-h.js shows row/column insertion routed through cti.yJn().h0t(checkOnly, positionKind, count).",
        "1557-u.js shows row/column deletion routed through cti.yJn().K2t(checkOnly, deleteKind).",
        "No dedicated ActionManager command for table-cell text edit entry is confirmed yet; current strongest candidates remain key-driven transitions such as Enter/F2/Tab."
      ],
      sequence,
      snapshots
    };

    await fs.writeFile(artifactPath, JSON.stringify(artifact, null, 2));

    console.log(
      JSON.stringify(
        {
          artifactPath,
          clickPoint,
          sequence,
          baselineSelection: baseline.selection,
          baselineCell: baseline.currentCell,
          finalSelection: snapshots.at(-1)?.selection ?? null,
          finalCell: snapshots.at(-1)?.currentCell ?? null,
          baselineQueue: baseline.queue,
          finalQueue: snapshots.at(-1)?.queue ?? null,
          finalNewLogs: snapshots.at(-1)?.hook.newLogs ?? []
        },
        null,
        2
      )
    );
  } finally {
    await session.close();
  }
}

function parseSequence(raw: string | undefined): ProbeKey[] {
  if (!raw) {
    return DEFAULT_SEQUENCE;
  }

  const keys = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (keys.length === 0) {
    return DEFAULT_SEQUENCE;
  }

  return keys.map((value) => {
    if (!isProbeKey(value)) {
      throw new Error(`Unsupported probe key: ${value}`);
    }
    return value;
  });
}

function isProbeKey(value: string): value is ProbeKey {
  return DEFAULT_SEQUENCE.includes(value as ProbeKey);
}

function parsePoint(raw: string | undefined): { x: number; y: number } | null {
  if (!raw) {
    return null;
  }

  const match = raw.match(/^(\d+),(\d+)$/);
  if (!match) {
    throw new Error(`Invalid click point. Expected "x,y" but received: ${raw}`);
  }

  return {
    x: Number.parseInt(match[1] ?? "", 10),
    y: Number.parseInt(match[2] ?? "", 10)
  };
}

async function dispatchProbeKey(session: CdpSession, key: ProbeKey): Promise<void> {
  switch (key) {
    case "enter":
      await session.pressEnter();
      break;
    case "f2":
      await session.pressF2();
      break;
    case "tab":
      await session.pressTab();
      break;
    case "shift-tab":
      await session.pressShiftTab();
      break;
    case "escape":
      await session.pressEscape();
      break;
  }
}

async function clickEditorPoint(session: CdpSession, point: { x: number; y: number }): Promise<void> {
  await session.bringToFront();
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
    button: "none"
  });
  await session.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1
  });
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1
  });
}

async function readSnapshot(
  session: CdpSession,
  step: string,
  sinceLogIndex: number
): Promise<ProbeSnapshot> {
  const currentCell = await session.evaluate<unknown | null>(
    serializePageFunctionCall(pageReadCurrentTableCellState)
  );
  
  return await session.evaluate<ProbeSnapshot>(
    serializePageFunctionCall(pageReadTableProbeSnapshot, step, sinceLogIndex, currentCell)
  );
}

async function wait(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function pageInstallTableActionHook(): {
  installed: boolean;
  availableMethods: string[];
} {
  type HookableMethod = "PPt" | "LPt" | "OnIsEnabled" | "fPt" | "cPt" | "dPt";
  type HookLog = {
    method: HookableMethod;
    commandId: number | string | null;
    tupleCommandId: number | null;
    bagKeyCount: number;
    timestamp: number;
  };
  type DebugState = {
    installed: boolean;
    muted: boolean;
    logs: HookLog[];
  };
  type DirectPropertyBag = {
    kHt?: Record<string, unknown>;
  };
  type DirectActionTuple = {
    Cre?: number;
  };
  type DirectActionManager = Record<string, unknown> & {
    PPt?: (...args: unknown[]) => unknown;
    LPt?: (...args: unknown[]) => unknown;
    OnIsEnabled?: (...args: unknown[]) => unknown;
    fPt?: (...args: unknown[]) => unknown;
    cPt?: (...args: unknown[]) => unknown;
    dPt?: (...args: unknown[]) => unknown;
  };
  type RuntimeGlobal = typeof globalThis & {
    HwpApp?: {
      ActionManager?: DirectActionManager;
    };
    __HANCOM_TABLE_ACTION_DEBUG__?: DebugState;
  };

  const runtime = globalThis as RuntimeGlobal;
  const actionManager = runtime.HwpApp?.ActionManager;
  const debug =
    runtime.__HANCOM_TABLE_ACTION_DEBUG__ ??
    (runtime.__HANCOM_TABLE_ACTION_DEBUG__ = {
      installed: false,
      muted: false,
      logs: []
    });
  const methods: HookableMethod[] = ["PPt", "LPt", "OnIsEnabled", "fPt", "cPt", "dPt"];
  const availableMethods = methods.filter((method) => typeof actionManager?.[method] === "function");

  if (!actionManager || debug.installed) {
    return {
      installed: false,
      availableMethods
    };
  }

  const readCommandId = (value: unknown): number | string | null => {
    if (typeof value === "number" || typeof value === "string") {
      return value;
    }

    return null;
  };
  const readTupleCommandId = (value: unknown): number | null => {
    if (!value || typeof value !== "object") {
      return null;
    }

    return typeof (value as DirectActionTuple).Cre === "number" ? (value as DirectActionTuple).Cre : null;
  };
  const readBagKeyCount = (value: unknown): number => {
    if (!value || typeof value !== "object") {
      return 0;
    }

    const propertyBag = value as DirectPropertyBag;
    if (propertyBag.kHt && typeof propertyBag.kHt === "object") {
      return Object.keys(propertyBag.kHt).length;
    }

    return Object.keys(value as Record<string, unknown>).length;
  };

  for (const method of methods) {
    const original = actionManager[method];
    if (typeof original !== "function") {
      continue;
    }

    actionManager[method] = function patchedActionManagerMethod(this: unknown, ...args: unknown[]): unknown {
      if (!debug.muted) {
        debug.logs.push({
          method,
          commandId: readCommandId(args[0]),
          tupleCommandId: readTupleCommandId(args[0]),
          bagKeyCount: readBagKeyCount(args[1]),
          timestamp: Date.now()
        });
      }

      return original.apply(this, args);
    };
  }

  debug.installed = true;
  return {
    installed: true,
    availableMethods
  };
}

function pageReadTableProbeSnapshot(
  step: string,
  sinceLogIndex: number,
  currentCell: unknown | null
): ProbeSnapshot {
  const tableCommandIds = [35456, 35473, 35474, 35477] as const;
  type DirectCommandState = {
    enable?: boolean;
    update?: boolean;
  };
  type DirectActionManager = {
    LPt?: (commandId: number, cti: unknown) => DirectCommandState | null | undefined;
    OnIsEnabled?: (commandId: number, cti: unknown) => unknown;
  };
  type DebugState = {
    muted: boolean;
    logs: ProbeHookLog[];
  };
  type RuntimeGlobal = typeof globalThis & {
    HwpApp?: {
      ActionManager?: DirectActionManager;
      document?: {
        aPt?: () => {
          W8e?: () => boolean;
          yJn?: () => {
            COe?: () => number;
          };
        };
        Evr?: {
          wVs?: {
            vqs?: Array<{
              cmd?: unknown;
              type?: unknown;
              value?: {
                t?: unknown;
                cs?: unknown;
              };
            }>;
          };
        };
      };
      hwpCaret?: {
        AMe?: {
          Cni?: {
            type?: unknown;
          };
          Eni?: {
            Aoi?: unknown;
          };
        };
        uIs?: {
          b8t?: unknown;
        };
      };
    };
    __HANCOM_TABLE_ACTION_DEBUG__?: DebugState;
  };

  const runtime = globalThis as RuntimeGlobal;
  const app = runtime.HwpApp;
  const cti = app?.document?.aPt?.();
  const actionManager = app?.ActionManager;
  const debug = runtime.__HANCOM_TABLE_ACTION_DEBUG__;

  const readCommandState = (commandId: number): { commandId: number; enabled: boolean | null; update: boolean | null } => {
    let enabled: boolean | null = null;
    let update: boolean | null = null;

    if (debug) {
      debug.muted = true;
    }

    try {
      if (typeof actionManager?.OnIsEnabled === "function" && cti) {
        enabled = Boolean(actionManager.OnIsEnabled(commandId, cti));
      }
      if (typeof actionManager?.LPt === "function" && cti) {
        const state = actionManager.LPt(commandId, cti);
        if (state && typeof state.update === "boolean") {
          update = state.update;
        }
      }
    } finally {
      if (debug) {
        debug.muted = false;
      }
    }

    return { commandId, enabled, update };
  };

  const queueEntries = app?.document?.Evr?.wVs?.vqs;
  const lastQueue = Array.isArray(queueEntries) && queueEntries.length > 0 ? queueEntries.at(-1) : null;
  const newLogs = debug?.logs.slice(sinceLogIndex) ?? [];

  return {
    step,
    title: document.title,
    url: location.href,
    currentCell,
    selection: {
      selectedCellCount: document.querySelectorAll(".hcwo_selected_cell").length,
      selectedMultiCount: document.querySelectorAll(".hcwo_selected_multi").length
    },
    commands: tableCommandIds.map((commandId) => readCommandState(commandId)),
    editorState: {
      viewWritable: typeof cti?.W8e === "function" ? Boolean(cti.W8e()) : null,
      selectionMode: typeof cti?.yJn?.()?.COe === "function" ? cti.yJn().COe() : null,
      caretNodeId: typeof app?.hwpCaret?.AMe?.Eni?.Aoi === "string" ? app.hwpCaret.AMe.Eni.Aoi : null,
      caretPositionType:
        typeof app?.hwpCaret?.AMe?.Cni?.type === "number" ? app.hwpCaret.AMe.Cni.type : null,
      currentPageNumber: typeof app?.hwpCaret?.uIs?.b8t === "number" ? app.hwpCaret.uIs.b8t : null
    },
    queue:
      lastQueue && typeof lastQueue === "object"
        ? {
            cmd: typeof lastQueue.cmd === "string" ? lastQueue.cmd : null,
            type: typeof lastQueue.type === "number" ? lastQueue.type : null,
            text: typeof lastQueue.value?.t === "string" ? lastQueue.value.t : null,
            charShapeId:
              typeof lastQueue.value?.cs === "string" || typeof lastQueue.value?.cs === "number"
                ? lastQueue.value.cs
                : null
          }
        : null,
    hook: {
      totalLogCount: debug?.logs.length ?? 0,
      nextLogIndex: debug?.logs.length ?? sinceLogIndex,
      newLogs
    }
  };
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
