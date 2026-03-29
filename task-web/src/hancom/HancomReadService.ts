import {
  CapabilityUnavailableError,
  EditorPreconditionError
} from "../client/errors.js";
import type { CdpSession } from "../client/CdpSession.js";
import type {
  CaretPosition,
  HancomDocument,
  ParagraphBlock,
  ParagraphFormattingResult,
  ParagraphLocator,
  SearchOptions,
  SearchResult
} from "../models/types.js";
import {
  flattenDocumentText,
  resolveParagraphBlock,
  summarizeParagraphFormatting
} from "../utils/document.js";
import { searchDocumentText } from "../utils/search.js";
import { serializePageFunctionCall } from "./evaluation.js";
import { HwpJson20Codec } from "./HwpJson20Codec.js";
import { HwpJson20Reader } from "./HwpJson20Reader.js";
import { pageReadCaretState } from "./pageFunctions.js";

interface RawCaretState {
  nodeId: string | null;
  textOffset: number | null;
  positionType: number | null;
  currentPageNumber: number | null;
}

export class HancomReadService {
  private readonly hwpJson20Reader: HwpJson20Reader;

  private readonly hwpJson20Codec = new HwpJson20Codec();

  constructor(private readonly session: CdpSession) {
    this.hwpJson20Reader = new HwpJson20Reader(session);
  }

  async readDocument(): Promise<HancomDocument> {
    const snapshot = await this.hwpJson20Reader.readSnapshot();
    if (snapshot === null) {
      throw new CapabilityUnavailableError(
        "readDocument is unavailable. Could not obtain the runtime hwpjson20 snapshot."
      );
    }

    return this.hwpJson20Codec.parse(snapshot);
  }

  async readText(): Promise<string> {
    return flattenDocumentText(await this.readDocument());
  }

  async readStructure(): Promise<HancomDocument["blocks"]> {
    return (await this.readDocument()).blocks;
  }

  async getParagraphFormatting(locator: ParagraphLocator): Promise<ParagraphFormattingResult> {
    const document = await this.readDocument();
    const resolved = resolveParagraphBlock(document, locator);
    if (!resolved) {
      throw new EditorPreconditionError(`Could not resolve paragraph locator ${String(locator)}.`);
    }

    return summarizeParagraphFormatting(resolved.paragraph);
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    if (query.trim().length === 0) {
      throw new EditorPreconditionError("search requires a non-empty query.");
    }

    const document = await this.readDocument();
    return searchDocumentText(flattenDocumentText(document), query, options);
  }

  async getCaretPosition(): Promise<CaretPosition> {
    const rawCaretState = await this.session.evaluate<RawCaretState | null>(
      serializePageFunctionCall(pageReadCaretState)
    );
    if (rawCaretState === null || rawCaretState.nodeId === null) {
      throw new CapabilityUnavailableError("Current caret position is unavailable.");
    }

    const document = await this.readDocument();
    const located = this.findParagraphByRawNodeId(document, rawCaretState.nodeId);
    if (!located) {
      throw new CapabilityUnavailableError(
        `Could not map caret node ${rawCaretState.nodeId} to a structured paragraph block.`
      );
    }

    const runIndex = this.resolveRunIndex(located.paragraph, rawCaretState.textOffset);

    return {
      blockId: located.paragraph.id,
      blockIndex: located.blockIndex,
      ...(rawCaretState.currentPageNumber === null
        ? located.paragraph.pageRange?.start === undefined
          ? {}
          : { pageNumber: located.paragraph.pageRange.start }
        : { pageNumber: rawCaretState.currentPageNumber }),
      paragraphId: located.paragraph.id,
      ...(runIndex === null ? {} : { runIndex }),
      ...(rawCaretState.textOffset === null ? {} : { textOffset: rawCaretState.textOffset })
    };
  }

  private findParagraphByRawNodeId(
    document: HancomDocument,
    nodeId: string
  ): { paragraph: ParagraphBlock; blockIndex: number } | null {
    for (const [blockIndex, block] of document.blocks.entries()) {
      if (block.kind !== "paragraph") {
        continue;
      }

      if (block.rawNodeIds?.includes(nodeId)) {
        return {
          paragraph: block,
          blockIndex
        };
      }
    }

    return null;
  }

  private resolveRunIndex(paragraph: ParagraphBlock, textOffset: number | null): number | null {
    if (textOffset === null) {
      return null;
    }

    for (const [runIndex, run] of paragraph.runs.entries()) {
      if (textOffset >= run.start && textOffset < run.end) {
        return runIndex;
      }
    }

    if (paragraph.runs.length > 0 && textOffset === paragraph.text.length) {
      return paragraph.runs.length - 1;
    }

    return null;
  }
}
