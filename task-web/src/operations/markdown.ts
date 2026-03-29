import type {
  DocumentBlock,
  DocumentTableCell,
  DocumentTableRow,
  HancomDocument,
  ImageBlock,
  MarkdownExportOptions,
  ParagraphBlock,
  TableBlock,
  TextRun
} from "../models/types.js";

export function exportDocumentToMarkdown(
  document: HancomDocument,
  options: MarkdownExportOptions = {}
): string {
  const warnings = [...document.warnings];
  const sections = document.blocks
    .map((block) => renderTopLevelBlock(block, warnings, options))
    .filter((section): section is string => section.length > 0);
  const body = sections.join("\n\n").trim();

  if (options.includeWarningsAsComments !== true || warnings.length === 0) {
    return body;
  }

  const comment = ["<!--", ...uniqueStrings(warnings), "-->"].join("\n");
  return body.length === 0 ? comment : `${comment}\n\n${body}`;
}

function renderTopLevelBlock(
  block: DocumentBlock,
  warnings: string[],
  options: MarkdownExportOptions
): string {
  if (block.kind === "paragraph") {
    return renderParagraphBlock(block, warnings);
  }

  if (block.kind === "image") {
    return renderImageMarkdown(block, warnings, options);
  }

  return renderTableBlock(block, warnings, options);
}

function renderParagraphBlock(paragraph: ParagraphBlock, warnings: string[]): string {
  const text = renderParagraphText(paragraph, warnings);
  const headingPrefix = paragraph.paragraphStyle.headingLevel === undefined
    ? ""
    : `${"#".repeat(paragraph.paragraphStyle.headingLevel)} `;
  return `${headingPrefix}${text}`.trimEnd();
}

function renderParagraphText(paragraph: ParagraphBlock, warnings: string[]): string {
  if (paragraph.runs.length === 0) {
    return escapeMarkdownText(paragraph.text);
  }

  const joinedText = paragraph.runs.map((run) => run.text).join("");
  if (joinedText !== paragraph.text) {
    warnings.push("paragraph-runs-incomplete");
    return escapeMarkdownText(paragraph.text);
  }

  return paragraph.runs.map((run) => renderRunText(run)).join("");
}

function renderRunText(run: TextRun): string {
  const text = escapeMarkdownText(run.text);
  const isBold = run.textStyle.bold === true;
  const isItalic = run.textStyle.italic === true;

  if (isBold && isItalic) {
    return `***${text}***`;
  }

  if (isBold) {
    return `**${text}**`;
  }

  if (isItalic) {
    return `*${text}*`;
  }

  return text;
}

function renderImageMarkdown(
  image: ImageBlock,
  warnings: string[],
  options: MarkdownExportOptions
): string {
  const alt = escapeImageAltText(image.altText ?? image.caption ?? "image");
  const source = resolveMarkdownImageSource(image, warnings, options);

  if (source.length === 0) {
    warnings.push("image-source-missing");
  }

  return `![${alt}](${source})`;
}

function renderTableBlock(
  table: TableBlock,
  warnings: string[],
  options: MarkdownExportOptions
): string {
  if (table.rows.length === 0) {
    warnings.push("table-irregular-row");
    return "";
  }

  if (containsNestedTable(table)) {
    warnings.push("table-nested-table-html-fallback");
    return renderTableHtml(table, warnings, options);
  }

  warnings.push("table-span-unresolved");
  const columnCount = Math.max(...table.rows.map((row) => row.cells.length));
  const normalizedRows = table.rows.map((row) => normalizeRow(row, columnCount, warnings, options));
  const [headerRow, ...bodyRows] = normalizedRows;
  if (headerRow === undefined) {
    return "";
  }

  const lines = [
    renderPipeRow(headerRow),
    renderPipeRow(Array.from({ length: headerRow.length }, () => "---")),
    ...bodyRows.map((row) => renderPipeRow(row))
  ];
  return lines.join("\n");
}

function normalizeRow(
  row: DocumentTableRow,
  columnCount: number,
  warnings: string[],
  options: MarkdownExportOptions
): string[] {
  if (row.cells.length !== columnCount) {
    warnings.push("table-irregular-row");
  }

  return Array.from({ length: columnCount }, (_, index) => {
    const cell = row.cells[index];
    return cell === undefined ? "" : renderPipeCell(cell, warnings, options);
  });
}

function renderPipeRow(cells: readonly string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function renderPipeCell(
  cell: DocumentTableCell,
  warnings: string[],
  options: MarkdownExportOptions
): string {
  return cell.blocks
    .map((block) => {
      if (block.kind === "paragraph") {
        return renderParagraphText(block, warnings);
      }

      if (block.kind === "image") {
        return renderImageMarkdown(block, warnings, options);
      }

      return renderTableHtml(block, warnings, options);
    })
    .map((entry) => escapePipeCell(entry))
    .filter((entry) => entry.length > 0)
    .join("<br>");
}

function renderTableHtml(
  table: TableBlock,
  warnings: string[],
  options: MarkdownExportOptions
): string {
  const rows = table.rows.map((row, rowIndex) =>
    `<tr>${row.cells.map((cell) => renderHtmlCell(cell, rowIndex === 0, warnings, options)).join("")}</tr>`
  );
  return `<table><tbody>${rows.join("")}</tbody></table>`;
}

function renderHtmlCell(
  cell: DocumentTableCell,
  isHeader: boolean,
  warnings: string[],
  options: MarkdownExportOptions
): string {
  const tag = isHeader ? "th" : "td";
  const content = cell.blocks.map((block) => renderHtmlBlock(block, warnings, options)).join("");
  return `<${tag}>${content}</${tag}>`;
}

function renderHtmlBlock(
  block: DocumentBlock,
  warnings: string[],
  options: MarkdownExportOptions
): string {
  if (block.kind === "paragraph") {
    return `<p>${renderHtmlParagraphText(block, warnings)}</p>`;
  }

  if (block.kind === "image") {
    const alt = escapeHtml(block.altText ?? block.caption ?? "image");
    const source = escapeHtml(resolveMarkdownImageSource(block, warnings, options));
    if (source.length === 0) {
      warnings.push("image-source-missing");
    }
    return `<img alt="${alt}" src="${source}" />`;
  }

  return renderTableHtml(block, warnings, options);
}

function renderHtmlParagraphText(paragraph: ParagraphBlock, warnings: string[]): string {
  if (paragraph.runs.length === 0) {
    return escapeHtml(paragraph.text);
  }

  const joinedText = paragraph.runs.map((run) => run.text).join("");
  if (joinedText !== paragraph.text) {
    warnings.push("paragraph-runs-incomplete");
    return escapeHtml(paragraph.text);
  }

  return paragraph.runs.map((run) => renderHtmlRun(run)).join("");
}

function renderHtmlRun(run: TextRun): string {
  const text = escapeHtml(run.text);
  const isBold = run.textStyle.bold === true;
  const isItalic = run.textStyle.italic === true;

  if (isBold && isItalic) {
    return `<strong><em>${text}</em></strong>`;
  }

  if (isBold) {
    return `<strong>${text}</strong>`;
  }

  if (isItalic) {
    return `<em>${text}</em>`;
  }

  return text;
}

function containsNestedTable(table: TableBlock): boolean {
  return table.rows.some((row) => row.cells.some((cell) => cell.blocks.some(hasNestedTableBlock)));
}

function hasNestedTableBlock(block: DocumentBlock): boolean {
  if (block.kind === "table") {
    return true;
  }

  return false;
}

function resolveMarkdownImageSource(
  image: ImageBlock,
  warnings: string[],
  options: MarkdownExportOptions
): string {
  if (options.includeImagesAsDataUrls === true) {
    if (typeof image.base64 === "string" && image.base64.length > 0) {
      return `data:${resolveImageMimeType(image)};base64,${image.base64}`;
    }

    warnings.push("image-base64-missing");
  }

  return image.source ?? "";
}

function resolveImageMimeType(image: ImageBlock): string {
  if (typeof image.mimeType === "string" && image.mimeType.length > 0) {
    if (image.mimeType === "application/octet-stream") {
      return inferMimeTypeFromSource(image.source) ?? image.mimeType;
    }

    return image.mimeType;
  }

  return inferMimeTypeFromSource(image.source) ?? "application/octet-stream";
}

function inferMimeTypeFromSource(source: string | undefined): string | undefined {
  if (typeof source !== "string") {
    return undefined;
  }

  const extension = /\.([A-Za-z0-9]+)(?:$|[?#])/.exec(source)?.[1]?.toLowerCase();
  const mimeTypesByExtension: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    webp: "image/webp",
    wmf: "image/wmf"
  };
  return extension === undefined ? undefined : mimeTypesByExtension[extension];
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\`*_[\]{}()#+.!|-])/g, "\\$1");
}

function escapeImageAltText(value: string): string {
  return value.replace(/([\\\]])/g, "\\$1");
}

function escapePipeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}
