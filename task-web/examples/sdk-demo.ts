import { HancomDocsClient, type CaretTarget, type ParagraphLocator } from "../src/index.js";
import { parseExampleCliOptions } from "./_cli.js";

async function main(): Promise<void> {
  const { connectionOptions, positionals } = parseExampleCliOptions(process.argv.slice(2));
  const [command, ...args] = positionals;
  if (!command) {
    throw new Error(usage());
  }

  const client = await HancomDocsClient.connect(connectionOptions);

  try {
    switch (command) {
      case "read":
        await runReadCommand(client, args);
        return;
      case "search":
        printJson(
          await client.search(requireArg(args[0], "query"), {
            ...(args[1] === undefined ? {} : { contextWindow: parseIntegerArg(args[1], "contextWindow") })
          })
        );
        return;
      case "caret":
        await runCaretCommand(client, args);
        return;
      case "type":
        await client.typeText(requireArg(args[0], "text"));
        return;
      case "replace":
        printJson(
          await client.replaceAll({
            find: requireArg(args[0], "find"),
            replace: requireArg(args[1], "replace")
          })
        );
        return;
      case "insert-table":
        printJson(
          await client.insertTable({
            rows: parseIntegerArg(args[0], "rows"),
            cols: parseIntegerArg(args[1], "cols")
          })
        );
        return;
      case "fill-table":
        printJson(
          await client.fillTableCells({
            values: parseTableMatrix(requireArg(args[0], "matrix"))
          })
        );
        return;
      case "table-smoke":
        printJson(await runTableSmokeCommand(client, args));
        return;
      case "save":
        printJson(await client.save());
        return;
      case "goto-page":
        printJson(await client.gotoPage(parseIntegerArg(args[0], "pageNumber")));
        return;
      case "insert-image":
        printJson(
          await client.insertImage({
            path: requireArg(args[0], "path")
          })
        );
        return;
      case "insert-row":
        printJson(
          await client.insertTableRow({
            position: parseRowInsertPosition(args[0]),
            ...(args[1] === undefined ? {} : { count: parseIntegerArg(args[1], "count") })
          })
        );
        return;
      case "delete-row":
        printJson(
          await client.deleteTableRow({
            ...(args[0] === undefined ? {} : { count: parseIntegerArg(args[0], "count") })
          })
        );
        return;
      default:
        throw new Error(usage());
    }
  } finally {
    await client.disconnect();
  }
}

async function runReadCommand(
  client: HancomDocsClient,
  args: string[]
): Promise<void> {
  const [subcommand, value] = args;

  switch (subcommand) {
    case "text":
      console.log(await client.readText());
      return;
    case "document":
      printJson(await client.readDocument());
      return;
    case "structure":
      printJson(await client.readStructure());
      return;
    case "formatting":
      printJson(await client.getParagraphFormatting(parseParagraphLocator(value)));
      return;
    default:
      throw new Error(usage());
  }
}

async function runCaretCommand(
  client: HancomDocsClient,
  args: string[]
): Promise<void> {
  const [subcommand, ...rest] = args;

  if (subcommand === "where") {
    printJson(await client.getCaretPosition());
    return;
  }

  if (subcommand !== "move") {
    throw new Error(usage());
  }

  printJson(await client.moveCaret(parseCaretTarget(rest)));
}

async function runTableSmokeCommand(
  client: HancomDocsClient,
  args: string[]
): Promise<unknown> {
  const matrix = parseTableMatrix(args[0] ?? "A1,B1;A2,B2");
  const position = args[1] === undefined ? "below" : parseRowInsertPosition(args[1]);
  const insertCount = args[2] === undefined ? 1 : parseIntegerArg(args[2], "insertCount");
  const deleteCount = args[3] === undefined ? 1 : parseIntegerArg(args[3], "deleteCount");
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;

  if (rows === 0 || cols === 0) {
    throw new Error("table-smoke requires a non-empty matrix.");
  }

  return {
    insertTable: await client.insertTable({ rows, cols }),
    fillTable: await client.fillTableCells({ values: matrix }),
    insertRow: await client.insertTableRow({ position, count: insertCount }),
    deleteRow: await client.deleteTableRow({ count: deleteCount })
  };
}

function parseParagraphLocator(value: string | undefined): ParagraphLocator {
  const locator = requireArg(value, "paragraph");
  const parsed = Number.parseInt(locator, 10);
  return Number.isNaN(parsed) ? locator : parsed;
}

function parseRowInsertPosition(value: string | undefined): "above" | "below" {
  const position = requireArg(value, "position");
  if (position !== "above" && position !== "below") {
    throw new Error(`Invalid position: ${position}\n\n${usage()}`);
  }
  return position;
}

function parseCaretTarget(args: string[]): CaretTarget {
  const [kind, a, b, c] = args;

  switch (kind) {
    case "document-start":
      return { kind };
    case "document-end":
      return { kind };
    case "paragraph":
      return {
        kind,
        paragraph: parseParagraphLocator(a),
        ...(b === undefined ? {} : { offset: parseIntegerArg(b, "offset") })
      };
    case "run":
      return {
        kind,
        paragraph: parseParagraphLocator(a),
        run: parseIntegerArg(b, "run"),
        ...(c === undefined ? {} : { offset: parseIntegerArg(c, "offset") })
      };
    case "page-start":
      return {
        kind,
        pageNumber: parseIntegerArg(a, "pageNumber")
      };
    case "page-end":
      return {
        kind,
        pageNumber: parseIntegerArg(a, "pageNumber")
      };
    default:
      throw new Error(usage());
  }
}

function parseTableMatrix(input: string): string[][] {
  return input.split(";").map((row) => row.split(","));
}

function parseIntegerArg(value: string | undefined, name: string): number {
  const raw = requireArg(value, name);
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${name}: ${raw}`);
  }
  return parsed;
}

function requireArg(value: string | undefined, name: string): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing ${name}.\n\n${usage()}`);
  }
  return value;
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function usage(): string {
  return [
    "Usage:",
    "  tsx examples/sdk-demo.ts [connection options] read text",
    "  tsx examples/sdk-demo.ts [connection options] read document",
    "  tsx examples/sdk-demo.ts [connection options] read structure",
    "  tsx examples/sdk-demo.ts [connection options] read formatting <paragraph>",
    "  tsx examples/sdk-demo.ts [connection options] search <query> [contextWindow]",
    "  tsx examples/sdk-demo.ts [connection options] caret where",
    "  tsx examples/sdk-demo.ts [connection options] caret move document-start",
    "  tsx examples/sdk-demo.ts [connection options] caret move paragraph <paragraph> [offset]",
    "  tsx examples/sdk-demo.ts [connection options] type <text>",
    "  tsx examples/sdk-demo.ts [connection options] replace <find> <replace>",
    "  tsx examples/sdk-demo.ts [connection options] insert-table <rows> <cols>",
    "  tsx examples/sdk-demo.ts [connection options] fill-table <row1col1,row1col2;row2col1,row2col2>",
    "    create the table first, then populate cells with fill-table",
    "  tsx examples/sdk-demo.ts [connection options] table-smoke [matrix] [above|below] [insertCount] [deleteCount]",
    "  tsx examples/sdk-demo.ts [connection options] save",
    "  tsx examples/sdk-demo.ts [connection options] goto-page <pageNumber>",
    "  tsx examples/sdk-demo.ts [connection options] insert-image <path>",
    "  tsx examples/sdk-demo.ts [connection options] insert-row <above|below> [count]",
    "  tsx examples/sdk-demo.ts [connection options] delete-row [count]"
  ].join("\n");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
