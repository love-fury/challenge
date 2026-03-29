import fs from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

import type { WebpackModuleExtractionLayout } from "./webpackModuleExtractor.js";

export interface HeuristicModuleImport {
  localName: string | null;
  requiredModuleId: string;
}

export interface HeuristicModuleExport {
  exportName: string;
  targetName: string | null;
  kind: "default" | "named" | "commonjs";
}

export interface HeuristicModulePart {
  label: string;
  outputFilePath: string;
  line: number;
}

export interface HeuristicModuleSummary {
  containerLabel: string;
  moduleId: string;
  sourcePath: string;
  bytes: number;
  guessedName: string;
  guessedTags: string[];
  namedModulePath: string;
  imports: HeuristicModuleImport[];
  exports: HeuristicModuleExport[];
  topLevelSymbols: string[];
  parts: HeuristicModulePart[];
  notes: string[];
}

export interface HeuristicReconstructionLayout {
  heuristicRoot: string;
  indexPath: string;
  readmePath: string;
  moduleCount: number;
  summaries: HeuristicModuleSummary[];
}

interface ParsedFactoryContext {
  sourceFile: ts.SourceFile;
  factorySource: string;
  factoryNode: ts.FunctionExpression | ts.ArrowFunction;
  body: ts.Block;
  requireParamName: string | null;
  exportsParamName: string | null;
  moduleParamName: string | null;
}

interface NameRuleMatch {
  tag: string;
  score: number;
}

export async function createHeuristicReconstruction(
  artifactRoot: string,
  moduleLayout: WebpackModuleExtractionLayout
): Promise<HeuristicReconstructionLayout> {
  const heuristicRoot = path.join(artifactRoot, "readable", "heuristic");
  const modulesRoot = path.join(heuristicRoot, "modules");
  const partsRoot = path.join(heuristicRoot, "parts");
  const summaries: HeuristicModuleSummary[] = [];

  await fs.rm(heuristicRoot, {
    recursive: true,
    force: true
  });
  await fs.mkdir(modulesRoot, {
    recursive: true
  });
  await fs.mkdir(partsRoot, {
    recursive: true
  });

  for (const container of moduleLayout.containers) {
    const containerLabel =
      container.containerKind === "main"
        ? "main"
        : `chunk-${container.chunkIds.length > 0 ? container.chunkIds.join("-") : "unknown"}`;

    for (const module of container.modules) {
      const sourceText = await fs.readFile(module.outputFilePath, "utf8");
      const parsed = parseWebpackFactory(sourceText);
      if (parsed === null) {
        continue;
      }

      const analysis = analyzeWebpackFactory(
        parsed,
        containerLabel,
        container.sourcePath,
        module.moduleId,
        module.bytes
      );
      const namedModuleDirectory = path.join(modulesRoot, containerLabel);
      const partDirectory = path.join(partsRoot, containerLabel, `${module.moduleId}-${analysis.guessedName}`);
      await fs.mkdir(namedModuleDirectory, {
        recursive: true
      });
      await fs.mkdir(partDirectory, {
        recursive: true
      });

      const namedModulePath = path.join(
        namedModuleDirectory,
        `${module.moduleId}-${analysis.guessedName}.module.js`
      );
      await fs.writeFile(namedModulePath, buildNamedModuleText(sourceText, analysis));

      const parts = await materializeModuleParts(partDirectory, parsed, analysis);
      summaries.push({
        containerLabel,
        moduleId: module.moduleId,
        sourcePath: module.outputFilePath,
        bytes: module.bytes,
        guessedName: analysis.guessedName,
        guessedTags: analysis.guessedTags,
        namedModulePath,
        imports: analysis.imports,
        exports: analysis.exports,
        topLevelSymbols: analysis.topLevelSymbols,
        parts,
        notes: analysis.notes
      });
    }
  }

  summaries.sort(compareSummaries);

  const indexPath = path.join(heuristicRoot, "heuristic-index.json");
  const readmePath = path.join(heuristicRoot, "README.md");
  await fs.writeFile(
    indexPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        heuristicRoot,
        moduleCount: summaries.length,
        summaries
      },
      null,
      2
    )
  );
  await fs.writeFile(readmePath, buildHeuristicReadme(indexPath, summaries));

  return {
    heuristicRoot,
    indexPath,
    readmePath,
    moduleCount: summaries.length,
    summaries
  };
}

function parseWebpackFactory(moduleFileText: string): ParsedFactoryContext | null {
  const factorySource = stripModuleMetadataComment(moduleFileText);
  if (factorySource.length === 0) {
    return null;
  }

  const wrappedText = `const __factory = ${factorySource};`;
  const sourceFile = ts.createSourceFile("wrapped-factory.ts", wrappedText, ts.ScriptTarget.Latest, true);
  const firstStatement = sourceFile.statements[0];
  if (
    firstStatement === undefined ||
    !ts.isVariableStatement(firstStatement) ||
    firstStatement.declarationList.declarations.length !== 1
  ) {
    return null;
  }

  const declaration = firstStatement.declarationList.declarations[0];
  const initializer = declaration?.initializer;
  if (
    initializer === undefined ||
    (!ts.isFunctionExpression(initializer) && !ts.isArrowFunction(initializer)) ||
    !ts.isBlock(initializer.body)
  ) {
    return null;
  }

  return {
    sourceFile,
    factorySource,
    factoryNode: initializer,
    body: initializer.body,
    moduleParamName: readParamName(initializer.parameters[0]),
    exportsParamName: readParamName(initializer.parameters[1]),
    requireParamName: readParamName(initializer.parameters[2])
  };
}

function stripModuleMetadataComment(text: string): string {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("/*")) {
    return trimmed;
  }

  const closingIndex = trimmed.indexOf("*/");
  if (closingIndex === -1) {
    return trimmed;
  }

  return trimmed.slice(closingIndex + 2).trimStart();
}

function analyzeWebpackFactory(
  parsed: ParsedFactoryContext,
  containerLabel: string,
  containerSourcePath: string,
  moduleId: string,
  bytes: number
): Omit<HeuristicModuleSummary, "sourcePath" | "namedModulePath" | "parts"> {
  const imports = collectImports(parsed);
  const exports = collectExports(parsed);
  const topLevelSymbols = collectTopLevelSymbols(parsed);
  const guessedTags = inferHeuristicTags(
    parsed,
    containerLabel,
    containerSourcePath,
    moduleId,
    bytes,
    exports,
    topLevelSymbols
  );
  const guessedName =
    guessedTags[0] ??
    buildFallbackModuleName(containerLabel, containerSourcePath, moduleId, exports, topLevelSymbols);
  const notes = buildHeuristicNotes(imports, exports, topLevelSymbols, guessedTags);

  return {
    containerLabel,
    moduleId,
    bytes,
    guessedName,
    guessedTags,
    imports,
    exports,
    topLevelSymbols,
    notes
  };
}

function collectImports(parsed: ParsedFactoryContext): HeuristicModuleImport[] {
  const results: HeuristicModuleImport[] = [];
  const requireParamName = parsed.requireParamName;
  if (requireParamName === null) {
    return results;
  }

  for (const statement of parsed.body.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer;
      if (
        initializer === undefined ||
        !ts.isCallExpression(initializer) ||
        !ts.isIdentifier(initializer.expression) ||
        initializer.expression.text !== requireParamName
      ) {
        continue;
      }

      const firstArgument = initializer.arguments[0];
      if (firstArgument === undefined || !ts.isNumericLiteral(firstArgument)) {
        continue;
      }

      results.push({
        localName: ts.isIdentifier(declaration.name) ? declaration.name.text : null,
        requiredModuleId: firstArgument.text
      });
    }
  }

  return results;
}

function collectExports(parsed: ParsedFactoryContext): HeuristicModuleExport[] {
  const results: HeuristicModuleExport[] = [];
  const requireParamName = parsed.requireParamName;
  const exportsParamName = parsed.exportsParamName;
  const moduleParamName = parsed.moduleParamName;

  for (const statement of parsed.body.statements) {
    if (
      requireParamName !== null &&
      ts.isExpressionStatement(statement) &&
      ts.isCallExpression(statement.expression) &&
      ts.isPropertyAccessExpression(statement.expression.expression) &&
      ts.isIdentifier(statement.expression.expression.expression) &&
      statement.expression.expression.expression.text === requireParamName &&
      statement.expression.expression.name.text === "d"
    ) {
      const descriptor = statement.expression.arguments[1];
      if (descriptor !== undefined && ts.isObjectLiteralExpression(descriptor)) {
        for (const property of descriptor.properties) {
          if (!ts.isPropertyAssignment(property)) {
            continue;
          }
          const exportName = readPropertyName(property.name);
          const targetName = readArrowReturnIdentifier(property.initializer);
          if (exportName !== null) {
            results.push({
              exportName,
              targetName,
              kind: exportName === "default" ? "default" : "named"
            });
          }
        }
      }
      continue;
    }

    if (
      moduleParamName !== null &&
      ts.isExpressionStatement(statement) &&
      ts.isBinaryExpression(statement.expression) &&
      statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(statement.expression.left) &&
      ts.isIdentifier(statement.expression.left.expression) &&
      statement.expression.left.expression.text === moduleParamName &&
      statement.expression.left.name.text === "exports"
    ) {
      results.push({
        exportName: "module.exports",
        targetName: readIdentifierLike(statement.expression.right),
        kind: "commonjs"
      });
      continue;
    }

    if (
      exportsParamName !== null &&
      ts.isExpressionStatement(statement) &&
      ts.isBinaryExpression(statement.expression) &&
      statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(statement.expression.left) &&
      ts.isIdentifier(statement.expression.left.expression) &&
      statement.expression.left.expression.text === exportsParamName
    ) {
      results.push({
        exportName: statement.expression.left.name.text,
        targetName: readIdentifierLike(statement.expression.right),
        kind: statement.expression.left.name.text === "default" ? "default" : "named"
      });
    }
  }

  return dedupeExports(results);
}

function collectTopLevelSymbols(parsed: ParsedFactoryContext): string[] {
  const symbols: string[] = [];

  for (const statement of parsed.body.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
      symbols.push(statement.name.text);
      continue;
    }
    if (ts.isClassDeclaration(statement) && statement.name !== undefined) {
      symbols.push(statement.name.text);
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          symbols.push(declaration.name.text);
        }
      }
    }
  }

  return Array.from(new Set(symbols));
}

function inferHeuristicTags(
  parsed: ParsedFactoryContext,
  containerLabel: string,
  containerSourcePath: string,
  moduleId: string,
  bytes: number,
  exports: readonly HeuristicModuleExport[],
  topLevelSymbols: readonly string[]
): string[] {
  const content = parsed.body.getText(parsed.sourceFile);
  const sourceBaseName = readContainerSourceBaseName(containerSourcePath);
  const matches: NameRuleMatch[] = [];

  const addMatch = (tag: string, score: number): void => {
    matches.push({
      tag,
      score
    });
  };

  if (content.includes("jQuery requires a window with a document") || content.includes("jquery: K")) {
    addMatch("jquery_3_6_0", 100);
  }
  if (content.includes("./bg/general.js") && content.includes("MODULE_NOT_FOUND")) {
    addMatch("locale_async_context_loader", 95);
  }
  if (sourceBaseName !== null && /^nls\d+$/i.test(sourceBaseName)) {
    addMatch(`locale_strings_${sourceBaseName.toLowerCase()}`, 89);
  }
  if (sourceBaseName === "root") {
    addMatch("locale_strings_root", 89);
  }
  if (content.includes("HWP_EDITOR") || content.includes("webhwp") || content.includes("showDownloadViewer")) {
    addMatch("webhwp_app_bootstrap", 90);
  }
  if (content.includes("UI_WIDGET_MAP") && content.includes("FRAMEWORK_MODEL")) {
    addMatch("ui_framework_model_store", 92);
  }
  if (content.includes("AutoStyle_") || content.includes("HWPJSON") || content.includes("application/")) {
    addMatch("hwp_constants_registry", 88);
  }
  if (containerLabel.startsWith("chunk-") && content.includes("LangDefine") && content.includes("general.js")) {
    addMatch("locale_dictionary_bundle", 85);
  }
  if (
    containerLabel.startsWith("chunk-") &&
    (content.includes("HncCustomFontInfos") || sourceBaseName === "HncCustomFontInfos")
  ) {
    addMatch("custom_font_catalog", 84);
  }
  if (topLevelSymbols.includes("initialize") && content.includes("tooltipLayerOn")) {
    addMatch("ui_widget_registry", 82);
  }
  if (exports.some((entry) => entry.kind === "default") && bytes > 500_000 && containerLabel === "chunk-431") {
    addMatch("hwp_app_entry_default", 80);
  }
  if (exports.some((entry) => entry.exportName === "Z")) {
    addMatch("default_named_Z_export", 20);
  }
  if (bytes > 900_000) {
    addMatch("large_runtime_registry", 10);
  }
  if (moduleId === "417") {
    addMatch("locale_async_context_loader", 96);
  }
  if (moduleId === "5910") {
    addMatch("jquery_3_6_0", 101);
  }

  return Array.from(
    new Map(
      matches
        .sort((left, right) => right.score - left.score || left.tag.localeCompare(right.tag))
        .map((match) => [match.tag, match])
    ).values()
  ).map((match) => match.tag);
}

function buildFallbackModuleName(
  containerLabel: string,
  containerSourcePath: string,
  moduleId: string,
  exports: readonly HeuristicModuleExport[],
  topLevelSymbols: readonly string[]
): string {
  const sourceBaseName = readContainerSourceBaseName(containerSourcePath);
  if (sourceBaseName !== null && /^[A-Za-z][A-Za-z0-9_-]*$/.test(sourceBaseName)) {
    return sanitizeSlug(`${sourceBaseName}_module`);
  }
  const defaultExport = exports.find((entry) => entry.kind === "default" && entry.targetName !== null);
  if (defaultExport?.targetName !== undefined && defaultExport.targetName !== null) {
    return sanitizeSlug(`${defaultExport.targetName}_module`);
  }
  const firstSymbol = topLevelSymbols[0];
  if (firstSymbol !== undefined) {
    return sanitizeSlug(`${firstSymbol}_module`);
  }

  return sanitizeSlug(`${containerLabel}_${moduleId}_module`);
}

function readContainerSourceBaseName(containerSourcePath: string): string | null {
  const basename = path.basename(containerSourcePath);
  const match = basename.match(/^\d+-([^.]+)\.deobfuscated\.js$/);
  if (match?.[1] !== undefined) {
    return match[1];
  }
  if (basename === "main.deobfuscated.js") {
    return "main";
  }

  return null;
}

function buildHeuristicNotes(
  imports: readonly HeuristicModuleImport[],
  exports: readonly HeuristicModuleExport[],
  topLevelSymbols: readonly string[],
  guessedTags: readonly string[]
): string[] {
  const notes: string[] = [];
  if (imports.length > 0) {
    notes.push(`imports ${imports.length} webpack modules`);
  }
  if (exports.length > 0) {
    notes.push(`exports ${exports.map((entry) => entry.exportName).join(", ")}`);
  }
  if (topLevelSymbols.length > 0) {
    notes.push(`top-level symbols: ${topLevelSymbols.slice(0, 8).join(", ")}`);
  }
  if (guessedTags.length > 1) {
    notes.push(`alternate tags: ${guessedTags.slice(1).join(", ")}`);
  }

  return notes;
}

async function materializeModuleParts(
  partDirectory: string,
  parsed: ParsedFactoryContext,
  summary: Omit<HeuristicModuleSummary, "sourcePath" | "namedModulePath" | "parts">
): Promise<HeuristicModulePart[]> {
  const parts: HeuristicModulePart[] = [];
  let partIndex = 1;

  for (const statement of parsed.body.statements) {
    const label = describeStatementLabel(statement, parsed);
    const outputFilePath = path.join(
      partDirectory,
      `${String(partIndex).padStart(2, "0")}-${sanitizeSlug(label)}.js`
    );
    const line = parsed.sourceFile.getLineAndCharacterOfPosition(statement.getStart(parsed.sourceFile)).line + 1;
    const content = [
      "/*",
      ` * heuristic-module: ${summary.guessedName}`,
      ` * webpack-module-id: ${summary.moduleId}`,
      ` * part: ${label}`,
      ` * line: ${line}`,
      " */",
      statement.getText(parsed.sourceFile),
      ""
    ].join("\n");
    await fs.writeFile(outputFilePath, content);
    parts.push({
      label,
      outputFilePath,
      line
    });
    partIndex += 1;
  }

  return parts;
}

function describeStatementLabel(statement: ts.Statement, parsed: ParsedFactoryContext): string {
  if (ts.isFunctionDeclaration(statement)) {
    return statement.name?.text ?? "anonymous_function";
  }
  if (ts.isClassDeclaration(statement)) {
    return statement.name?.text ?? "anonymous_class";
  }
  if (ts.isVariableStatement(statement)) {
    const labels = statement.declarationList.declarations
      .map((declaration) => describeVariableDeclaration(declaration, parsed))
      .filter((label): label is string => label !== null);
    return labels[0] ?? "variable_statement";
  }
  if (ts.isReturnStatement(statement)) {
    return "return_statement";
  }
  if (ts.isIfStatement(statement)) {
    return "if_statement";
  }
  if (ts.isExpressionStatement(statement)) {
    return describeExpressionLabel(statement.expression, parsed);
  }

  return ts.SyntaxKind[statement.kind]?.toLowerCase() ?? "statement";
}

function describeVariableDeclaration(
  declaration: ts.VariableDeclaration,
  parsed: ParsedFactoryContext
): string | null {
  if (!ts.isIdentifier(declaration.name)) {
    return null;
  }

  const requireParamName = parsed.requireParamName;
  if (
    requireParamName !== null &&
    declaration.initializer !== undefined &&
    ts.isCallExpression(declaration.initializer) &&
    ts.isIdentifier(declaration.initializer.expression) &&
    declaration.initializer.expression.text === requireParamName &&
    declaration.initializer.arguments[0] !== undefined &&
    ts.isNumericLiteral(declaration.initializer.arguments[0])
  ) {
    return `require_${declaration.initializer.arguments[0].text}`;
  }

  return declaration.name.text;
}

function describeExpressionLabel(expression: ts.Expression, parsed: ParsedFactoryContext): string {
  const requireParamName = parsed.requireParamName;
  const moduleParamName = parsed.moduleParamName;
  const exportsParamName = parsed.exportsParamName;

  if (
    requireParamName !== null &&
    ts.isCallExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression) &&
    ts.isIdentifier(expression.expression.expression) &&
    expression.expression.expression.text === requireParamName
  ) {
    if (expression.expression.name.text === "r") {
      return "mark_es_module";
    }
    if (expression.expression.name.text === "d") {
      return "define_exports";
    }
  }

  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isPropertyAccessExpression(expression.left)
  ) {
    if (
      moduleParamName !== null &&
      ts.isIdentifier(expression.left.expression) &&
      expression.left.expression.text === moduleParamName &&
      expression.left.name.text === "exports"
    ) {
      return "assign_module_exports";
    }
    if (
      exportsParamName !== null &&
      ts.isIdentifier(expression.left.expression) &&
      expression.left.expression.text === exportsParamName
    ) {
      return `assign_export_${expression.left.name.text}`;
    }
  }

  return "expression_statement";
}

function buildNamedModuleText(
  originalModuleText: string,
  summary: Omit<HeuristicModuleSummary, "sourcePath" | "namedModulePath" | "parts">
): string {
  return [
    "/*",
    ` * heuristic-name: ${summary.guessedName}`,
    ` * heuristic-tags: ${summary.guessedTags.join(", ") || "(none)"}`,
    ` * imports: ${summary.imports.map((entry) => `${entry.localName ?? "_"}<=${entry.requiredModuleId}`).join(", ") || "(none)"}`,
    ` * exports: ${summary.exports.map((entry) => `${entry.exportName}:${entry.targetName ?? "unknown"}`).join(", ") || "(none)"}`,
    ` * top-level-symbols: ${summary.topLevelSymbols.join(", ") || "(none)"}`,
    ` * notes: ${summary.notes.join(" | ") || "(none)"}`,
    " */",
    originalModuleText.trimEnd(),
    ""
  ].join("\n");
}

function buildHeuristicReadme(indexPath: string, summaries: readonly HeuristicModuleSummary[]): string {
  const interesting = summaries
    .filter((summary) => summary.guessedTags.length > 0 || summary.parts.length > 8)
    .slice(0, 25);

  return [
    "# Heuristic Reconstruction",
    "",
    "## Overview",
    "",
    `- Heuristic index: \`${indexPath}\``,
    `- Reconstructed modules: \`${summaries.length}\``,
    "",
    "## Priority Modules",
    "",
    "| Container | Module | Heuristic Name | Tags | Parts | Named File |",
    "| --- | ---: | --- | --- | ---: | --- |",
    ...interesting.map(
      (summary) =>
        `| ${summary.containerLabel} | ${summary.moduleId} | ${summary.guessedName} | ${summary.guessedTags.join(", ") || "(none)"} | ${summary.parts.length} | \`${summary.namedModulePath}\` |`
    ),
    "",
    "## Notes",
    "",
    "- `modules/` contains named copies of each webpack module with heuristic metadata headers.",
    "- `parts/` contains top-level synthetic splits for each webpack module.",
    "- Names are heuristic guesses and must not be treated as confirmed architecture without runtime validation.",
    ""
  ].join("\n");
}

function compareSummaries(left: HeuristicModuleSummary, right: HeuristicModuleSummary): number {
  return (
    left.containerLabel.localeCompare(right.containerLabel) ||
    Number(left.moduleId) - Number(right.moduleId)
  );
}

function readParamName(parameter: ts.ParameterDeclaration | undefined): string | null {
  if (parameter === undefined || !ts.isIdentifier(parameter.name)) {
    return null;
  }

  return parameter.name.text;
}

function readPropertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
}

function readArrowReturnIdentifier(initializer: ts.Expression): string | null {
  if (!ts.isArrowFunction(initializer)) {
    return readIdentifierLike(initializer);
  }
  if (ts.isIdentifier(initializer.body)) {
    return initializer.body.text;
  }
  if (
    ts.isParenthesizedExpression(initializer.body) &&
    ts.isIdentifier(initializer.body.expression)
  ) {
    return initializer.body.expression.text;
  }

  return null;
}

function readIdentifierLike(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }

  return null;
}

function dedupeExports(exports: readonly HeuristicModuleExport[]): HeuristicModuleExport[] {
  return Array.from(
    new Map(
      exports.map((entry) => [`${entry.kind}:${entry.exportName}:${entry.targetName ?? ""}`, entry])
    ).values()
  );
}

function sanitizeSlug(value: string): string {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return normalized.length > 0 ? normalized : "module";
}
