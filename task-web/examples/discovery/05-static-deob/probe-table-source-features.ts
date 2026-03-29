// Repro:
// npx tsx examples/discovery/05-static-deob/probe-table-source-features.ts --port 9333 --target-id <id>
//
// This probe exercises source-derived table interaction candidates against a live editor:
// - keyboard candidates: F5, arrows, Shift+arrows, Enter, F2, Tab, Shift+Tab
// - helper-surface discovery for setSelectCellInfo/getCellTableEl/setCellFocusAtCoordinates family

import fs from "node:fs/promises";
import path from "node:path";

import { discoverChromeTarget } from "../../../src/client/chromeDiscovery.js";
import { CdpSession } from "../../../src/client/CdpSession.js";
import { serializePageFunctionCall } from "../../../src/hancom/evaluation.js";
import { pageReadCurrentTableCellState } from "../../../src/hancom/pageFunctions.js";
import { parseExampleCliOptions } from "../../_cli.js";

type ProbeStep =
  | "f5"
  | "enter"
  | "f2"
  | "tab"
  | "shift-tab"
  | "left"
  | "right"
  | "up"
  | "down"
  | "shift-left"
  | "shift-right"
  | "shift-up"
  | "shift-down";

interface ProbeSequence {
  name: string;
  steps: ProbeStep[];
}

interface ProbeSnapshot {
  selection: {
    selectedCellCount: number;
    selectedMultiCount: number;
  };
  currentCell: unknown | null;
  queue: {
    cmd: string | null;
    type: number | null;
    text: string | null;
  } | null;
  editorState: {
    activeTag: string | null;
    activeId: string | null;
  };
  commands: Array<{
    id: number;
    enabled: boolean | null;
    update: boolean | null;
    replayOk: boolean | null;
  }>;
}

interface HelperSurfaceReport {
  scanned: number;
  matches: Array<{
    path: string;
    keys: string[];
  }>;
}

const DEFAULT_SEQUENCES: ProbeSequence[] = [
  { name: "baseline", steps: [] },
  { name: "f5", steps: ["f5"] },
  { name: "f5-right", steps: ["f5", "right"] },
  { name: "f5-left", steps: ["f5", "left"] },
  { name: "f5-down", steps: ["f5", "down"] },
  { name: "f5-up", steps: ["f5", "up"] },
  { name: "f5-shift-right", steps: ["f5", "shift-right"] },
  { name: "f5-shift-down", steps: ["f5", "shift-down"] },
  { name: "enter", steps: ["enter"] },
  { name: "f2", steps: ["f2"] },
  { name: "tab", steps: ["tab"] },
  { name: "shift-tab", steps: ["shift-tab"] }
];

async function main(): Promise<void> {
  const { connectionOptions, positionals } = parseExampleCliOptions(process.argv.slice(2));
  const target = await discoverChromeTarget(connectionOptions);
  const artifactRoot =
    positionals[0] ??
    path.join(
      "tmp/discovery/05-static-deob",
      `table-source-features-${new Date().toISOString().replace(/[:.]/g, "-")}-${target.id.slice(0, 8)}`
    );

  await fs.mkdir(artifactRoot, { recursive: true });

  const shortcutMatrix = await runShortcutMatrix(target.webSocketDebuggerUrl);
  const helperSurface = await runHelperSurfaceScan(target.webSocketDebuggerUrl);

  const artifactPath = path.join(artifactRoot, "table-source-features.json");
  await fs.writeFile(
    artifactPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        targetId: target.id,
        targetTitle: target.title,
        targetUrl: target.url,
        clickPoint: { x: 220, y: 520 },
        shortcutMatrix,
        helperSurface
      },
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      {
        artifactPath,
        sequenceSummary: shortcutMatrix.map((entry) => ({
          name: entry.name,
          steps: entry.steps,
          beforeSelection: entry.before.selection,
          afterSelection: entry.after.selection,
          enabledCommandsAfter: entry.after.commands.filter((command) => command.enabled).map((command) => command.id),
          currentCellAfter:
            entry.after.currentCell && typeof entry.after.currentCell === "object"
              ? {
                  id: readRecordString(entry.after.currentCell, "id"),
                  text: readRecordString(entry.after.currentCell, "text")
                }
              : null,
          queueAfter: entry.after.queue
        })),
        helperSurface
      },
      null,
      2
    )
  );
}

async function runShortcutMatrix(
  webSocketDebuggerUrl: string
): Promise<Array<{ name: string; steps: ProbeStep[]; before: ProbeSnapshot; after: ProbeSnapshot }>> {
  const results: Array<{ name: string; steps: ProbeStep[]; before: ProbeSnapshot; after: ProbeSnapshot }> = [];

  for (const sequence of DEFAULT_SEQUENCES) {
    const session = new CdpSession();
    await session.connect(webSocketDebuggerUrl);

    try {
      await clickEditorPoint(session, { x: 220, y: 520 });
      await wait(180);
      const before = await readProbeSnapshot(session);

      for (const step of sequence.steps) {
        await dispatchProbeStep(session, step);
        await wait(180);
      }

      const after = await readProbeSnapshot(session);
      results.push({
        name: sequence.name,
        steps: sequence.steps,
        before,
        after
      });

      if (sequence.steps.includes("tab") || sequence.steps.includes("shift-tab")) {
        await revertPotentialTabMutation(session);
      }
    } finally {
      await session.close();
    }
  }

  return results;
}

async function runHelperSurfaceScan(webSocketDebuggerUrl: string): Promise<HelperSurfaceReport> {
  const session = new CdpSession();
  await session.connect(webSocketDebuggerUrl);

  try {
    return await session.evaluate<HelperSurfaceReport>(`(() => {
      const targetKeys = [
        "getCellTableEl",
        "setSelectCellInfo",
        "getSelectCellInfo",
        "setSelectCell",
        "getSelectedCellElement",
        "setCellFocusAtCoordinates",
        "setFocusCellInfo",
        "toggleChartEditButtons"
      ];
      const seen = new WeakSet();
      const queue = [
        { path: "globalThis", value: globalThis },
        { path: "globalThis.HwpApp", value: globalThis.HwpApp ?? null }
      ];
      const matches = [];
      let scanned = 0;

      while (queue.length > 0 && scanned < 25_000) {
        const item = queue.shift();
        const value = item?.value;
        if (!value || (typeof value !== "object" && typeof value !== "function")) {
          continue;
        }
        if (seen.has(value)) {
          continue;
        }
        seen.add(value);
        scanned += 1;

        let ownKeys = [];
        try {
          ownKeys = Object.keys(value);
        } catch {
          ownKeys = [];
        }

        const hit = targetKeys.filter((key) => ownKeys.includes(key) && typeof value[key] === "function");
        if (hit.length > 0) {
          matches.push({
            path: item?.path ?? "<unknown>",
            keys: hit
          });
        }

        for (const key of ownKeys.slice(0, 80)) {
          let nextValue;
          try {
            nextValue = value[key];
          } catch {
            continue;
          }
          if (nextValue && (typeof nextValue === "object" || typeof nextValue === "function")) {
            queue.push({
              path: \`\${item?.path ?? "<unknown>"}.\${key}\`,
              value: nextValue
            });
          }
        }
      }

      return {
        scanned,
        matches
      };
    })()`);
  } finally {
    await session.close();
  }
}

async function readProbeSnapshot(session: CdpSession): Promise<ProbeSnapshot> {
  const currentCell = await session.evaluate<unknown | null>(
    serializePageFunctionCall(pageReadCurrentTableCellState)
  );
  const currentCellLiteral = JSON.stringify(currentCell);

  return await session.evaluate<ProbeSnapshot>(`(() => {
    const app = globalThis.HwpApp;
    const cti = app?.document?.aPt?.();
    const commandIds = [35470, 35471, 35472, 35473, 35474, 35475, 35476, 35477];
    const lastQueue = Array.isArray(app?.document?.Evr?.wVs?.vqs) && app.document.Evr.wVs.vqs.length > 0
      ? app.document.Evr.wVs.vqs.at(-1)
      : null;
    const commands = commandIds.map((id) => {
      const enabled = typeof app?.ActionManager?.OnIsEnabled === "function" && cti
        ? Boolean(app.ActionManager.OnIsEnabled(id, cti))
        : null;
      const state = typeof app?.ActionManager?.LPt === "function" && cti
        ? app.ActionManager.LPt(id, cti)
        : null;
      const replayOk = typeof app?.ActionManager?.PPt === "function" && cti && enabled === false
        ? Boolean(app.ActionManager.PPt(id, cti))
        : null;
      return {
        id,
        enabled,
        update: state && typeof state.update === "boolean" ? state.update : null,
        replayOk
      };
    });

    return {
      selection: {
        selectedCellCount: document.querySelectorAll(".hcwo_selected_cell").length,
        selectedMultiCount: document.querySelectorAll(".hcwo_selected_multi").length
      },
      currentCell: ${currentCellLiteral},
      queue:
        lastQueue && typeof lastQueue === "object"
          ? {
              cmd: typeof lastQueue.cmd === "string" ? lastQueue.cmd : null,
              type: typeof lastQueue.type === "number" ? lastQueue.type : null,
              text: typeof lastQueue.value?.t === "string" ? lastQueue.value.t : null
            }
          : null,
      editorState: {
        activeTag: document.activeElement?.tagName ?? null,
        activeId: document.activeElement?.id ?? null
      },
      commands
    };
  })()`);
}

async function dispatchProbeStep(session: CdpSession, step: ProbeStep): Promise<void> {
  switch (step) {
    case "f5":
      await dispatchKey(session, "F5", "F5", 116);
      return;
    case "enter":
      await dispatchKey(session, "Enter", "Enter", 13);
      return;
    case "f2":
      await dispatchKey(session, "F2", "F2", 113);
      return;
    case "tab":
      await dispatchKey(session, "Tab", "Tab", 9);
      return;
    case "shift-tab":
      await dispatchKey(session, "Tab", "Tab", 9, 8);
      return;
    case "left":
      await dispatchKey(session, "ArrowLeft", "ArrowLeft", 37);
      return;
    case "right":
      await dispatchKey(session, "ArrowRight", "ArrowRight", 39);
      return;
    case "up":
      await dispatchKey(session, "ArrowUp", "ArrowUp", 38);
      return;
    case "down":
      await dispatchKey(session, "ArrowDown", "ArrowDown", 40);
      return;
    case "shift-left":
      await dispatchKey(session, "ArrowLeft", "ArrowLeft", 37, 8);
      return;
    case "shift-right":
      await dispatchKey(session, "ArrowRight", "ArrowRight", 39, 8);
      return;
    case "shift-up":
      await dispatchKey(session, "ArrowUp", "ArrowUp", 38, 8);
      return;
    case "shift-down":
      await dispatchKey(session, "ArrowDown", "ArrowDown", 40, 8);
      return;
  }
}

async function dispatchKey(
  session: CdpSession,
  key: string,
  code: string,
  windowsVirtualKeyCode: number,
  modifiers = 0
): Promise<void> {
  await session.bringToFront();

  if ((modifiers & 8) !== 0) {
    await session.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "Shift",
      code: "ShiftLeft",
      windowsVirtualKeyCode: 16,
      nativeVirtualKeyCode: 16
    });
  }

  await session.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key,
    code,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode: windowsVirtualKeyCode,
    ...(modifiers === 0 ? {} : { modifiers })
  });
  await session.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode: windowsVirtualKeyCode,
    ...(modifiers === 0 ? {} : { modifiers })
  });

  if ((modifiers & 8) !== 0) {
    await session.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Shift",
      code: "ShiftLeft",
      windowsVirtualKeyCode: 16,
      nativeVirtualKeyCode: 16
    });
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

async function revertPotentialTabMutation(session: CdpSession): Promise<void> {
  const platform = await session.evaluate<string>("navigator.platform");
  const modifier = platform.toLocaleLowerCase().includes("mac") ? "Meta" : "Control";
  await session.pressShortcut("z", modifier);
  await wait(120);
}

async function wait(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readRecordString(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return typeof record[key] === "string" ? record[key] : null;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
