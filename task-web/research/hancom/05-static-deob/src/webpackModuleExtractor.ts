import fs from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

export interface WebpackExtractedModule {
  moduleId: string;
  factorySource: string;
  start: number;
  end: number;
}

export interface WebpackModuleContainer {
  containerKind: "main" | "chunk";
  chunkIds: number[];
  modules: WebpackExtractedModule[];
}

export interface MaterializedWebpackModule {
  moduleId: string;
  outputFilePath: string;
  bytes: number;
}

export interface MaterializedWebpackModuleContainer {
  containerKind: "main" | "chunk";
  chunkIds: number[];
  sourcePath: string;
  outputDirectory: string;
  modules: MaterializedWebpackModule[];
}

export interface WebpackModuleExtractionLayout {
  moduleRoot: string;
  indexPath: string;
  containers: MaterializedWebpackModuleContainer[];
  totalModuleCount: number;
}

export function extractWebpackModuleContainers(sourceText: string): WebpackModuleContainer[] {
  const sourceFile = ts.createSourceFile("bundle.js", sourceText, ts.ScriptTarget.Latest, true);
  const pushCandidates: WebpackModuleContainer[] = [];
  const variableCandidates: WebpackModuleContainer[] = [];
  const seenStarts = new Set<number>();

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const pushCandidate = readPushCandidate(node, sourceText, sourceFile);
      if (pushCandidate !== null && !seenStarts.has(pushCandidate.modules[0]?.start ?? -1)) {
        pushCandidates.push(pushCandidate);
        const firstStart = pushCandidate.modules[0]?.start;
        if (firstStart !== undefined) {
          seenStarts.add(firstStart);
        }
      }
    }

    if (ts.isVariableDeclaration(node)) {
      const variableCandidate = readVariableCandidate(node, sourceText, sourceFile);
      if (variableCandidate !== null && !seenStarts.has(variableCandidate.modules[0]?.start ?? -1)) {
        variableCandidates.push(variableCandidate);
        const firstStart = variableCandidate.modules[0]?.start;
        if (firstStart !== undefined) {
          seenStarts.add(firstStart);
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (pushCandidates.length > 0) {
    return pushCandidates.sort(compareContainers);
  }

  const bestVariableCandidate = variableCandidates.sort(compareContainers)[0];
  return bestVariableCandidate === undefined ? [] : [bestVariableCandidate];
}

export async function materializeWebpackModuleContainers(
  artifactRoot: string,
  bundleFiles: Array<{
    containerKind: "main" | "chunk";
    chunkIds: number[];
    sourcePath: string;
  }>
): Promise<WebpackModuleExtractionLayout> {
  const moduleRoot = path.join(artifactRoot, "readable", "modules");
  const containers: MaterializedWebpackModuleContainer[] = [];

  await fs.mkdir(moduleRoot, {
    recursive: true
  });

  for (const bundleFile of bundleFiles) {
    const sourceText = await fs.readFile(bundleFile.sourcePath, "utf8");
    const extractedContainers = extractWebpackModuleContainers(sourceText).filter(
      (container) => container.containerKind === bundleFile.containerKind
    );

    for (const container of extractedContainers) {
      const outputDirectory =
        container.containerKind === "main"
          ? path.join(moduleRoot, "main")
          : path.join(moduleRoot, "chunks", container.chunkIds.join("-"));
      await fs.mkdir(outputDirectory, {
        recursive: true
      });

      const modules: MaterializedWebpackModule[] = [];
      for (const extractedModule of container.modules) {
        const outputFilePath = path.join(
          outputDirectory,
          `${sanitizeModuleId(extractedModule.moduleId)}.module.js`
        );
        const fileText = buildModuleFileText(container, bundleFile.sourcePath, extractedModule);
        await fs.writeFile(outputFilePath, fileText);
        modules.push({
          moduleId: extractedModule.moduleId,
          outputFilePath,
          bytes: Buffer.byteLength(fileText, "utf8")
        });
      }

      containers.push({
        containerKind: container.containerKind,
        chunkIds: container.chunkIds,
        sourcePath: bundleFile.sourcePath,
        outputDirectory,
        modules
      });
    }
  }

  const indexPath = path.join(moduleRoot, "module-index.json");
  const totalModuleCount = containers.reduce((sum, container) => sum + container.modules.length, 0);
  await fs.writeFile(
    indexPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        moduleRoot,
        totalModuleCount,
        containers
      },
      null,
      2
    )
  );

  return {
    moduleRoot,
    indexPath,
    containers,
    totalModuleCount
  };
}

function readPushCandidate(
  node: ts.CallExpression,
  sourceText: string,
  sourceFile: ts.SourceFile
): WebpackModuleContainer | null {
  if (
    !ts.isPropertyAccessExpression(node.expression) ||
    node.expression.name.text !== "push" ||
    node.arguments.length !== 1
  ) {
    return null;
  }

  const onlyArgument = node.arguments[0];
  if (onlyArgument === undefined || !ts.isArrayLiteralExpression(onlyArgument) || onlyArgument.elements.length < 2) {
    return null;
  }

  const chunkList = onlyArgument.elements[0];
  const moduleMap = onlyArgument.elements[1];
  if (
    chunkList === undefined ||
    moduleMap === undefined ||
    !ts.isArrayLiteralExpression(chunkList) ||
    !ts.isObjectLiteralExpression(moduleMap)
  ) {
    return null;
  }

  const chunkIds = chunkList.elements
    .map(readNumericLiteralValue)
    .filter((value): value is number => value !== null);
  const modules = readModulesFromObjectLiteral(moduleMap, sourceText, sourceFile);
  if (modules.length === 0) {
    return null;
  }

  return {
    containerKind: "chunk",
    chunkIds,
    modules
  };
}

function readVariableCandidate(
  node: ts.VariableDeclaration,
  sourceText: string,
  sourceFile: ts.SourceFile
): WebpackModuleContainer | null {
  if (!node.initializer || !ts.isObjectLiteralExpression(node.initializer)) {
    return null;
  }

  const modules = readModulesFromObjectLiteral(node.initializer, sourceText, sourceFile);
  if (modules.length === 0) {
    return null;
  }

  return {
    containerKind: "main",
    chunkIds: [],
    modules
  };
}

function readModulesFromObjectLiteral(
  objectLiteral: ts.ObjectLiteralExpression,
  sourceText: string,
  sourceFile: ts.SourceFile
): WebpackExtractedModule[] {
  const modules: WebpackExtractedModule[] = [];

  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const moduleId = readModuleId(property.name);
    if (moduleId === null) {
      continue;
    }

    const initializer = unwrapExpression(property.initializer);
    if (!isWebpackFactoryExpression(initializer)) {
      continue;
    }

    const start = initializer.getStart(sourceFile);
    const end = initializer.getEnd();
    modules.push({
      moduleId,
      factorySource: sourceText.slice(start, end),
      start,
      end
    });
  }

  return modules.sort((left, right) => Number(left.moduleId) - Number(right.moduleId));
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }

  return current;
}

function isWebpackFactoryExpression(expression: ts.Expression): boolean {
  return ts.isFunctionExpression(expression) || ts.isArrowFunction(expression);
}

function readModuleId(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name)) {
    return /^\d+$/.test(name.text) ? name.text : null;
  }
  if (ts.isNumericLiteral(name)) {
    return name.text;
  }
  if (ts.isStringLiteral(name)) {
    return /^\d+$/.test(name.text) ? name.text : null;
  }

  return null;
}

function readNumericLiteralValue(node: ts.Expression): number | null {
  if (!ts.isNumericLiteral(node)) {
    return null;
  }

  const value = Number.parseInt(node.text, 10);
  return Number.isNaN(value) ? null : value;
}

function compareContainers(left: WebpackModuleContainer, right: WebpackModuleContainer): number {
  if (left.modules.length !== right.modules.length) {
    return right.modules.length - left.modules.length;
  }

  const leftStart = left.modules[0]?.start ?? Number.MAX_SAFE_INTEGER;
  const rightStart = right.modules[0]?.start ?? Number.MAX_SAFE_INTEGER;
  return leftStart - rightStart;
}

function sanitizeModuleId(moduleId: string): string {
  return moduleId.replace(/[^A-Za-z0-9_-]+/g, "_");
}

function buildModuleFileText(
  container: WebpackModuleContainer,
  sourcePath: string,
  extractedModule: WebpackExtractedModule
): string {
  const containerLabel =
    container.containerKind === "main"
      ? "main"
      : `chunk:${container.chunkIds.length > 0 ? container.chunkIds.join(",") : "unknown"}`;
  return [
    "/*",
    ` * webpack-container: ${containerLabel}`,
    ` * webpack-module-id: ${extractedModule.moduleId}`,
    ` * source: ${sourcePath}`,
    " */",
    extractedModule.factorySource,
    ""
  ].join("\n");
}
