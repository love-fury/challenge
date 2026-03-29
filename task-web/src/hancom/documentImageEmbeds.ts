import type { DocumentBlock, HancomDocument } from "../models/types.js";

interface EmbeddedImageData {
  mimeType?: string;
  base64: string;
}

interface ApplyEmbeddedImagesResult {
  document: HancomDocument;
  warnings: string[];
}

export function collectDocumentImageSources(document: HancomDocument): string[] {
  const sources = new Set<string>();

  const visitBlocks = (blocks: readonly DocumentBlock[]): void => {
    for (const block of blocks) {
      if (block.kind === "image") {
        if (typeof block.source === "string" && block.source.length > 0) {
          sources.add(block.source);
        }
        continue;
      }

      if (block.kind === "table") {
        for (const row of block.rows) {
          for (const cell of row.cells) {
            visitBlocks(cell.blocks);
          }
        }
      }
    }
  };

  visitBlocks(document.blocks);
  return Array.from(sources);
}

export function applyEmbeddedImages(
  document: HancomDocument,
  imageDataMap: Readonly<Record<string, EmbeddedImageData>>
): ApplyEmbeddedImagesResult {
  const warnings = new Set<string>();
  const nextBlocks = document.blocks.map((block) => applyEmbeddedImagesToBlock(block, imageDataMap, warnings));

  return {
    document: {
      ...document,
      blocks: nextBlocks
    },
    warnings: Array.from(warnings)
  };
}

function applyEmbeddedImagesToBlock(
  block: DocumentBlock,
  imageDataMap: Readonly<Record<string, EmbeddedImageData>>,
  warnings: Set<string>
): DocumentBlock {
  if (block.kind === "image") {
    if (block.source === undefined) {
      warnings.add(`Image block ${block.id} has no source; base64 embedding was skipped.`);
      return block;
    }

    const embedded = imageDataMap[block.source];
    if (embedded === undefined) {
      warnings.add(`Could not embed base64 data for image source ${block.source}.`);
      return block;
    }

    return {
      ...block,
      base64: embedded.base64,
      ...(embedded.mimeType === undefined ? {} : { mimeType: embedded.mimeType })
    };
  }

  if (block.kind === "paragraph") {
    return block;
  }

  return {
    ...block,
    rows: block.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => ({
        ...cell,
        blocks: cell.blocks.map((child) => applyEmbeddedImagesToBlock(child, imageDataMap, warnings))
      }))
    }))
  };
}
