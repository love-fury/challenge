export type FrHeadingType = "outline" | "para" | "charbullet" | "imgbullet";

export interface ParsedFrHeading {
  type: FrHeadingType;
  id: number;
  level?: number;
  char?: string;
}

export interface ParsedFrTableRef {
  kind: "table";
  name: string;
  rowAddr: number;
  colAddr: number;
  parentCellPos?: string;
}

export interface ParsedFrTextboxRef {
  kind: "textbox";
  name: string;
}

export type ParsedFrParentRef = ParsedFrTableRef | ParsedFrTextboxRef;

export interface ParsedFrLine {
  raw: string;
  listId: number;
  paraId: number;
  styleName?: string;
  heading?: ParsedFrHeading;
  parentRef?: ParsedFrParentRef;
  text: string;
}

export interface ParsedFrTableCellContent {
  rowAddr: number;
  colAddr: number;
  paragraphs: ParsedFrLine[];
}

export interface ParsedFrTableBlock {
  name: string;
  rowAddrs: number[];
  colAddrs: number[];
  cells: ParsedFrTableCellContent[];
}

const FR_LINE_PATTERN = /^<\$p(\d+):(\d+)((?:;[^$>]+)*)\$>(.*)$/u;

export function parseFrLineExport(input: string): ParsedFrLine[] {
  return input
    .split("\n")
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const parsed = parseFrLine(line);
      return parsed === null ? [] : [parsed];
    });
}

export function parseFrLine(line: string): ParsedFrLine | null {
  const base = parseFrLineBase(line);
  if (base === null) {
    return null;
  }

  const parsed = base.parsed;
  const suffixes = splitSuffixes(base.suffixRaw);
  let lastTablePosition: string | null = null;
  for (const suffix of suffixes) {
    lastTablePosition = applyFrSuffix(parsed, suffix, lastTablePosition);
  }

  return parsed;
}

export function collectFrTableBlocks(lines: readonly ParsedFrLine[]): ParsedFrTableBlock[] {
  const tables = new Map<string, Map<string, ParsedFrTableCellContent>>();

  for (const line of lines) {
    if (line.parentRef?.kind !== "table") {
      continue;
    }

    const table = ensureMapEntry(tables, line.parentRef.name, () => new Map<string, ParsedFrTableCellContent>());
    const cellKey = `${line.parentRef.rowAddr}:${line.parentRef.colAddr}`;
    const cell = ensureMapEntry(table, cellKey, () => ({
      rowAddr: line.parentRef?.kind === "table" ? line.parentRef.rowAddr : -1,
      colAddr: line.parentRef?.kind === "table" ? line.parentRef.colAddr : -1,
      paragraphs: []
    }));
    cell.paragraphs.push(line);
  }

  return Array.from(tables.entries())
    .map(([name, cellMap]) => {
      const cells = Array.from(cellMap.values()).sort(
        (left, right) => left.rowAddr - right.rowAddr || left.colAddr - right.colAddr
      );

      return {
        name,
        rowAddrs: uniqueSortedNumbers(cells.map((cell) => cell.rowAddr)),
        colAddrs: uniqueSortedNumbers(cells.map((cell) => cell.colAddr)),
        cells
      };
    })
    .sort((left, right) => compareGeneratedObjectNames(left.name, right.name));
}

function splitSuffixes(suffixRaw: string): string[] {
  if (suffixRaw.length === 0) {
    return [];
  }

  return suffixRaw
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parseHeadingSuffix(suffix: string): ParsedFrHeading | null {
  return parseOutlineOrParaHeading(suffix) ?? parseCharBulletHeading(suffix) ?? parseImageBulletHeading(suffix);
}

function parseTableSuffix(suffix: string): ParsedFrTableRef | null {
  const match = /^(?:(.+);)?(t\d+):(\d+):(\d+)$/u.exec(suffix);
  if (match === null) {
    return null;
  }

  const parentCellPos = match[1];
  const name = match[2];
  const rowAddrRaw = match[3];
  const colAddrRaw = match[4];
  if (name === undefined || rowAddrRaw === undefined || colAddrRaw === undefined) {
    return null;
  }

  return {
    kind: "table",
    name,
    rowAddr: Number.parseInt(rowAddrRaw, 10),
    colAddr: Number.parseInt(colAddrRaw, 10),
    ...(parentCellPos === undefined ? {} : { parentCellPos })
  };
}

function parseTextboxSuffix(suffix: string): ParsedFrTextboxRef | null {
  const match = /^(x\d+)$/u.exec(suffix);
  const name = match?.[1];
  if (name === undefined) {
    return null;
  }

  return {
    kind: "textbox",
    name
  };
}

function ensureMapEntry<TKey, TValue>(
  map: Map<TKey, TValue>,
  key: TKey,
  factory: () => TValue
): TValue {
  const existing = map.get(key);
  if (existing !== undefined) {
    return existing;
  }

  const value = factory();
  map.set(key, value);
  return value;
}

function uniqueSortedNumbers(values: readonly number[]): number[] {
  return Array.from(new Set(values)).sort((left, right) => left - right);
}

function compareGeneratedObjectNames(left: string, right: string): number {
  const leftMatch = /^[a-zA-Z]+(\d+)$/u.exec(left);
  const rightMatch = /^[a-zA-Z]+(\d+)$/u.exec(right);
  if (leftMatch === null || rightMatch === null) {
    return left.localeCompare(right);
  }

  const leftIndex = leftMatch[1];
  const rightIndex = rightMatch[1];
  if (leftIndex === undefined || rightIndex === undefined) {
    return left.localeCompare(right);
  }

  return Number.parseInt(leftIndex, 10) - Number.parseInt(rightIndex, 10);
}

function parseFrLineBase(
  line: string
): {
  parsed: ParsedFrLine;
  suffixRaw: string;
} | null {
  const match = FR_LINE_PATTERN.exec(line);
  if (match === null) {
    return null;
  }

  const listIdRaw = match[1];
  const paraIdRaw = match[2];
  const suffixRaw = match[3];
  const text = match[4];
  if (listIdRaw === undefined || paraIdRaw === undefined || suffixRaw === undefined || text === undefined) {
    return null;
  }

  return {
    parsed: {
      raw: line,
      listId: Number.parseInt(listIdRaw, 10),
      paraId: Number.parseInt(paraIdRaw, 10),
      text
    },
    suffixRaw
  };
}

function applyFrSuffix(
  parsed: ParsedFrLine,
  suffix: string,
  lastTablePosition: string | null
): string | null {
  if (suffix.startsWith("s") && suffix.length > 1) {
    parsed.styleName = suffix.slice(1);
    return lastTablePosition;
  }

  const heading = parseHeadingSuffix(suffix);
  if (heading !== null) {
    parsed.heading = heading;
    return lastTablePosition;
  }

  const tableRef = parseTableSuffix(suffix);
  if (tableRef !== null) {
    parsed.parentRef = lastTablePosition === null ? tableRef : { ...tableRef, parentCellPos: lastTablePosition };
    return `${tableRef.name}:${tableRef.rowAddr}:${tableRef.colAddr}`;
  }

  const textboxRef = parseTextboxSuffix(suffix);
  if (textboxRef !== null) {
    parsed.parentRef = textboxRef;
  }

  return lastTablePosition;
}

function parseOutlineOrParaHeading(suffix: string): ParsedFrHeading | null {
  const outlineOrPara = /^(o|h)(\d+):(\d+)$/u.exec(suffix);
  const marker = outlineOrPara?.[1];
  const idRaw = outlineOrPara?.[2];
  const levelRaw = outlineOrPara?.[3];
  if (marker === undefined || idRaw === undefined || levelRaw === undefined) {
    return null;
  }

  return {
    type: marker === "o" ? "outline" : "para",
    id: Number.parseInt(idRaw, 10),
    level: Number.parseInt(levelRaw, 10)
  };
}

function parseCharBulletHeading(suffix: string): ParsedFrHeading | null {
  const charBullet = /^b(\d+):(.*)$/u.exec(suffix);
  const idRaw = charBullet?.[1];
  const char = charBullet?.[2];
  if (idRaw === undefined || char === undefined) {
    return null;
  }

  return {
    type: "charbullet",
    id: Number.parseInt(idRaw, 10),
    char
  };
}

function parseImageBulletHeading(suffix: string): ParsedFrHeading | null {
  const imageBullet = /^i(\d+)$/u.exec(suffix);
  const idRaw = imageBullet?.[1];
  if (idRaw === undefined) {
    return null;
  }

  return {
    type: "imgbullet",
    id: Number.parseInt(idRaw, 10)
  };
}
