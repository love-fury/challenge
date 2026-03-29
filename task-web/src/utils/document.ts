import type {
  DocumentBlock,
  DocumentTableCell,
  HancomDocument,
  ParagraphBlock,
  ParagraphFormattingResult,
  ParagraphLocator,
  ParagraphStyleVariant,
  TableBlock,
  TableCellMatrix,
  TableLocator,
  TextStyle
} from "../models/types.js";

export function flattenDocumentText(input: HancomDocument | readonly DocumentBlock[]): string {
  const blocks = toDocumentBlocks(input);
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.kind === "paragraph") {
      parts.push(block.text);
      continue;
    }

    if (block.kind === "table") {
      for (const row of block.rows) {
        parts.push(row.cells.map((cell) => flattenCellText(cell)).join("\t"));
      }
      continue;
    }

    const imageText = [block.altText, block.caption].filter(Boolean).join(" ");
    if (imageText) {
      parts.push(imageText);
    }
  }

  return parts.join("\n").trim();
}

export function normalizeTableMatrix(matrix: TableCellMatrix): TableCellMatrix {
  if (matrix.length === 0) {
    throw new RangeError("Table cell matrix must include at least one row.");
  }

  const expectedColumnCount = matrix[0]?.length ?? 0;
  if (expectedColumnCount === 0) {
    throw new RangeError("Table cell matrix must include at least one column.");
  }

  for (const row of matrix) {
    if (row.length !== expectedColumnCount) {
      throw new RangeError("Table cell matrix must be rectangular.");
    }
  }

  return matrix;
}

export function summarizeParagraphFormatting(
  paragraph: ParagraphBlock
): ParagraphFormattingResult {
  const textStyleVariants = paragraph.runs
    .map((run) => sortStyleKeys(run.textStyle))
    .filter((style, index, styles) => {
      const serialized = JSON.stringify(style);
      return styles.findIndex((candidate) => JSON.stringify(candidate) === serialized) === index;
    });
  const paraStyleVariants = (paragraph.paraStyleVariants ?? [])
    .map((variant) => sortParagraphStyleVariantKeys(variant))
    .filter((variant, index, variants) => {
      const serialized = JSON.stringify(variant);
      return variants.findIndex((candidate) => JSON.stringify(candidate) === serialized) === index;
    });
  const paraStyleRefs = Array.from(new Set(paragraph.paraStyleRefs ?? []));
  const paragraphStyleConsistent =
    paragraph.paragraphStyleConsistent ?? paraStyleVariants.length <= 1;
  const dominantTextStyle =
    paragraph.dominantTextStyle ??
    (textStyleVariants.length === 1 ? textStyleVariants[0] ?? {} : {});

  return {
    paragraphId: paragraph.id,
    dominantTextStyle,
    paragraphStyle: paragraph.paragraphStyle,
    hasMixedTextStyles: textStyleVariants.length > 1,
    textStyleVariants,
    paraStyleRefs,
    paragraphStyleConsistent,
    paraStyleVariants,
    hasMixedParagraphStyles: !paragraphStyleConsistent
  };
}

export function resolveParagraphBlock(
  document: HancomDocument,
  locator: ParagraphLocator
): { paragraph: ParagraphBlock; blockIndex: number; paragraphIndex: number } | null {
  const paragraphs = document.blocks.flatMap((block, blockIndex) =>
    block.kind === "paragraph" ? [{ paragraph: block, blockIndex }] : []
  );

  if (typeof locator === "number") {
    const match = paragraphs[locator];
    return match === undefined ? null : { ...match, paragraphIndex: locator };
  }

  const paragraphIndex = paragraphs.findIndex(({ paragraph }) => paragraph.id === locator);
  if (paragraphIndex === -1) {
    return null;
  }

  const match = paragraphs[paragraphIndex];
  return match === undefined ? null : { ...match, paragraphIndex };
}

export function resolveTableBlock(
  document: HancomDocument,
  locator: TableLocator
): { table: TableBlock; blockIndex: number; tableIndex: number } | null {
  const tables = document.blocks.flatMap((block, blockIndex) =>
    block.kind === "table" ? [{ table: block, blockIndex }] : []
  );

  if (typeof locator === "number") {
    const match = tables[locator];
    return match === undefined ? null : { ...match, tableIndex: locator };
  }

  const tableIndex = tables.findIndex(({ table }) => table.id === locator);
  if (tableIndex === -1) {
    return null;
  }

  const match = tables[tableIndex];
  return match === undefined ? null : { ...match, tableIndex };
}

export function toDocumentBlocks(input: HancomDocument | readonly DocumentBlock[]): DocumentBlock[] {
  return isHancomDocument(input) ? input.blocks : [...input];
}

function flattenCellText(cell: DocumentTableCell): string {
  return cell.blocks
    .map((block) => {
      if (block.kind === "paragraph") {
        return block.text;
      }

      if (block.kind === "image") {
        return [block.altText, block.caption].filter(Boolean).join(" ");
      }

      return flattenDocumentText(block.rows.flatMap((row) => row.cells.flatMap((nestedCell) => nestedCell.blocks)));
    })
    .filter((text) => text.length > 0)
    .join("\n")
    .trim();
}

function isHancomDocument(input: HancomDocument | readonly DocumentBlock[]): input is HancomDocument {
  return !Array.isArray(input);
}

function sortStyleKeys(style: TextStyle): TextStyle {
  return {
    ...(style.bold === undefined ? {} : { bold: style.bold }),
    ...(style.color === undefined ? {} : { color: style.color }),
    ...(style.fontName === undefined ? {} : { fontName: style.fontName }),
    ...(style.fontSize === undefined ? {} : { fontSize: style.fontSize }),
    ...(style.italic === undefined ? {} : { italic: style.italic })
  };
}

function sortParagraphStyleVariantKeys(variant: ParagraphStyleVariant): ParagraphStyleVariant {
  return {
    paraStyleCode: variant.paraStyleCode,
    ...(variant.alignment === undefined ? {} : { alignment: variant.alignment }),
    ...(variant.lineSpacing === undefined ? {} : { lineSpacing: variant.lineSpacing }),
    ...(variant.rawCUt === undefined ? {} : { rawCUt: variant.rawCUt }),
    ...(variant.rawLNi === undefined ? {} : { rawLNi: variant.rawLNi }),
    ...(variant.rawWTiMsi === undefined ? {} : { rawWTiMsi: variant.rawWTiMsi }),
    ...(variant.rawXli === undefined ? {} : { rawXli: variant.rawXli })
  };
}
