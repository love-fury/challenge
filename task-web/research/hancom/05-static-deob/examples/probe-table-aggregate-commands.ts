// Repro:
// npx tsx research/hancom/05-static-deob/examples/probe-table-aggregate-commands.ts --port 9333 --target-id <id>
//
// This probe exercises source-derived aggregate table row commands against a live editor:
// - create a 2x2 table through the SDK
// - execute aggregate insert-row bag command (35470) with source-derived row direction values
// - execute aggregate delete-row bag command (35475) with source-derived delete-kind value
// - snapshot small tables before/after because the inserted table can become nested in the current cell context

import fs from "node:fs/promises";
import path from "node:path";

import { discoverChromeTarget } from "../../../../src/client/chromeDiscovery.js";
import { CdpSession } from "../../../../src/client/CdpSession.js";
import { HancomDocsClient } from "../../../../src/index.js";
import { serializePageFunctionCall } from "../../../../src/hancom/evaluation.js";
import {
  pageExecuteDirectPropertyBagCommand,
  pageReadDirectCommandState,
  type DirectCommandStateSnapshot,
  type WriteReplayResult
} from "../../../../src/hancom/pageWriteFunctions.js";
import type { HancomDocument, TableBlock } from "../../../../src/models/types.js";
import { parseExampleCliOptions } from "../../../../examples/_cli.js";

interface SmallTableSnapshot {
  index: number;
  rows: number;
  cols: number;
  cells: string[];
}

interface AggregateProbeArtifact {
  generatedAt: string;
  targetId: string;
  targetTitle: string;
  targetUrl: string;
  commandStates: {
    insertAggregate: DirectCommandStateSnapshot;
    deleteAggregate: DirectCommandStateSnapshot;
    deleteRow: DirectCommandStateSnapshot;
  };
  beforeTables: SmallTableSnapshot[];
  insertTable: {
    rows: number;
    cols: number;
  };
  afterCreateTables: SmallTableSnapshot[];
  insertAbove: WriteReplayResult;
  afterInsertAboveTables: SmallTableSnapshot[];
  insertBelow: WriteReplayResult;
  afterInsertBelowTables: SmallTableSnapshot[];
  deleteRow: WriteReplayResult;
  afterDeleteTables: SmallTableSnapshot[];
}

async function main(): Promise<void> {
  const { connectionOptions, positionals } = parseExampleCliOptions(process.argv.slice(2));
  const target = await discoverChromeTarget(connectionOptions);
  const artifactRoot =
    positionals[0] ??
    path.join(
      "tmp/discovery/05-static-deob",
      `table-aggregate-commands-${new Date().toISOString().replace(/[:.]/g, "-")}-${target.id.slice(0, 8)}`
    );
  await fs.mkdir(artifactRoot, { recursive: true });

  const client = await HancomDocsClient.connect(connectionOptions);
  const session = new CdpSession();
  await session.connect(target.webSocketDebuggerUrl);

  try {
    const commandStates = {
      insertAggregate: await session.evaluate<DirectCommandStateSnapshot>(
        serializePageFunctionCall(pageReadDirectCommandState, 35470)
      ),
      deleteAggregate: await session.evaluate<DirectCommandStateSnapshot>(
        serializePageFunctionCall(pageReadDirectCommandState, 35475)
      ),
      deleteRow: await session.evaluate<DirectCommandStateSnapshot>(
        serializePageFunctionCall(pageReadDirectCommandState, 35477)
      )
    };

    const beforeTables = summarizeSmallTables(await client.readDocument());
    const insertTable = await client.insertTable({ rows: 2, cols: 2 });
    const afterCreateTables = summarizeSmallTables(await client.readDocument());

    const insertAbove = await session.evaluate<WriteReplayResult>(
      serializePageFunctionCall(pageExecuteDirectPropertyBagCommand, 35470, {
        16384: 2,
        16385: 1
      })
    );
    const afterInsertAboveTables = summarizeSmallTables(await client.readDocument());

    const insertBelow = await session.evaluate<WriteReplayResult>(
      serializePageFunctionCall(pageExecuteDirectPropertyBagCommand, 35470, {
        16384: 3,
        16385: 1
      })
    );
    const afterInsertBelowTables = summarizeSmallTables(await client.readDocument());

    const deleteRow = await session.evaluate<WriteReplayResult>(
      serializePageFunctionCall(pageExecuteDirectPropertyBagCommand, 35475, {
        16384: 1
      })
    );
    const afterDeleteTables = summarizeSmallTables(await client.readDocument());

    const artifact: AggregateProbeArtifact = {
      generatedAt: new Date().toISOString(),
      targetId: target.id,
      targetTitle: target.title,
      targetUrl: target.url,
      commandStates,
      beforeTables,
      insertTable,
      afterCreateTables,
      insertAbove,
      afterInsertAboveTables,
      insertBelow,
      afterInsertBelowTables,
      deleteRow,
      afterDeleteTables
    };

    const artifactPath = path.join(artifactRoot, "table-aggregate-commands.json");
    await fs.writeFile(artifactPath, JSON.stringify(artifact, null, 2));

    console.log(
      JSON.stringify(
        {
          artifactPath,
          commandStates,
          insertTable,
          insertAbove,
          insertBelow,
          deleteRow
        },
        null,
        2
      )
    );
  } finally {
    await session.close();
    await client.disconnect();
  }
}

function summarizeSmallTables(document: HancomDocument): SmallTableSnapshot[] {
  return document.blocks
    .map((block, index) => {
      if (block.kind !== "table") {
        return null;
      }
      return summarizeTable(index, block);
    })
    .filter((block): block is SmallTableSnapshot => block !== null)
    .filter((table) => table.rows <= 4 && table.cols <= 4);
}

function summarizeTable(index: number, table: TableBlock): SmallTableSnapshot {
  return {
    index,
    rows: table.rows.length,
    cols: Math.max(0, ...table.rows.map((row) => row.cells.length)),
    cells: table.rows.map((row) =>
      row.cells
        .map((cell) =>
          cell.blocks
            .map((block) => (block.kind === "paragraph" ? block.text : `[${block.kind}]`))
            .join("|")
        )
        .join(" || ")
    )
  };
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
