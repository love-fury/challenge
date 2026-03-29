export interface ConnectionOptions {
  host?: string;
  port?: number;
  targetId?: string;
  targetUrlPattern?: string;
  targetTitlePattern?: string;
  timeoutMs?: number;
}

export interface ChromeTargetInfo {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
}

export interface EditorProbeSummary {
  title: string;
  url: string;
  readyState: string;
  canvasCount: number;
  hasAutomationHook: boolean;
  availableHookMethods: string[];
  candidateGlobals: string[];
}

export interface RuntimeObjectSummary {
  exists: boolean;
  type?: string;
  ctor?: string | null;
  ownKeys?: string[];
  protoKeys?: string[];
}

export interface SampleFieldSummary {
  type?: string;
  ctor?: string | null;
  error?: string;
}

export interface DocumentSurfaceSummary {
  exists: boolean;
  ctor?: string | null;
  protoKeys?: string[];
  textLikeKeys?: string[];
  mutationLikeKeys?: string[];
  sampleFields?: Record<string, SampleFieldSummary>;
}

export interface ActionManagerSurfaceSummary {
  exists: boolean;
  ctor?: string | null;
  ownKeys?: string[];
  protoKeys?: string[];
  commandLikeKeys?: string[];
}

export interface EditorFrameSummary {
  exists: boolean;
  src?: string;
  readyState?: string | null;
  title?: string | null;
  canvasCount?: number | null;
  bodyChildCount?: number | null;
  bodyChildren?: Array<{
    tag: string;
    id: string;
    className: string;
  }>;
  interestingWindowKeys?: string[];
}

export interface CommandSurfaceSummary {
  appFunctionKeys: string[];
  ctrlApiKeys: string[];
  uiCommandFunctions: string[];
}

export interface RuntimeInventoryReport {
  probe: EditorProbeSummary;
  scriptSources: string[];
  iframeSummaries: EditorFrameSummary[];
  hwpApp: RuntimeObjectSummary;
  core: RuntimeObjectSummary;
  models: RuntimeObjectSummary;
  document: DocumentSurfaceSummary;
  actionManager: ActionManagerSurfaceSummary;
  uiapi: RuntimeObjectSummary;
  commandSurface: CommandSurfaceSummary;
  notes: string[];
}

export interface DocumentTextChainNode {
  index: number;
  nodeId: string | null;
  text: string;
  normalizedText: string;
  textLength: number;
  styleRunBoundaries: number[];
  styleRunCount: number;
  styleRef: number | null;
  isParagraphBreak: boolean;
  isControlLike: boolean;
  flags: {
    Ooi: number | null;
    koi: number | null;
    Hoi: number | null;
    Moi: number | null;
    idi: number | null;
    ndi: boolean | null;
  };
}

export interface DocumentTextChainReport {
  rootNodeId: string | null;
  traversedCount: number;
  textNodeCount: number;
  controlNodeCount: number;
  paragraphCount: number;
  extractedText: string;
  paragraphs: string[];
  nodes: DocumentTextChainNode[];
}

export interface HwpJson20CharShape {
  f1?: string;
  f2?: string;
  f3?: string;
  f4?: string;
  f5?: string;
  f6?: string;
  f7?: string;
  he?: number;
  bo?: boolean | number;
  it?: boolean | number;
  tc?: number | string;
  [key: string]: unknown;
}

export interface HwpJson20ParaShape {
  ah?: number | string;
  lv?: number;
  [key: string]: unknown;
}

export interface HwpJson20StyleEntry {
  na?: string;
  en?: string;
  pp?: string | number | null;
  cp?: string | number | null;
  [key: string]: unknown;
}

export interface HwpJson20ParagraphRecord {
  tx?: string;
  tp?: Array<number | string>;
  pp?: string | number | null;
  si?: string | number | null;
  bf?: string | number | null;
  np?: unknown;
  [key: string]: unknown;
}

export interface HwpJson20SublistRecord {
  hp?: string | number | null;
  np?: string | number | null;
  tx?: string;
  tp?: Array<number | string>;
  pp?: string | number | null;
  si?: string | number | null;
  bf?: string | number | null;
  [key: string]: unknown;
}

export interface HwpJson20ControlPayload {
  tr?: unknown[];
  ch?: Record<string, unknown> | unknown[];
  img?: {
    bi?: string | number | null;
    sr?: string;
    [key: string]: unknown;
  };
  rc?: {
    img?: {
      bi?: string | number | null;
      sr?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface HwpJson20BinaryAsset {
  id?: string | number | null;
  mt?: string;
  sr?: string;
  [key: string]: unknown;
}

export interface HwpJson20ControlToken {
  marker: string;
  signatureHex: string;
  signatureText: string;
  objectId: string;
  raw: string;
  start: number;
  end: number;
}

export interface HwpJson20DocumentSnapshot {
  documentPr?: Record<string, unknown>;
  dh?: Record<string, unknown>;
  ro?: Record<string, HwpJson20ParagraphRecord> | HwpJson20ParagraphRecord[];
  sl?: Record<string, HwpJson20SublistRecord> | HwpJson20SublistRecord[];
  cs?: Record<string, HwpJson20ControlPayload> | HwpJson20ControlPayload[];
  cp?: Record<string, HwpJson20CharShape> | HwpJson20CharShape[];
  pp?: Record<string, HwpJson20ParaShape> | HwpJson20ParaShape[];
  st?: Record<string, HwpJson20StyleEntry> | HwpJson20StyleEntry[];
  bi?: Record<string, HwpJson20BinaryAsset> | HwpJson20BinaryAsset[];
  [key: string]: unknown;
}

export interface ParagraphFormatting {
  fontName?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  alignment?: "left" | "center" | "right" | "justify";
  lineSpacing?: number;
  charStyleCode?: number | string | null;
  paraStyleCode?: number | string | null;
  rawCharStyle?: Record<string, unknown>;
  rawParaStyle?: Record<string, unknown>;
}

export interface DocumentReadCapabilities {
  paragraphs: boolean;
  inlineRuns: boolean;
  tables: boolean;
  images: boolean;
  pageBoundaries: boolean;
}

export type DocumentSource = "automation-hook" | "text-chain" | "hwpjson20";

export interface PageRange {
  start: number;
  end: number;
}

export interface TextStyle {
  fontName?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
}

export interface ParagraphStyle {
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  alignment?: "left" | "center" | "right" | "justify";
  lineSpacing?: number;
}

export interface ParagraphStyleVariant {
  paraStyleCode: number | string;
  lineSpacing?: number;
  alignment?: "left" | "center" | "right" | "justify";
  rawCUt?: number;
  rawXli?: number;
  rawLNi?: number;
  rawWTiMsi?: number;
}

export interface TextRunSourceRefs {
  hwpJson20CharShapeId?: string;
  textChainCharStyleCode?: number;
  textChainStyleRef?: number;
}

export interface TextRun {
  text: string;
  start: number;
  end: number;
  textStyle: TextStyle;
  charStyleCode?: number | string | null;
  charShapeId?: number | string | null;
  styleRef?: number | string | null;
  formatting?: ParagraphFormatting;
  sourceRefs?: TextRunSourceRefs;
}

export interface ParagraphSourceRefs {
  rawNodeIds?: string[];
  rawRecordId?: string;
  rawStyleId?: string | null;
  rawParaShapeId?: string | null;
}

export interface ParagraphBlock {
  id: string;
  kind: "paragraph";
  text: string;
  runs: TextRun[];
  paragraphStyle: ParagraphStyle;
  dominantTextStyle?: TextStyle;
  paraStyleRefs?: Array<number | string>;
  paragraphStyleConsistent?: boolean;
  paraStyleVariants?: ParagraphStyleVariant[];
  pageRange?: PageRange;
  rawNodeIds?: string[];
  rawRecordId?: string;
  rawStyleId?: string | null;
  rawParaShapeId?: string | null;
  controlIds?: string[];
  sourceRefs?: ParagraphSourceRefs;
}

export interface DocumentTableCell {
  id: string;
  blocks: DocumentBlock[];
}

export interface DocumentTableRow {
  cells: DocumentTableCell[];
}

export interface TableBlock {
  id: string;
  kind: "table";
  rows: DocumentTableRow[];
  pageRange?: PageRange;
  controlId?: string;
}

export interface ImageBlock {
  id: string;
  kind: "image";
  altText?: string;
  caption?: string;
  source?: string;
  pageRange?: PageRange;
  controlId?: string;
}

export type DocumentBlock = ParagraphBlock | TableBlock | ImageBlock;

export interface HancomDocumentMetadata {
  title?: string;
  pageCount?: number;
  capturedAt: string;
  source?: DocumentSource;
}

export interface HancomDocument {
  metadata: HancomDocumentMetadata;
  capabilities: DocumentReadCapabilities;
  warnings: string[];
  blocks: DocumentBlock[];
  raw?: HwpJson20DocumentSnapshot;
}

export type ParagraphLocator = number | string;
export type TableLocator = number | string;

export interface ParagraphFormattingResult {
  paragraphId: string;
  dominantTextStyle: TextStyle;
  paragraphStyle: ParagraphStyle;
  hasMixedTextStyles: boolean;
  textStyleVariants: TextStyle[];
  paraStyleRefs: Array<number | string>;
  paragraphStyleConsistent: boolean;
  paraStyleVariants: ParagraphStyleVariant[];
  hasMixedParagraphStyles: boolean;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  contextWindow?: number;
}

export interface SearchMatch {
  index: number;
  start: number;
  end: number;
  match: string;
  before: string;
  after: string;
  context: string;
  blockId?: string;
  blockIndex?: number;
  pageIndex?: number;
  pageNumber?: number;
  anchorPath?: string;
  anchorNodeKind?: "paragraph" | "table" | "image";
  anchorNodeId?: string;
  paragraphIndex?: number;
  tableIndex?: number;
  rowIndex?: number;
  cellIndex?: number;
  crossedNodeBoundary: boolean;
  crossedSeparator: boolean;
}

export interface SearchResult {
  query: string;
  total: number;
  matches: SearchMatch[];
}

export interface MarkdownExportOptions {
  includeWarnings?: boolean;
}

export interface MarkdownExportResult {
  markdown: string;
  warnings: string[];
}

export interface ReplaceAllRequest {
  find: string;
  replace: string;
  caseSensitive?: boolean;
}

export interface ReplaceAllResult {
  replacements?: number;
  alertText?: string | null;
  dialogClosed?: boolean;
}

/**
 * Creates an empty table shell at the current insertion point.
 * Cell values are written separately via `fillTableCells()`.
 */
export interface InsertTableRequest {
  rows: number;
  cols: number;
}

export interface InsertTableResult {
  rows: number;
  cols: number;
  tableId?: string;
}

/**
 * Shorthand alias for size-only table creation.
 */
export type TableSpec = InsertTableRequest;
export type TableCellMatrix = string[][];

/**
 * Writes cell values into an existing table.
 * Use this after `insertTable()` for initial population or later edits.
 */
export interface FillTableCellsRequest {
  values: TableCellMatrix;
  table?: TableLocator;
  startCell?: {
    row: number;
    col: number;
  };
}

export interface FillTableCellsResult {
  writtenCellCount: number;
  tableId?: string;
}

export interface SaveOptions {
  timeoutMs?: number;
}

export interface SaveResult {
  savedAt: string;
  beforeSaveCommandEnabled?: boolean;
  afterSaveCommandEnabled?: boolean;
  titleBefore?: string;
  titleAfter?: string;
  alertText?: string | null;
}

export interface PageNavigationResult {
  pageNumber: number;
  resolvedPageNumber?: number;
  visiblePageOptionCount?: number;
  maxVisiblePageOptionNumber?: number | null;
  beforeScrollTop?: number | null;
  afterScrollTop?: number | null;
  didScroll?: boolean;
  dialogClosed?: boolean;
  alertText?: string | null;
}

export interface InsertImageRequest {
  path: string;
}

export interface ImageInsertResult {
  source: "file";
  path: string;
}

export type TableRowInsertPosition = "above" | "below";

export interface InsertTableRowRequest {
  position: TableRowInsertPosition;
  count?: number;
}

export interface DeleteTableRowRequest {
  count?: number;
}

export interface TableMutationResult {
  tableId?: string;
  rowCountDelta: number;
  appliedCommand?: "insert_upper_row" | "insert_lower_row" | "remove_row";
}

export type CaretTarget =
  | { kind: "document-start" }
  | { kind: "document-end" }
  | { kind: "paragraph"; paragraph: ParagraphLocator; offset?: number }
  | { kind: "run"; paragraph: ParagraphLocator; run: number; offset?: number }
  | { kind: "table-cell"; table: TableLocator; row: number; col: number; offset?: number }
  | { kind: "page-start"; pageNumber: number }
  | { kind: "page-end"; pageNumber: number };

export interface CaretPosition {
  blockId: string;
  blockIndex: number;
  pageNumber?: number;
  paragraphId?: string;
  runIndex?: number;
  textOffset?: number;
  tableId?: string;
  cell?: {
    row: number;
    col: number;
  };
}
