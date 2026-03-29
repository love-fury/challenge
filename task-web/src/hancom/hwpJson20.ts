import type {
  DocumentBlock,
  DocumentReadCapabilities,
  DocumentTableCell,
  HancomDocument,
  HwpJson20BinaryAsset,
  HwpJson20CharShape,
  HwpJson20ControlPayload,
  HwpJson20ControlToken,
  HwpJson20DocumentSnapshot,
  HwpJson20ParagraphRecord,
  HwpJson20ParaShape,
  HwpJson20SublistRecord,
  HwpJson20StyleEntry,
  ParagraphBlock,
  ParagraphStyle,
  ParagraphStyleVariant,
  TextRun,
  TextStyle
} from "../models/types.js";

const CONTROL_TOKEN_PATTERN = /<([0-9A-Fa-f]{2})\/([0-9A-Fa-f]{8})\/([A-Za-z0-9]+)>/g;

export function parseHwpJson20Document(snapshot: HwpJson20DocumentSnapshot): HancomDocument {
  const warnings: string[] = [];
  const paragraphRecords = normalizeIndexedCollection<HwpJson20ParagraphRecord>(snapshot.ro);
  const sublistMap = normalizeIndexedCollection<HwpJson20SublistRecord>(snapshot.sl);
  const controlMap = normalizeIndexedCollection<HwpJson20ControlPayload>(snapshot.cs);
  const charShapeMap = normalizeIndexedCollection<HwpJson20CharShape>(snapshot.cp);
  const paraShapeMap = normalizeIndexedCollection<HwpJson20ParaShape>(snapshot.pp);
  const styleMap = normalizeIndexedCollection<HwpJson20StyleEntry>(snapshot.st);
  const assetMap = normalizeBinaryAssetCollection(snapshot.bi);
  const blocks: DocumentBlock[] = [];
  const anchoredControlIds = new Set<string>();
  const recordParseContext: RecordParseContext = {
    controlMap,
    sublistMap,
    charShapeMap,
    paraShapeMap,
    styleMap,
    assetMap,
    warnings,
    anchoredControlIds
  };

  for (const [recordId, record] of Object.entries(paragraphRecords)) {
    const bundle = buildRecordBlockBundle({ recordId, record, context: recordParseContext });
    blocks.push(...bundle.blocks);
  }

  blocks.push(...buildUnanchoredImageBlocks(controlMap, assetMap, anchoredControlIds, warnings));

  const capabilities: DocumentReadCapabilities = {
    paragraphs: hasDocumentBlockKind(blocks, "paragraph"),
    inlineRuns: hasParagraphRuns(blocks),
    tables: hasDocumentBlockKind(blocks, "table"),
    images: hasDocumentBlockKind(blocks, "image"),
    pageBoundaries: false
  };

  return {
    metadata: {
      capturedAt: new Date().toISOString(),
      source: "hwpjson20"
    },
    capabilities,
    warnings: uniqueStrings(warnings),
    blocks,
    raw: snapshot
  };
}

interface ParagraphBuildContext {
  recordId: string;
  record: HwpJson20ParagraphRecord;
  charShapeMap: Record<string, HwpJson20CharShape>;
  paraShapeMap: Record<string, HwpJson20ParaShape>;
  styleMap: Record<string, HwpJson20StyleEntry>;
  allowControlOnlyBlock: boolean;
}

interface ParagraphBuildResult {
  block: ParagraphBlock | null;
  hasVisibleText: boolean;
  tokens: HwpJson20ControlToken[];
}

interface RecordParseContext {
  controlMap: Record<string, HwpJson20ControlPayload>;
  sublistMap: Record<string, HwpJson20SublistRecord>;
  charShapeMap: Record<string, HwpJson20CharShape>;
  paraShapeMap: Record<string, HwpJson20ParaShape>;
  styleMap: Record<string, HwpJson20StyleEntry>;
  assetMap: Record<string, HwpJson20BinaryAsset>;
  warnings: string[];
  anchoredControlIds: Set<string>;
}

interface RecordBlockBundle {
  blocks: DocumentBlock[];
}

function buildParagraphBlock(context: ParagraphBuildContext): ParagraphBuildResult {
  const { recordId, record, charShapeMap, paraShapeMap, styleMap, allowControlOnlyBlock } = context;
  const rawText = typeof record.tx === "string" ? record.tx : "";
  const tokens = parseControlTokens(rawText);
  const { cleanText, rawToClean } = stripControlTokens(rawText);
  const hasVisibleText = cleanText.trim().length > 0;
  const styleEntry = resolveStyleEntry(styleMap, record.si);
  const paraShapeId = resolveRef(record.pp) ?? resolveRef(styleEntry?.pp);
  const paraShape = paraShapeId === null ? undefined : paraShapeMap[paraShapeId];
  const defaultCharShapeId = resolveRef(styleEntry?.cp);
  const defaultTextStyle = resolveTextStyle(
    defaultCharShapeId === null ? undefined : charShapeMap[defaultCharShapeId]
  );
  const runs = buildRuns({
    rawText,
    cleanText,
    rawToClean,
    runSpec: record.tp,
    defaultCharShapeId,
    charShapeMap,
    paraShape
  });
  const paragraphStyle = resolveParagraphStyle(paraShape, styleEntry);
  const paraStyleVariants = buildParagraphStyleVariants(paraShape, paraShapeId);
  const controlIds = tokens.map((token) => token.objectId);

  if (!hasVisibleText && controlIds.length > 0 && !allowControlOnlyBlock) {
    return {
      block: null,
      hasVisibleText,
      tokens
    };
  }

  const paragraphBlock: ParagraphBlock = {
    id: recordId,
    kind: "paragraph",
    text: cleanText,
    runs:
      runs.length > 0
        ? runs
        : buildFallbackRuns(cleanText, defaultTextStyle, paraShape, defaultCharShapeId),
    paragraphStyle,
    ...(Object.keys(defaultTextStyle).length === 0 ? {} : { dominantTextStyle: defaultTextStyle }),
    ...(paraShapeId === null ? {} : { paraStyleRefs: [paraShapeId] }),
    ...(paraStyleVariants.length === 0 ? {} : { paraStyleVariants }),
    ...(paraStyleVariants.length === 0 ? {} : { paragraphStyleConsistent: true }),
    rawNodeIds: [recordId],
    rawRecordId: recordId,
    ...(resolveRef(record.si) === null ? {} : { rawStyleId: resolveRef(record.si) }),
    ...(paraShapeId === null ? {} : { rawParaShapeId: paraShapeId }),
    ...(controlIds.length === 0 ? {} : { controlIds }),
    sourceRefs: {
      rawNodeIds: [recordId],
      rawRecordId: recordId,
      ...(resolveRef(record.si) === null ? {} : { rawStyleId: resolveRef(record.si) }),
      ...(paraShapeId === null ? {} : { rawParaShapeId: paraShapeId })
    }
  };

  return {
    block: paragraphBlock,
    hasVisibleText,
    tokens
  };
}

function buildRecordBlockBundle(context: {
  recordId: string;
  record: HwpJson20ParagraphRecord;
  context: RecordParseContext;
}): RecordBlockBundle {
  const { recordId, record } = context;
  const {
    controlMap,
    sublistMap,
    charShapeMap,
    paraShapeMap,
    styleMap,
    assetMap,
    warnings,
    anchoredControlIds
  } = context.context;
  const paragraphResult = buildParagraphBlock({
    recordId,
    record,
    charShapeMap,
    paraShapeMap,
    styleMap,
    allowControlOnlyBlock: false
  });
  const blocks: DocumentBlock[] = [];

  if (paragraphResult.block !== null) {
    blocks.push(paragraphResult.block);
  }

  for (const token of paragraphResult.tokens) {
    const control = controlMap[token.objectId];
    if (control === undefined) {
      warnings.push(`Control token ${token.raw} did not resolve into cs[${token.objectId}].`);
      continue;
    }

    anchoredControlIds.add(token.objectId);
    blocks.push(
      ...buildControlBlocks({
        parentHasVisibleText: paragraphResult.hasVisibleText,
        token,
        control,
        controlMap,
        sublistMap,
        charShapeMap,
        paraShapeMap,
        styleMap,
        assetMap,
        warnings,
        anchoredControlIds
      })
    );
  }

  return { blocks };
}

interface RunBuildContext {
  rawText: string;
  cleanText: string;
  rawToClean: number[];
  runSpec: unknown;
  defaultCharShapeId: string | null;
  charShapeMap: Record<string, HwpJson20CharShape>;
  paraShape: HwpJson20ParaShape | undefined;
}

function buildRuns(context: RunBuildContext): TextRun[] {
  const {
    rawText,
    cleanText,
    rawToClean,
    runSpec,
    defaultCharShapeId,
    charShapeMap,
    paraShape
  } = context;
  const boundaries = parseRunBoundaries(runSpec);
  if (cleanText.length === 0) {
    return [];
  }

  if (boundaries.length === 0) {
    return buildFallbackRuns(
      cleanText,
      resolveTextStyle(
        defaultCharShapeId === null ? undefined : charShapeMap[defaultCharShapeId]
      ),
      paraShape,
      defaultCharShapeId
    );
  }

  const orderedBoundaries = [...boundaries]
    .sort((left, right) => left.offset - right.offset)
    .map((entry, index) => (index === 0 && entry.offset > 0
      ? [{ offset: 0, charShapeId: defaultCharShapeId }, entry]
      : [entry]))
    .flat();

  const runs: TextRun[] = [];
  for (const [index, boundary] of orderedBoundaries.entries()) {
    const next = orderedBoundaries[index + 1];
    const rawStart = clamp(boundary.offset, 0, rawText.length);
    const rawEnd = clamp(next?.offset ?? rawText.length, rawStart, rawText.length);
    const cleanStart = rawToClean[rawStart] ?? 0;
    const cleanEnd = rawToClean[rawEnd] ?? cleanText.length;
    if (cleanEnd <= cleanStart) {
      continue;
    }

    const charShapeId = boundary.charShapeId ?? defaultCharShapeId;
    const charShape = charShapeId === null ? undefined : charShapeMap[charShapeId];
    const textStyle = resolveTextStyle(charShape);
    const formatting = {
      ...textStyle,
      ...resolveParagraphStyle(paraShape),
      ...(charShape === undefined
        ? {}
        : {
            rawCharStyle: toRawRecord(charShape),
            ...(charShapeId === null ? {} : { charStyleCode: charShapeId })
          }),
      ...(paraShape === undefined ? {} : { rawParaStyle: toRawRecord(paraShape) })
    };

    runs.push({
      text: cleanText.slice(cleanStart, cleanEnd),
      start: cleanStart,
      end: cleanEnd,
      textStyle,
      ...(charShapeId === null ? {} : { charStyleCode: charShapeId, charShapeId }),
      ...(Object.keys(formatting).length === 0 ? {} : { formatting }),
      ...(charShapeId === null
        ? {}
        : {
            sourceRefs: {
              hwpJson20CharShapeId: charShapeId
            }
          })
    });
  }

  return runs;
}

function buildFallbackRuns(
  cleanText: string,
  textStyle: TextStyle,
  paraShape: HwpJson20ParaShape | undefined,
  charShapeId: string | null
): TextRun[] {
  if (cleanText.length === 0) {
    return [];
  }

  return [
    {
      text: cleanText,
      start: 0,
      end: cleanText.length,
      textStyle,
      ...(charShapeId === null ? {} : { charStyleCode: charShapeId, charShapeId }),
      formatting: {
        ...textStyle,
        ...resolveParagraphStyle(paraShape),
        ...(paraShape === undefined ? {} : { rawParaStyle: toRawRecord(paraShape) }),
        ...(charShapeId === null ? {} : { charStyleCode: charShapeId })
      },
      ...(charShapeId === null
        ? {}
        : {
            sourceRefs: {
              hwpJson20CharShapeId: charShapeId
            }
          })
    }
  ];
}

interface ControlBuildContext {
  parentHasVisibleText: boolean;
  token: HwpJson20ControlToken;
  control: HwpJson20ControlPayload;
  controlMap: Record<string, HwpJson20ControlPayload>;
  sublistMap: Record<string, HwpJson20SublistRecord>;
  charShapeMap: Record<string, HwpJson20CharShape>;
  paraShapeMap: Record<string, HwpJson20ParaShape>;
  styleMap: Record<string, HwpJson20StyleEntry>;
  assetMap: Record<string, HwpJson20BinaryAsset>;
  warnings: string[];
  anchoredControlIds: Set<string>;
}

function buildControlBlocks(context: ControlBuildContext): DocumentBlock[] {
  const { token, control, warnings, parentHasVisibleText } = context;
  if (isTableControl(token, control)) {
    const tableBlock = buildTableBlock(context);
    if (tableBlock === null) {
      warnings.push(`Control ${token.objectId} looked like a table but row/cell extraction failed.`);
      return [];
    }

    return [tableBlock];
  }

  if (isImageControl(control)) {
    if (parentHasVisibleText) {
      return [];
    }
    return [buildImageBlock(token.objectId, control, context.assetMap)];
  }

  if (token.signatureText === "pgnp") {
    return [];
  }

  warnings.push(`Control ${token.objectId} (${token.signatureText || token.signatureHex}) is not classified yet.`);
  return [];
}

function buildTableBlock(context: ControlBuildContext): Extract<DocumentBlock, { kind: "table" }> | null {
  const {
    token,
    control,
    controlMap,
    sublistMap,
    charShapeMap,
    paraShapeMap,
    styleMap,
    anchoredControlIds
  } = context;
  const cellMap = normalizeIndexedCollection<unknown>(control.ch);
  const knownCellIds = new Set(Object.keys(cellMap));
  const rowEntries = Array.isArray(control.tr) ? control.tr : [];
  const rows = rowEntries
    .map((rowEntry) => {
      const cellIds = extractCellIds(rowEntry, knownCellIds);
      const cells = cellIds.map<DocumentTableCell>((cellId) =>
        buildTableCell({
          cellId,
          payload: cellMap[cellId],
          sublistMap,
          controlMap,
          charShapeMap,
          paraShapeMap,
          styleMap,
          assetMap: context.assetMap,
          warnings: context.warnings,
          anchoredControlIds
        })
      );

      return { cells };
    })
    .filter((row) => row.cells.length > 0);

  if (rows.length === 0) {
    return null;
  }

  return {
    id: token.objectId,
    kind: "table",
    rows,
    controlId: token.objectId
  };
}

interface TableCellBuildContext {
  cellId: string;
  payload: unknown;
  sublistMap: Record<string, HwpJson20SublistRecord>;
  controlMap: Record<string, HwpJson20ControlPayload>;
  charShapeMap: Record<string, HwpJson20CharShape>;
  paraShapeMap: Record<string, HwpJson20ParaShape>;
  styleMap: Record<string, HwpJson20StyleEntry>;
  assetMap: Record<string, HwpJson20BinaryAsset>;
  warnings: string[];
  anchoredControlIds: Set<string>;
}

function buildTableCell(context: TableCellBuildContext): DocumentTableCell {
  const {
    cellId,
    payload,
    sublistMap,
    controlMap,
    charShapeMap,
    paraShapeMap,
    styleMap,
    assetMap,
    warnings,
    anchoredControlIds
  } = context;
  const paragraphEntries = readTableCellParagraphEntries(cellId, payload, sublistMap);
  const blocks = paragraphEntries.flatMap(({ recordId, record }, index) =>
    buildRecordBlockBundle({
      recordId: recordId ?? `${cellId}:p${index}`,
      record,
      context: {
        controlMap,
        sublistMap,
        charShapeMap,
        paraShapeMap,
        styleMap,
        assetMap,
        warnings,
        anchoredControlIds
      }
    }).blocks
  );

  return {
    id: cellId,
    blocks
  };
}

function readTableCellParagraphEntries(
  cellId: string,
  payload: unknown,
  sublistMap: Record<string, HwpJson20SublistRecord>
): Array<{ recordId: string | null; record: HwpJson20ParagraphRecord }> {
  const sublistParagraphs = followTableCellParagraphChain(cellId, sublistMap);
  if (sublistParagraphs.length > 0) {
    return sublistParagraphs;
  }

  return extractParagraphPayloads(payload).map((record, index) => ({
    recordId: `${cellId}:p${index}`,
    record
  }));
}

function followTableCellParagraphChain(
  cellId: string,
  sublistMap: Record<string, HwpJson20SublistRecord>
): Array<{ recordId: string | null; record: HwpJson20ParagraphRecord }> {
  const cellRecord = sublistMap[cellId];
  const paragraphId = resolveRef(cellRecord?.hp);
  if (paragraphId === null) {
    return [];
  }

  const entries: Array<{ recordId: string | null; record: HwpJson20ParagraphRecord }> = [];
  const seen = new Set<string>();
  let currentParagraphId: string | null = paragraphId;

  while (currentParagraphId !== null && !seen.has(currentParagraphId)) {
    seen.add(currentParagraphId);
    const paragraphRecord = sublistMap[currentParagraphId];
    if (!isRecord(paragraphRecord)) {
      break;
    }

    entries.push({
      recordId: currentParagraphId,
      record: paragraphRecord as HwpJson20ParagraphRecord
    });

    currentParagraphId = resolveRef(paragraphRecord.np);
  }

  return entries;
}

function buildImageBlock(
  controlId: string,
  control: HwpJson20ControlPayload,
  assetMap: Record<string, HwpJson20BinaryAsset>
): Extract<DocumentBlock, { kind: "image" }> {
  const imagePayload = resolveImagePayload(control);
  const assetId = resolveRef(imagePayload?.bi);
  const asset = assetId === null ? undefined : assetMap[assetId];
  const source = firstString(asset?.sr, imagePayload?.sr, assetId ?? undefined);

  return {
    id: controlId,
    kind: "image",
    ...(source === undefined ? {} : { source }),
    controlId
  };
}

function buildUnanchoredImageBlocks(
  controlMap: Record<string, HwpJson20ControlPayload>,
  assetMap: Record<string, HwpJson20BinaryAsset>,
  anchoredControlIds: ReadonlySet<string>,
  warnings: string[]
): Array<Extract<DocumentBlock, { kind: "image" }>> {
  const blocks: Array<Extract<DocumentBlock, { kind: "image" }>> = [];

  for (const [controlId, control] of Object.entries(controlMap)) {
    if (!isImageControl(control) || anchoredControlIds.has(controlId)) {
      continue;
    }

    warnings.push(
      `Image control ${controlId} has no traversed paragraph anchor in hwpjson20; it was appended after anchored blocks.`
    );
    blocks.push(buildImageBlock(controlId, control, assetMap));
  }

  return blocks;
}

function hasDocumentBlockKind(
  blocks: readonly DocumentBlock[],
  kind: DocumentBlock["kind"]
): boolean {
  return blocks.some((block) => {
    if (block.kind === kind) {
      return true;
    }

    if (block.kind !== "table") {
      return false;
    }

    return block.rows.some((row) =>
      row.cells.some((cell) => hasDocumentBlockKind(cell.blocks, kind))
    );
  });
}

function hasParagraphRuns(blocks: readonly DocumentBlock[]): boolean {
  return blocks.some((block) => {
    if (block.kind === "paragraph") {
      return block.runs.length > 0;
    }

    if (block.kind !== "table") {
      return false;
    }

    return block.rows.some((row) =>
      row.cells.some((cell) => hasParagraphRuns(cell.blocks))
    );
  });
}

function parseControlTokens(rawText: string): HwpJson20ControlToken[] {
  const matches: HwpJson20ControlToken[] = [];
  CONTROL_TOKEN_PATTERN.lastIndex = 0;

  for (const match of rawText.matchAll(CONTROL_TOKEN_PATTERN)) {
    const marker = match[1];
    const signatureHex = match[2];
    const objectId = match[3];
    const raw = match[0];
    if (
      marker === undefined ||
      signatureHex === undefined ||
      objectId === undefined ||
      raw === undefined
    ) {
      continue;
    }

    matches.push({
      marker,
      signatureHex,
      signatureText: decodeSignatureHex(signatureHex),
      objectId,
      raw,
      start: match.index ?? 0,
      end: (match.index ?? 0) + raw.length
    });
  }

  return matches;
}

function stripControlTokens(rawText: string): { cleanText: string; rawToClean: number[] } {
  const tokens = parseControlTokens(rawText);
  const rawToClean: number[] = Array.from({ length: rawText.length + 1 }, () => 0);
  if (tokens.length === 0) {
    for (let index = 0; index <= rawText.length; index += 1) {
      rawToClean[index] = index;
    }
    return {
      cleanText: rawText,
      rawToClean
    };
  }

  let cleanText = "";
  let rawIndex = 0;
  let cleanIndex = 0;

  for (const token of tokens) {
    while (rawIndex < token.start) {
      cleanText += rawText[rawIndex] ?? "";
      rawToClean[rawIndex] = cleanIndex;
      rawIndex += 1;
      cleanIndex += 1;
    }

    while (rawIndex < token.end) {
      rawToClean[rawIndex] = cleanIndex;
      rawIndex += 1;
    }
  }

  while (rawIndex < rawText.length) {
    cleanText += rawText[rawIndex] ?? "";
    rawToClean[rawIndex] = cleanIndex;
    rawIndex += 1;
    cleanIndex += 1;
  }

  rawToClean[rawText.length] = cleanIndex;
  return {
      cleanText,
      rawToClean
    };
  }

function parseRunBoundaries(value: unknown): Array<{ offset: number; charShapeId: string | null }> {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries = value as unknown[];
  const boundaries: Array<{ offset: number; charShapeId: string | null }> = [];
  for (let index = 0; index < entries.length; index += 2) {
    const offset = entries[index];
    const charShapeId = entries[index + 1];
    if (typeof offset !== "number") {
      continue;
    }

    boundaries.push({
      offset,
      charShapeId: resolveRef(charShapeId)
    });
  }

  return boundaries;
}

function resolveTextStyle(
  charShape: HwpJson20CharShape | undefined
): TextStyle {
  if (charShape === undefined) {
    return {};
  }

  const fontName = pickFontName(charShape);
  const bold = toBoolean(charShape.bo);
  const italic = toBoolean(charShape.it);
  const color = decodeVisibleColor(charShape.tc);

  return {
    ...(fontName === undefined ? {} : { fontName }),
    ...(typeof charShape.he === "number" ? { fontSize: charShape.he / 100 } : {}),
    ...(bold === undefined ? {} : { bold }),
    ...(italic === undefined ? {} : { italic }),
    ...(color === undefined ? {} : { color })
  };
}

function resolveParagraphStyle(
  paraShape: HwpJson20ParaShape | undefined,
  styleEntry?: HwpJson20StyleEntry
): ParagraphStyle {
  const headingLevel = resolveHeadingLevelFromStyleEntry(styleEntry);
  if (paraShape === undefined && headingLevel === undefined) {
    return {};
  }

  return {
    ...(typeof paraShape?.lv === "number" ? { lineSpacing: paraShape.lv / 100 } : {}),
    ...(headingLevel === undefined ? {} : { headingLevel })
  };
}

function resolveHeadingLevelFromStyleEntry(styleEntry?: HwpJson20StyleEntry): 1 | 2 | 3 | 4 | 5 | 6 | undefined {
  if (styleEntry === undefined) {
    return undefined;
  }

  const candidates = [styleEntry.na, styleEntry.en].filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0
  );

  for (const candidate of candidates) {
    const heading = parseHeadingFromStyleName(candidate);
    if (heading !== undefined) {
      return heading;
    }
  }

  return undefined;
}

function parseHeadingFromStyleName(styleName: string): 1 | 2 | 3 | 4 | 5 | 6 | undefined {
  const match = /^\s*(heading|제목|title)\s*([1-6])(?:[^\d]|$)/ui.exec(styleName);
  const levelText = match?.[2];
  if (levelText !== undefined) {
    const level = Number.parseInt(levelText, 10);
    if (level >= 1 && level <= 6) {
      return level as 1 | 2 | 3 | 4 | 5 | 6;
    }
  }

  const shortMatch = /^\s*h([1-6])$/ui.exec(styleName);
  const shortLevelText = shortMatch?.[1];
  if (shortLevelText !== undefined) {
    const level = Number.parseInt(shortLevelText, 10);
    if (level >= 1 && level <= 6) {
      return level as 1 | 2 | 3 | 4 | 5 | 6;
    }
  }

  return undefined;
}

function buildParagraphStyleVariants(
  paraShape: HwpJson20ParaShape | undefined,
  paraShapeId: string | null
): ParagraphStyleVariant[] {
  if (paraShape === undefined || paraShapeId === null) {
    return [];
  }

  return [
    {
      paraStyleCode: paraShapeId,
      ...(typeof paraShape.lv === "number" ? { lineSpacing: paraShape.lv / 100 } : {}),
      ...(typeof paraShape.ah === "number" ? { rawCUt: paraShape.ah } : {})
    }
  ];
}

function buildTableCellParagraphSignature(record: HwpJson20ParagraphRecord): string {
  return JSON.stringify({
    tx: typeof record.tx === "string" ? record.tx : "",
    tp: Array.isArray(record.tp) ? record.tp : [],
    pp: resolveRef(record.pp),
    si: resolveRef(record.si)
  });
}

function extractParagraphPayloads(value: unknown): HwpJson20ParagraphRecord[] {
  const results: HwpJson20ParagraphRecord[] = [];
  const seen = new Set<string>();
  walkParagraphPayloads(value, 0, results, seen);
  return results;
}

function walkParagraphPayloads(
  value: unknown,
  depth: number,
  results: HwpJson20ParagraphRecord[],
  seen: Set<string>
): void {
  if (depth > 6) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      walkParagraphPayloads(entry, depth + 1, results, seen);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (typeof value.tx === "string") {
    const record = value as HwpJson20ParagraphRecord;
    const signature = buildTableCellParagraphSignature(record);
    if (!seen.has(signature)) {
      seen.add(signature);
      results.push(record);
    }
    return;
  }

  Object.values(value).forEach((entry) => {
    walkParagraphPayloads(entry, depth + 1, results, seen);
  });
}

function extractCellIds(value: unknown, knownCellIds: ReadonlySet<string>): string[] {
  const matches: string[] = [];
  walkCellIds(value, knownCellIds, matches, 0);
  return uniqueStrings(matches);
}

function walkCellIds(
  value: unknown,
  knownCellIds: ReadonlySet<string>,
  matches: string[],
  depth: number
): void {
  if (depth > 6) {
    return;
  }

  if (typeof value === "string" || typeof value === "number") {
    const ref = String(value);
    if (knownCellIds.has(ref)) {
      matches.push(ref);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      walkCellIds(entry, knownCellIds, matches, depth + 1);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  Object.values(value).forEach((entry) => {
    walkCellIds(entry, knownCellIds, matches, depth + 1);
  });
}

function normalizeIndexedCollection<T>(input: unknown): Record<string, T> {
  if (Array.isArray(input)) {
    const entries = input.flatMap<[string, T]>((entry, index) => {
      if (!isRecord(entry)) {
        return [];
      }
      const id = resolveRef(entry.id) ?? String(index);
      return [[id, entry as T]];
    });
    return Object.fromEntries(entries);
  }

  if (!isRecord(input)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value as T])
  );
}

function normalizeBinaryAssetCollection(input: unknown): Record<string, HwpJson20BinaryAsset> {
  const normalized = normalizeIndexedCollection<HwpJson20BinaryAsset>(input);
  const bySource = Object.values(normalized).flatMap<[string, HwpJson20BinaryAsset]>((entry) => {
    const source = firstString(entry.sr);
    return source === undefined ? [] : [[source, entry]];
  });

  return {
    ...normalized,
    ...Object.fromEntries(bySource)
  };
}

function resolveStyleEntry(
  styleMap: Record<string, HwpJson20StyleEntry>,
  styleRef: unknown
): HwpJson20StyleEntry | undefined {
  const styleId = resolveRef(styleRef);
  return styleId === null ? undefined : styleMap[styleId];
}

function resolveRef(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function isTableControl(
  token: HwpJson20ControlToken,
  control: HwpJson20ControlPayload
): boolean {
  return token.signatureText === "tbl" || (Array.isArray(control.tr) && isRecord(control.ch));
}

function isImageControl(control: HwpJson20ControlPayload): boolean {
  return resolveImagePayload(control) !== undefined;
}

function resolveImagePayload(
  control: HwpJson20ControlPayload
): NonNullable<HwpJson20ControlPayload["img"] | NonNullable<HwpJson20ControlPayload["rc"]>["img"]> | undefined {
  if (isRecord(control.rc?.img)) {
    return control.rc.img;
  }

  if (isRecord(control.img)) {
    return control.img;
  }

  return undefined;
}

function pickFontName(charShape: HwpJson20CharShape): string | undefined {
  return firstString(
    charShape.f1,
    charShape.f2,
    charShape.f3,
    charShape.f4,
    charShape.f5,
    charShape.f6,
    charShape.f7
  );
}

function decodeVisibleColor(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const red = value & 0xff;
  const green = (value >> 8) & 0xff;
  const blue = (value >> 16) & 0xff;
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function decodeSignatureHex(signatureHex: string): string {
  let decoded = "";
  for (let index = 0; index < signatureHex.length; index += 2) {
    const pair = signatureHex.slice(index, index + 2);
    const code = Number.parseInt(pair, 16);
    if (Number.isNaN(code) || code === 0) {
      continue;
    }
    decoded += String.fromCharCode(code);
  }
  return decoded.trim();
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return undefined;
}

function toRawRecord(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value };
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}
