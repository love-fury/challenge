import type { HancomDocument, JsonExportOptions, JsonExportPayload } from "../models/types.js";

const JSON_SCHEMA_VERSION = "2026-03-29" as const;

export function exportDocumentToJson(
  document: HancomDocument,
  options: JsonExportOptions = {}
): string {
  const payload: JsonExportPayload = {
    schemaVersion: JSON_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    document: {
      metadata: document.metadata,
      capabilities: document.capabilities,
      blocks: document.blocks
    },
    ...(options.includeWarnings === false ? {} : { warnings: uniqueStrings(document.warnings) }),
    ...(options.includeRawSnapshot === true && document.raw !== undefined
      ? { rawSnapshot: document.raw }
      : {})
  };

  return JSON.stringify(payload, null, options.pretty === false ? undefined : 2);
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}
