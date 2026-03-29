import type { DocumentBlock, HancomDocument } from "../models/types.js";

export function applyLiveImageSources(
  document: HancomDocument,
  sourceMap: Readonly<Record<string, string>>
): HancomDocument {
  if (Object.keys(sourceMap).length === 0) {
    return document;
  }

  return {
    ...document,
    blocks: document.blocks.map((block) => applyBlockImageSources(block, sourceMap))
  };
}

function applyBlockImageSources(
  block: DocumentBlock,
  sourceMap: Readonly<Record<string, string>>
): DocumentBlock {
  if (block.kind === "image") {
    const nextSource = block.source === undefined ? undefined : sourceMap[block.source];
    return nextSource === undefined ? block : { ...block, source: nextSource };
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
        blocks: cell.blocks.map((child) => applyBlockImageSources(child, sourceMap))
      }))
    }))
  };
}
