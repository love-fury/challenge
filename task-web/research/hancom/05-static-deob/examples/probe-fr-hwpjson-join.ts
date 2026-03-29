// Repro:
// npx tsx research/hancom/05-static-deob/examples/probe-fr-hwpjson-join.ts --port 9333

import fs from "node:fs/promises";
import path from "node:path";

import { discoverChromeTarget } from "../../../../src/client/chromeDiscovery.js";
import { CdpSession } from "../../../../src/client/CdpSession.js";
import type {
  HwpJson20ControlPayload,
  HwpJson20DocumentSnapshot,
  HwpJson20ParagraphRecord
} from "../../../../src/models/types.js";
import { parseHwpJson20Document } from "../../../../src/hancom/hwpJson20.js";
import {
  collectFrTableBlocks,
  parseFrLineExport
} from "../src/frLineExport.js";
import { parseExampleCliOptions } from "../../../../examples/_cli.js";

const CONTROL_TOKEN_PATTERN = /<([0-9A-Fa-f]{2})\/([0-9A-Fa-f]{8})\/([A-Za-z0-9]+)>/g;

interface RuntimeJoinProbePayload {
  title: string;
  url: string;
  hwpjson20: HwpJson20DocumentSnapshot | null;
  fr: string | null;
}

async function main(): Promise<void> {
  const { connectionOptions, positionals } = parseExampleCliOptions(process.argv.slice(2));
  const target = await discoverChromeTarget(connectionOptions);
  const session = new CdpSession();
  await session.connect(target.webSocketDebuggerUrl);

  try {
    const payload = await session.evaluate<RuntimeJoinProbePayload>(`(() => {
      const app = window.HwpApp;
      const serializer = app?.document?.aPt?.()?.ENt?.();
      return {
        title: document.title,
        url: location.href,
        hwpjson20:
          typeof serializer?.save === "function" ? serializer.save("hwpjson20;") : null,
        fr:
          typeof app?.document?.F_r === "function"
            ? app.document.F_r("object:1;clientinfo:1;emptypara:0")
            : null
      };
    })()`);

    const artifactRoot =
      positionals[0] ??
      path.join(
        "tmp/discovery/05-static-deob",
        `fr-hwpjson-join-${new Date().toISOString().replace(/[:.]/g, "-")}-${target.id.slice(0, 8)}`
      );

    await fs.mkdir(artifactRoot, { recursive: true });

    const snapshotPath = path.join(artifactRoot, "hwpjson20-snapshot.json");
    const frPath = path.join(artifactRoot, "fr-lines.txt");
    const summaryPath = path.join(artifactRoot, "summary.json");

    const summary = buildSummary(payload, target.id);

    await fs.writeFile(snapshotPath, JSON.stringify(payload.hwpjson20, null, 2));
    await fs.writeFile(frPath, payload.fr ?? "");
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

    console.log(
      JSON.stringify(
        {
          artifactRoot,
          snapshotPath,
          frPath,
          summaryPath,
          hwpjson20: summary.hwpjson20,
          fr: {
            lineCount: summary.fr.lineCount,
            tableCount: summary.fr.tableCount,
            preview: summary.fr.preview.slice(0, 5)
          },
          imageControlCount: summary.imageControls.length,
          tableControlCount: summary.tableControls.length
        },
        null,
        2
      )
    );
  } finally {
    await session.close();
  }
}

function buildSummary(
  payload: RuntimeJoinProbePayload,
  targetId: string
): {
  generatedAt: string;
  targetId: string;
  title: string;
  url: string;
  hwpjson20: {
    roCount: number;
    csCount: number;
    blockCount: number;
    paragraphBlockCount: number;
    tableBlockCount: number;
    imageBlockCount: number;
    warnings: string[];
  } | null;
  fr: {
    lineCount: number;
    preview: ReturnType<typeof parseFrLineExport>;
    tableCount: number;
    tables: ReturnType<typeof collectFrTableBlocks>;
  };
  paragraphTokenSummary: Array<{
    recordId: string;
    textPreview: string | null;
    controlTokens: Array<{
      marker: string;
      signatureHex: string;
      objectId: string;
      raw: string;
    }>;
  }>;
  imageControls: Array<{
    controlId: string;
    assetId: string | null;
    keys: string[];
  }>;
  tableControls: Array<{
    controlId: string;
    rowCount: number;
    cellCount: number;
    keys: string[];
  }>;
} {
  const snapshot = payload.hwpjson20;
  const frLines = parseFrLineExport(payload.fr ?? "");
  const frTables = collectFrTableBlocks(frLines);
  const parsedDocument = snapshot === null ? null : parseHwpJson20Document(snapshot);
  const paragraphRecords = normalizeIndexedCollection<HwpJson20ParagraphRecord>(snapshot?.ro);
  const controlMap = normalizeIndexedCollection<HwpJson20ControlPayload>(snapshot?.cs);
  const paragraphTokenSummary = Object.entries(paragraphRecords).map(([recordId, record]) => ({
    recordId,
    textPreview: typeof record.tx === "string" ? record.tx.slice(0, 160) : null,
    controlTokens: readControlTokens(typeof record.tx === "string" ? record.tx : "")
  }));
  const imageControls = Object.entries(controlMap)
    .filter(([, control]) => readImageAssetId(control) !== null)
    .map(([controlId, control]) => ({
      controlId,
      assetId: readImageAssetId(control),
      keys: Object.keys(control).slice(0, 20)
    }));
  const tableControls = Object.entries(controlMap)
    .filter(([, control]) => Array.isArray(control.tr) || isRecord(control.ch))
    .map(([controlId, control]) => ({
      controlId,
      rowCount: Array.isArray(control.tr) ? control.tr.length : 0,
      cellCount: readCellCount(control.ch),
      keys: Object.keys(control).slice(0, 20)
    }));

  return {
    generatedAt: new Date().toISOString(),
    targetId,
    title: payload.title,
    url: payload.url,
    hwpjson20: snapshot === null
      ? null
      : {
          roCount: Object.keys(paragraphRecords).length,
          csCount: Object.keys(controlMap).length,
          blockCount: parsedDocument?.blocks.length ?? 0,
          paragraphBlockCount:
            parsedDocument?.blocks.filter((block) => block.kind === "paragraph").length ?? 0,
          tableBlockCount:
            parsedDocument?.blocks.filter((block) => block.kind === "table").length ?? 0,
          imageBlockCount:
            parsedDocument?.blocks.filter((block) => block.kind === "image").length ?? 0,
          warnings: parsedDocument?.warnings ?? []
        },
    fr: {
      lineCount: frLines.length,
      preview: frLines.slice(0, 30),
      tableCount: frTables.length,
      tables: frTables.slice(0, 20)
    },
    paragraphTokenSummary: paragraphTokenSummary
      .filter((entry) => entry.controlTokens.length > 0)
      .slice(0, 200),
    imageControls,
    tableControls
  };
}

function normalizeIndexedCollection<T>(value: Record<string, T> | T[] | undefined): Record<string, T> {
  if (value === undefined) {
    return {};
  }

  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((entry, index) => [String(index), entry]));
  }

  return value;
}

function readControlTokens(text: string): Array<{
  marker: string;
  signatureHex: string;
  objectId: string;
  raw: string;
}> {
  return Array.from(text.matchAll(CONTROL_TOKEN_PATTERN)).map((match) => ({
    marker: match[1] ?? "",
    signatureHex: match[2] ?? "",
    objectId: match[3] ?? "",
    raw: match[0]
  }));
}

function readImageAssetId(control: HwpJson20ControlPayload): string | null {
  const nestedAssetId = control.rc?.img?.bi;
  if (typeof nestedAssetId === "string") {
    return nestedAssetId;
  }

  const directAssetId = control.img?.bi;
  return typeof directAssetId === "string" ? directAssetId : null;
}

function readCellCount(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (isRecord(value)) {
    return Object.keys(value).length;
  }

  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
