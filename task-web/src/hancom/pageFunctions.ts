import type {
  ActionManagerSurfaceSummary,
  CommandSurfaceSummary,
  DocumentTextChainNode,
  DocumentTextChainReport,
  DocumentSurfaceSummary,
  EditorFrameSummary,
  EditorProbeSummary,
  HancomDocument,
  HwpJson20DocumentSnapshot,
  ParagraphBlock,
  ParagraphFormatting,
  ParagraphStyleVariant,
  RuntimeInventoryReport,
  RuntimeObjectSummary,
  SampleFieldSummary,
  TextRun,
  TextStyle
} from "../models/types.js";
import type { HancomRuntimeGlobal } from "../models/runtime.js";

type HancomRuntimeRecord = HancomRuntimeGlobal & Record<string, unknown>;

export function pageReadHwpJson20Snapshot(): HwpJson20DocumentSnapshot | null {
  const globals = globalThis as HancomRuntimeGlobal;
  const serializerFactory = globals.HwpApp?.document?.aPt?.();
  const serializer = serializerFactory?.ENt?.();
  if (serializer === undefined) {
    return null;
  }

  if (typeof serializer.save !== "function") {
    return null;
  }

  const snapshot = serializer.save("hwpjson20;");
  if (typeof snapshot !== "object" || snapshot === null) {
    return null;
  }

  return snapshot;
}

export function pageProbeEditorSurface(): EditorProbeSummary {
  const keywordList = ["hancom", "hwp", "editor", "doc", "store", "service", "command"];
  const globals = globalThis as HancomRuntimeRecord;
  const globalRecord: Record<string, unknown> = globals;
  const candidateGlobals = Object.keys(globalRecord)
    .filter((key) => keywordList.some((keyword) => key.toLocaleLowerCase().includes(keyword)))
    .filter((key) => {
      const value = globalRecord[key];
      return typeof value === "function" || (typeof value === "object" && value !== null);
    })
    .slice(0, 25);

  return {
    title: document.title,
    url: location.href,
    readyState: document.readyState,
    canvasCount: document.querySelectorAll("canvas").length,
    hasAutomationHook: false,
    availableHookMethods: [],
    candidateGlobals
  };
}

export function pageDetectPlatform(): string {
  return navigator.platform;
}

export function pageReadCaretState(): {
  nodeId: string | null;
  textOffset: number | null;
  positionType: number | null;
  currentPageNumber: number | null;
} | null {
  const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
    typeof value === "object" && value !== null;
  const globals = globalThis as HancomRuntimeGlobal;
  const app = globals.HwpApp;
  const caret = isRecord(app?.hwpCaret) ? app.hwpCaret : null;
  const nodeWrap = isRecord(caret?.AMe) ? caret.AMe : null;
  const node = isRecord(nodeWrap?.Eni) ? nodeWrap.Eni : null;
  const caretPosition = isRecord(nodeWrap?.Cni) ? nodeWrap.Cni : null;

  if (!isRecord(node) || !isRecord(caretPosition)) {
    return null;
  }

  const caretPageState = isRecord(caret?.uIs) ? caret.uIs : null;
  return {
    nodeId: typeof node.qli === "string" ? node.qli : null,
    textOffset: typeof caretPosition.pos === "number" ? caretPosition.pos : null,
    positionType: typeof caretPosition.type === "number" ? caretPosition.type : null,
    currentPageNumber: typeof caretPageState?.b8t === "number" ? caretPageState.b8t : null
  };
}

export function pageReadCurrentTableCellState(): ParagraphBlock | null {
  const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
    typeof value === "object" && value !== null;
  const readOptionalString = (value: unknown): string | null =>
    typeof value === "string" ? value : null;
  const readOptionalNumber = (value: unknown): number | null =>
    typeof value === "number" ? value : null;
  const decodeUint16Text = (buffer: Uint16Array): string =>
    Array.from(buffer)
      .map((code) => String.fromCharCode(code))
      .join("");
  const removeNullCharacters = (text: string): string => text.split("\0").join("");
  const decodeVisibleColor = (value: unknown): string | undefined => {
    if (typeof value !== "number") {
      return undefined;
    }

    const packed = value >>> 0;
    const red = packed & 0xff;
    const green = (packed >>> 8) & 0xff;
    const blue = (packed >>> 16) & 0xff;
    return `#${[red, green, blue]
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")}`;
  };
  const decodeBold = (value: unknown): boolean | undefined => {
    if (typeof value !== "number") {
      return undefined;
    }

    return (value & 0b10) !== 0;
  };
  const decodeItalic = (value: unknown): boolean | undefined => {
    if (typeof value !== "number") {
      return undefined;
    }

    return (value & 0b1) !== 0;
  };
  const decodeAlignment = (
    value: unknown
  ): ParagraphFormatting["alignment"] | undefined => {
    if (typeof value !== "number") {
      return undefined;
    }

    switch (value) {
      case 260:
        return "left";
      case 264:
        return "right";
      case 268:
        return "center";
      case 384:
        return "justify";
      default:
        return undefined;
    }
  };
  const sanitizeValue = (value: unknown): unknown => {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }

    if (value instanceof Uint16Array || value instanceof Uint32Array) {
      return Array.from(value);
    }

    if (Array.isArray(value)) {
      return value.slice(0, 16).map((item) => sanitizeValue(item));
    }

    if (!isRecord(value)) {
      return undefined;
    }

    const sanitized: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(value).slice(0, 32)) {
      const stringKey = String(key);
      const nextValue = sanitizeValue(value[key]);
      if (nextValue !== undefined) {
        sanitized[stringKey] = nextValue;
      }
    }
    return sanitized;
  };
  const readStyleTableEntry = (
    styleTableRoot: unknown,
    index: number | null
  ): Record<PropertyKey, unknown> | null => {
    if (!isRecord(styleTableRoot) || index === null) {
      return null;
    }

    const entries = styleTableRoot.n4n;
    if (!Array.isArray(entries) || index < 0 || index >= entries.length) {
      return null;
    }

    const entry: unknown = entries[index];
    return isRecord(entry) ? entry : null;
  };
  const readStyleTableEntryByQli = (
    styleTableRoot: unknown,
    qli: string | null
  ): { entry: Record<PropertyKey, unknown>; index: number | null } | null => {
    if (!isRecord(styleTableRoot) || qli === null) {
      return null;
    }

    const entries = styleTableRoot.n4n;
    if (!Array.isArray(entries)) {
      return null;
    }

    const index = entries.findIndex((entry) => isRecord(entry) && entry.qli === qli);
    if (index === -1) {
      return null;
    }

    const entry: unknown = entries[index];
    return isRecord(entry) ? { entry, index } : null;
  };
  const buildParagraphFormatting = (
    charStyle: Record<PropertyKey, unknown> | null,
    paraStyle: Record<PropertyKey, unknown> | null,
    charStyleCode: number | null,
    paraStyleCode: number | null
  ): ParagraphFormatting | undefined => {
    const fontName =
      Array.isArray(charStyle?.aXt) &&
      isRecord(charStyle.aXt[0]) &&
      typeof charStyle.aXt[0].DXt === "string"
        ? charStyle.aXt[0].DXt
        : undefined;
    const fontSize = typeof charStyle?.SXt === "number" ? charStyle.SXt / 100 : undefined;
    const bold = decodeBold(charStyle?.cUt);
    const italic = decodeItalic(charStyle?.cUt);
    const color = decodeVisibleColor(charStyle?.$Xt);
    const alignment = decodeAlignment(paraStyle?.cUt);
    const lineSpacing = typeof paraStyle?.FNi === "number" ? paraStyle.FNi / 100 : undefined;
    const rawCharStyle = sanitizeValue(charStyle);
    const rawParaStyle = sanitizeValue(paraStyle);

    const formatting: ParagraphFormatting = {
      ...(fontName === undefined ? {} : { fontName }),
      ...(fontSize === undefined ? {} : { fontSize }),
      ...(bold === undefined ? {} : { bold }),
      ...(italic === undefined ? {} : { italic }),
      ...(color === undefined ? {} : { color }),
      ...(alignment === undefined ? {} : { alignment }),
      ...(lineSpacing === undefined ? {} : { lineSpacing }),
      ...(charStyleCode === null ? {} : { charStyleCode }),
      ...(paraStyleCode === null ? {} : { paraStyleCode }),
      ...(isRecord(rawCharStyle) ? { rawCharStyle } : {}),
      ...(isRecord(rawParaStyle) ? { rawParaStyle } : {})
    };

    return Object.keys(formatting).length > 0 ? formatting : undefined;
  };
  const formattingToTextStyle = (formatting?: ParagraphFormatting): TextStyle => ({
    ...(formatting?.bold === undefined ? {} : { bold: formatting.bold }),
    ...(formatting?.color === undefined ? {} : { color: formatting.color }),
    ...(formatting?.fontName === undefined ? {} : { fontName: formatting.fontName }),
    ...(formatting?.fontSize === undefined ? {} : { fontSize: formatting.fontSize }),
    ...(formatting?.italic === undefined ? {} : { italic: formatting.italic })
  });
  const formattingToParagraphStyleVariant = (
    formatting?: ParagraphFormatting
  ): ParagraphStyleVariant | undefined => {
    if (formatting?.paraStyleCode === undefined || formatting.paraStyleCode === null) {
      return undefined;
    }

    const rawParaStyle = formatting.rawParaStyle;
    const rawCUt = typeof rawParaStyle?.cUt === "number" ? rawParaStyle.cUt : undefined;
    const rawXli = typeof rawParaStyle?.Xli === "number" ? rawParaStyle.Xli : undefined;
    const rawLNi = typeof rawParaStyle?.LNi === "number" ? rawParaStyle.LNi : undefined;
    const rawWTiMsi =
      isRecord(rawParaStyle?.wTi) && typeof rawParaStyle.wTi.Msi === "number"
        ? rawParaStyle.wTi.Msi
        : undefined;

    return {
      paraStyleCode: formatting.paraStyleCode,
      ...(formatting.lineSpacing === undefined ? {} : { lineSpacing: formatting.lineSpacing }),
      ...(formatting.alignment === undefined ? {} : { alignment: formatting.alignment }),
      ...(rawCUt === undefined ? {} : { rawCUt }),
      ...(rawXli === undefined ? {} : { rawXli }),
      ...(rawLNi === undefined ? {} : { rawLNi }),
      ...(rawWTiMsi === undefined ? {} : { rawWTiMsi })
    };
  };

  const globals = globalThis as typeof globalThis & {
    HwpApp?: Record<PropertyKey, unknown>;
  };
  const app = globals.HwpApp;
  const caret = isRecord(app?.hwpCaret) ? app.hwpCaret : null;
  const nodeWrap = isRecord(caret?.AMe) ? caret.AMe : null;
  const node = isRecord(nodeWrap?.Eni) ? nodeWrap.Eni : null;
  if (node === null) {
    return null;
  }
  const rawNodeText =
    node.Aoi instanceof Uint16Array
      ? removeNullCharacters(decodeUint16Text(node.Aoi))
      : null;
  if (rawNodeText === null) {
    return null;
  }

  const currentNode = node;
  const text = rawNodeText.replace(/\r+$/, "");
  const documentRoot = isRecord(app?.document) ? app.document : null;
  const ivr = isRecord(documentRoot?.Ivr) ? documentRoot.Ivr : null;
  const evr = isRecord(documentRoot?.Evr) ? documentRoot.Evr : null;
  const wVs = isRecord(evr?.wVs) ? evr.wVs : null;
  const pendingQueue = Array.isArray(wVs?.vqs) ? (wVs.vqs as unknown[]) : null;
  const latestPendingEntry: unknown = pendingQueue === null ? null : (pendingQueue.at(-1) ?? null);
  const pendingInsertValue =
    isRecord(latestPendingEntry) &&
    latestPendingEntry.cmd === "hInsert" &&
    latestPendingEntry.type === 1 &&
    isRecord(latestPendingEntry.value)
      ? latestPendingEntry.value
      : null;
  const pendingCharStyleQli =
    pendingInsertValue === null ? null : readOptionalString(pendingInsertValue.cs);
  const nodeSdi = isRecord(currentNode.sdi) ? currentNode.sdi : null;
  const baseStyleRef = readOptionalNumber(nodeSdi?.Msi);
  const matchedCharStyle = readStyleTableEntryByQli(ivr?.Y5n, pendingCharStyleQli);
  const charStyleCode = matchedCharStyle?.index ?? baseStyleRef ?? null;
  const charStyle =
    matchedCharStyle?.entry ?? readStyleTableEntry(ivr?.Y5n, charStyleCode);
  const paraStyle = readStyleTableEntry(ivr?.$5n, baseStyleRef);
  const formatting = buildParagraphFormatting(charStyle, paraStyle, charStyleCode, baseStyleRef);
  const textStyle = formattingToTextStyle(formatting);
  const paragraphStyleVariant = formattingToParagraphStyleVariant(formatting);
  const run: TextRun | null =
    text.length === 0
      ? null
      : {
          text,
          start: 0,
          end: text.length,
          textStyle,
          ...(charStyleCode === null ? {} : { charStyleCode }),
          ...(baseStyleRef === null ? {} : { styleRef: baseStyleRef }),
          ...(formatting === undefined ? {} : { formatting })
        };

  return {
    id: readOptionalString(currentNode.qli) ?? "current-table-cell",
    kind: "paragraph",
    text,
    runs: run === null ? [] : [run],
    paragraphStyle: {
      ...(formatting?.alignment === undefined ? {} : { alignment: formatting.alignment }),
      ...(formatting?.lineSpacing === undefined ? {} : { lineSpacing: formatting.lineSpacing })
    },
    ...(run === null || Object.keys(textStyle).length === 0 ? {} : { dominantTextStyle: textStyle }),
    ...(baseStyleRef === null ? {} : { paraStyleRefs: [baseStyleRef] }),
    ...(run === null ? {} : { paragraphStyleConsistent: true }),
    ...(paragraphStyleVariant === undefined ? {} : { paraStyleVariants: [paragraphStyleVariant] }),
    ...(readOptionalString(currentNode.qli) === null
      ? {}
      : { rawNodeIds: [readOptionalString(currentNode.qli) ?? ""] })
  };
}

export function pageProbeRuntimeInventory(): RuntimeInventoryReport {
  const buildProbeSummary = (): EditorProbeSummary => {
    const keywordList = ["hancom", "hwp", "editor", "doc", "store", "service", "command"];
    const globals = globalThis as HancomRuntimeRecord;
    const candidateGlobals = Object.keys(globals)
      .filter((key) => keywordList.some((keyword) => key.toLocaleLowerCase().includes(keyword)))
      .filter((key) => {
        const value = globals[key];
        return typeof value === "function" || (typeof value === "object" && value !== null);
      })
      .slice(0, 25);

    return {
      title: document.title,
      url: location.href,
      readyState: document.readyState,
      canvasCount: document.querySelectorAll("canvas").length,
      hasAutomationHook: false,
      availableHookMethods: [],
      candidateGlobals
    };
  };
  const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
    typeof value === "object" && value !== null;
  const getConstructorName = (value: unknown): string | null => {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "object" || typeof value === "function") {
      const ctor = (value as { constructor?: { name?: string } }).constructor;
      return ctor?.name ?? null;
    }

    return value.constructor.name;
  };
  const getPrototypeKeys = (value: object): string[] => {
    const proto = Object.getPrototypeOf(value) as object | null;
    return proto === null ? [] : Reflect.ownKeys(proto).map(String).slice(0, 200);
  };
  const summarizeObject = (value: unknown): RuntimeObjectSummary => {
    if (!isRecord(value) && typeof value !== "function") {
      return { exists: false };
    }

    const objectValue = value as object;
    return {
      exists: true,
      type: typeof value,
      ctor: getConstructorName(value),
      ownKeys: Reflect.ownKeys(objectValue).map(String).slice(0, 200),
      protoKeys: getPrototypeKeys(objectValue)
    };
  };
  const summarizeFieldValue = (value: unknown): SampleFieldSummary => ({
    type: typeof value,
    ctor: getConstructorName(value)
  });
  const summarizeDocumentSurface = (documentObject: unknown): DocumentSurfaceSummary => {
    if (!isRecord(documentObject)) {
      return { exists: false };
    }

    const protoKeys = getPrototypeKeys(documentObject);
    const textLikeKeys = protoKeys
      .filter((key) =>
        /text|txt|string|para|paragraph|table|cell|image|find|search|replace|markdown|export|json|style|font|color|bold|italic/i.test(
          key
        )
      )
      .slice(0, 200);
    const mutationLikeKeys = protoKeys
      .filter((key) => /open|save|rename|insert|delete|remove|move|paste|cut|write|replace/i.test(key))
      .slice(0, 200);
    const sampleFields: Record<string, SampleFieldSummary> = {};

    for (const key of Reflect.ownKeys(documentObject).slice(0, 80)) {
      const stringKey = String(key);
      try {
        const value = documentObject[key];
        sampleFields[stringKey] = summarizeFieldValue(value);
      } catch (error) {
        sampleFields[stringKey] = {
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    return {
      exists: true,
      ctor: getConstructorName(documentObject),
      protoKeys: protoKeys.slice(0, 200),
      textLikeKeys,
      mutationLikeKeys,
      sampleFields
    };
  };
  const summarizeActionManagerSurface = (actionManager: unknown): ActionManagerSurfaceSummary => {
    if (!isRecord(actionManager)) {
      return { exists: false };
    }

    const protoKeys = getPrototypeKeys(actionManager);

    return {
      exists: true,
      ctor: getConstructorName(actionManager),
      ownKeys: Reflect.ownKeys(actionManager).map(String).slice(0, 200),
      protoKeys: protoKeys.slice(0, 200),
      commandLikeKeys: protoKeys
        .filter((key) => /action|exec|run|do|cmd|command|dispatch|enabled|event/i.test(key))
        .slice(0, 200)
    };
  };
  const summarizeIframe = (iframe: HTMLIFrameElement): EditorFrameSummary => {
    const frameDocument = iframe.contentDocument;
    const frameWindow = iframe.contentWindow as (Window & Record<string, unknown>) | null;

    return {
      exists: true,
      src: iframe.src,
      readyState: frameDocument?.readyState ?? null,
      title: frameDocument?.title ?? null,
      canvasCount: frameDocument?.querySelectorAll("canvas").length ?? null,
      bodyChildCount: frameDocument?.body?.children.length ?? null,
      bodyChildren:
        frameDocument?.body === null || frameDocument?.body === undefined
          ? []
          : Array.from(frameDocument.body.children).slice(0, 20).map((element) => ({
              tag: element.tagName,
              id: element.id,
              className: element.className
            })),
      interestingWindowKeys:
        frameWindow === null
          ? []
          : Object.keys(frameWindow)
              .filter((key) => /hancom|hwp|editor|doc|store|command/i.test(key))
              .slice(0, 100)
    };
  };
  const summarizeCommandSurface = (app: HwpAppLike | undefined): CommandSurfaceSummary => {
    const appFunctionKeys =
      app === undefined
        ? []
        : Reflect.ownKeys(app)
            .filter((key) => typeof app[key] === "function")
            .map(String)
            .slice(0, 200);
    const ctrlApiKeys = appFunctionKeys.filter((key) => /^CtrlAPI_/i.test(key)).slice(0, 50);
    const uiCommandFunctions =
      app?.UIAPI === undefined
        ? []
        : Reflect.ownKeys(app.UIAPI)
            .filter((key) => typeof app.UIAPI?.[key] === "function")
            .map(String)
            .filter((key) => /cmd|command|event|action|menu/i.test(key))
            .slice(0, 100);

    return {
      appFunctionKeys,
      ctrlApiKeys,
      uiCommandFunctions
    };
  };
  const buildRuntimeNotes = (
    documentSummary: DocumentSurfaceSummary,
    actionManagerSummary: ActionManagerSurfaceSummary,
    uiapiSummary: RuntimeObjectSummary
  ): string[] => {
    const notes: string[] = [];

    if (documentSummary.exists) {
      notes.push("Treat HwpApp.document as the primary read-path candidate.");
    }

    if ((documentSummary.textLikeKeys?.length ?? 0) === 0) {
      notes.push(
        "Document prototype is heavily obfuscated; recover semantics from return shapes instead of names."
      );
    }

    if (actionManagerSummary.exists) {
      notes.push("Treat ActionManager and UIAPI as the primary write-path and command-mapping candidates.");
    }

    if ((uiapiSummary.ownKeys?.length ?? 0) > 0) {
      notes.push("UIAPI exposes command-related helpers that should help map menu clicks to internal actions.");
    }

    return notes;
  };
  const app = (globalThis as typeof globalThis & { HwpApp?: HwpAppLike }).HwpApp;
  const documentSummary = summarizeDocumentSurface(app?.document);
  const actionManagerSummary = summarizeActionManagerSurface(app?.ActionManager);
  const uiapiSummary = summarizeObject(app?.UIAPI);

  return {
    probe: buildProbeSummary(),
    scriptSources: Array.from(document.scripts).map((script) => script.src || "[inline]"),
    iframeSummaries: Array.from(document.querySelectorAll("iframe")).map((iframe) =>
      summarizeIframe(iframe)
    ),
    hwpApp: summarizeObject(app),
    core: summarizeObject(app?.Core),
    models: summarizeObject(app?.Models),
    document: documentSummary,
    actionManager: actionManagerSummary,
    uiapi: uiapiSummary,
    commandSurface: summarizeCommandSurface(app),
    notes: buildRuntimeNotes(documentSummary, actionManagerSummary, uiapiSummary)
  };
}

export function pageProbeDocumentTextChain(maxNodes = 500): DocumentTextChainReport {
  const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
    typeof value === "object" && value !== null;
  const isTextChainNode = (value: unknown): value is TextChainNodeLike =>
    isRecord(value) && value.Aoi instanceof Uint16Array;
  const getTextChainRootNode = (
    documentRoot: Record<PropertyKey, unknown> | undefined
  ): TextChainNodeLike | undefined => {
    const selectionContainer = documentRoot?.Svr;
    if (!isRecord(selectionContainer)) {
      return undefined;
    }

    const rootNode = selectionContainer.G0i;
    return isTextChainNode(rootNode) ? rootNode : undefined;
  };
  const decodeUint16Text = (buffer: Uint16Array): string =>
    Array.from(buffer)
      .map((code) => String.fromCharCode(code))
      .join("");
  const readStyleRunBoundaries = (value: unknown): number[] =>
    value instanceof Uint32Array ? Array.from(value) : [];
  const removeNullCharacters = (text: string): string => text.split("\0").join("");
  const looksLikeControlText = (text: string): boolean => {
    if (text.length === 0) {
      return true;
    }

    if (text === "\r") {
      return false;
    }

    const sanitized = removeNullCharacters(text);
    const meaningfulMatches = sanitized.match(/[가-힣A-Za-z0-9]/g);
    return (meaningfulMatches?.length ?? 0) === 0;
  };
  const readOptionalString = (value: unknown): string | null =>
    typeof value === "string" ? value : null;
  const readOptionalNumber = (value: unknown): number | null =>
    typeof value === "number" ? value : null;

  const documentRoot = (globalThis as typeof globalThis & { HwpApp?: HwpAppLike }).HwpApp
    ?.document as Record<PropertyKey, unknown> | undefined;
  const rootNode = getTextChainRootNode(documentRoot);
  if (!rootNode) {
    return {
      rootNodeId: null,
      traversedCount: 0,
      textNodeCount: 0,
      controlNodeCount: 0,
      paragraphCount: 0,
      extractedText: "",
      paragraphs: [],
      nodes: []
    };
  }

  const nodes: DocumentTextChainNode[] = [];
  const paragraphs: string[] = [];
  const seen = new WeakSet<object>();
  let currentParagraph = "";
  let textNodeCount = 0;
  let controlNodeCount = 0;
  let traversedCount = 0;
  let node: unknown = rootNode;

  while (isTextChainNode(node) && traversedCount < maxNodes && !seen.has(node)) {
    seen.add(node);

    const decodedText = decodeUint16Text(node.Aoi);
    const normalizedText = removeNullCharacters(decodedText);
    const isParagraphBreak = normalizedText === "\r";
    const isControlLike = looksLikeControlText(normalizedText);
    const styleRunBoundaries = readStyleRunBoundaries(node.Csi);

    nodes.push({
      index: traversedCount,
      nodeId: readOptionalString(node.qli),
      text: decodedText,
      normalizedText,
      textLength: normalizedText.length,
      styleRunBoundaries,
      styleRunCount: Math.max(0, Math.floor(styleRunBoundaries.length / 2)),
      styleRef: readOptionalNumber(node.sdi?.Msi),
      isParagraphBreak,
      isControlLike,
      flags: {
        Ooi: readOptionalNumber(node.Ooi),
        koi: readOptionalNumber(node.koi),
        Hoi: readOptionalNumber(node.Hoi),
        Moi: readOptionalNumber(node.Moi),
        idi: readOptionalNumber(node.idi),
        ndi: typeof node.ndi === "boolean" ? node.ndi : null
      }
    });

    if (isParagraphBreak) {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph);
        currentParagraph = "";
      }
    } else if (!isControlLike) {
      currentParagraph += normalizedText.replace(/\r/g, "");
      textNodeCount += 1;
    } else {
      controlNodeCount += 1;
    }

    traversedCount += 1;
    node = node.tdi;
  }

  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph);
  }

  return {
    rootNodeId: readOptionalString(rootNode.qli),
    traversedCount,
    textNodeCount,
    controlNodeCount,
    paragraphCount: paragraphs.length,
    extractedText: paragraphs.join("\n\n"),
    paragraphs,
    nodes
  };
}

export function pageReadStructureFromTextChain(): HancomDocument | null {
  const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
    typeof value === "object" && value !== null;
  const isTextChainNode = (value: unknown): value is TextChainNodeLike =>
    isRecord(value) && value.Aoi instanceof Uint16Array;
  const getTextChainRootNode = (
    documentRoot: Record<PropertyKey, unknown> | undefined
  ): TextChainNodeLike | undefined => {
    const selectionContainer = documentRoot?.Svr;
    if (!isRecord(selectionContainer)) {
      return undefined;
    }

    const rootNode = selectionContainer.G0i;
    return isTextChainNode(rootNode) ? rootNode : undefined;
  };
  const decodeUint16Text = (buffer: Uint16Array): string =>
    Array.from(buffer)
      .map((code) => String.fromCharCode(code))
      .join("");
  const removeNullCharacters = (text: string): string => text.split("\0").join("");
  const looksLikeControlText = (text: string): boolean => {
    if (text.length === 0) {
      return true;
    }

    if (text === "\r") {
      return false;
    }

    const sanitized = removeNullCharacters(text);
    const meaningfulMatches = sanitized.match(/[가-힣A-Za-z0-9]/g);
    return (meaningfulMatches?.length ?? 0) === 0;
  };
  const readOptionalString = (value: unknown): string | null =>
    typeof value === "string" ? value : null;
  const readOptionalNumber = (value: unknown): number | null =>
    typeof value === "number" ? value : null;
  const decodeToken = (left: number, right: number): string =>
    String.fromCharCode(
      ...Array.from(new Uint8Array(Uint16Array.of(left, right).buffer)).filter(
        (byte) => byte !== 0
      )
    );
  const looksLikeToken = (token: string): boolean => /^[ -~]{3,4}$/.test(token);
  const sanitizeValue = (value: unknown): unknown => {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }

    if (value instanceof Uint16Array || value instanceof Uint32Array) {
      return Array.from(value);
    }

    if (Array.isArray(value)) {
      return value.slice(0, 16).map((item) => sanitizeValue(item));
    }

    if (!isRecord(value)) {
      return undefined;
    }

    const sanitized: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(value).slice(0, 32)) {
      const stringKey = String(key);
      const nextValue = sanitizeValue(value[key]);
      if (nextValue !== undefined) {
        sanitized[stringKey] = nextValue;
      }
    }
    return sanitized;
  };
  const readStyleTableEntry = (
    styleTableRoot: unknown,
    index: number | null
  ): Record<PropertyKey, unknown> | null => {
    if (!isRecord(styleTableRoot) || index === null) {
      return null;
    }

    const entries = styleTableRoot.n4n;
    if (!Array.isArray(entries) || index < 0 || index >= entries.length) {
      return null;
    }

    const entry: unknown = entries[index];
    return isRecord(entry) ? entry : null;
  };
  const decodeVisibleColor = (value: unknown): string | undefined => {
    if (typeof value !== "number") {
      return undefined;
    }

    const packed = value >>> 0;
    const red = packed & 0xff;
    const green = (packed >>> 8) & 0xff;
    const blue = (packed >>> 16) & 0xff;
    return `#${[red, green, blue]
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")}`;
  };
  const decodeBold = (value: unknown): boolean | undefined => {
    if (typeof value !== "number") {
      return undefined;
    }

    return (value & 0b10) !== 0;
  };
  const decodeItalic = (value: unknown): boolean | undefined => {
    if (typeof value !== "number") {
      return undefined;
    }

    return (value & 0b1) !== 0;
  };
  const decodeAlignment = (
    value: unknown
  ): ParagraphFormatting["alignment"] | undefined => {
    if (typeof value !== "number") {
      return undefined;
    }

    switch (value) {
      case 260:
        return "left";
      case 264:
        return "right";
      case 268:
        return "center";
      case 384:
        return "justify";
      default:
        return undefined;
    }
  };
  const buildParagraphFormatting = (
    charStyle: Record<PropertyKey, unknown> | null,
    paraStyle: Record<PropertyKey, unknown> | null,
    charStyleCode: number | null,
    paraStyleCode: number | null
  ): ParagraphFormatting | undefined => {
    const fontName =
      Array.isArray(charStyle?.aXt) &&
      isRecord(charStyle.aXt[0]) &&
      typeof charStyle.aXt[0].DXt === "string"
        ? charStyle.aXt[0].DXt
        : undefined;
    const fontSize = typeof charStyle?.SXt === "number" ? charStyle.SXt / 100 : undefined;
    const bold = decodeBold(charStyle?.cUt);
    const italic = decodeItalic(charStyle?.cUt);
    const color = decodeVisibleColor(charStyle?.$Xt);
    const alignment = decodeAlignment(paraStyle?.cUt);
    const lineSpacing = typeof paraStyle?.FNi === "number" ? paraStyle.FNi / 100 : undefined;
    const rawCharStyle = sanitizeValue(charStyle);
    const rawParaStyle = sanitizeValue(paraStyle);

    const formatting: ParagraphFormatting = {
      ...(fontName === undefined ? {} : { fontName }),
      ...(fontSize === undefined ? {} : { fontSize }),
      ...(bold === undefined ? {} : { bold }),
      ...(italic === undefined ? {} : { italic }),
      ...(color === undefined ? {} : { color }),
      ...(alignment === undefined ? {} : { alignment }),
      ...(lineSpacing === undefined ? {} : { lineSpacing }),
      ...(charStyleCode === null ? {} : { charStyleCode }),
      ...(paraStyleCode === null ? {} : { paraStyleCode }),
      ...(isRecord(rawCharStyle) ? { rawCharStyle } : {}),
      ...(isRecord(rawParaStyle) ? { rawParaStyle } : {})
    };

    return Object.keys(formatting).length > 0 ? formatting : undefined;
  };
  const formattingToTextStyle = (formatting?: ParagraphFormatting): TextStyle => ({
    ...(formatting?.bold === undefined ? {} : { bold: formatting.bold }),
    ...(formatting?.color === undefined ? {} : { color: formatting.color }),
    ...(formatting?.fontName === undefined ? {} : { fontName: formatting.fontName }),
    ...(formatting?.fontSize === undefined ? {} : { fontSize: formatting.fontSize }),
    ...(formatting?.italic === undefined ? {} : { italic: formatting.italic })
  });
  const formattingToParagraphStyleVariant = (
    formatting?: ParagraphFormatting
  ): ParagraphStyleVariant | undefined => {
    if (formatting?.paraStyleCode === undefined || formatting.paraStyleCode === null) {
      return undefined;
    }

    const rawParaStyle = formatting.rawParaStyle;
    const rawCUt = typeof rawParaStyle?.cUt === "number" ? rawParaStyle.cUt : undefined;
    const rawXli = typeof rawParaStyle?.Xli === "number" ? rawParaStyle.Xli : undefined;
    const rawLNi = typeof rawParaStyle?.LNi === "number" ? rawParaStyle.LNi : undefined;
    const rawWTiMsi =
      isRecord(rawParaStyle?.wTi) && typeof rawParaStyle.wTi.Msi === "number"
        ? rawParaStyle.wTi.Msi
        : undefined;

    return {
      paraStyleCode: formatting.paraStyleCode,
      ...(formatting.lineSpacing === undefined ? {} : { lineSpacing: formatting.lineSpacing }),
      ...(formatting.alignment === undefined ? {} : { alignment: formatting.alignment }),
      ...(rawCUt === undefined ? {} : { rawCUt }),
      ...(rawXli === undefined ? {} : { rawXli }),
      ...(rawLNi === undefined ? {} : { rawLNi }),
      ...(rawWTiMsi === undefined ? {} : { rawWTiMsi })
    };
  };
  const hasSameTextStyle = (left: TextStyle, right: TextStyle): boolean =>
    JSON.stringify(left) === JSON.stringify(right);
  const hasSameParagraphStyleVariant = (
    left: ParagraphStyleVariant,
    right: ParagraphStyleVariant
  ): boolean => JSON.stringify(left) === JSON.stringify(right);
  const resolveSingleParagraphStyleValue = <T extends string | number>(
    values: Array<T | undefined>
  ): T | undefined => {
    const uniqueValues = values.reduce<T[]>((accumulator, value) => {
      if (
        value !== undefined &&
        !accumulator.some((candidate) => candidate === value)
      ) {
        accumulator.push(value);
      }
      return accumulator;
    }, []);

    return uniqueValues.length === 1 ? uniqueValues[0] : undefined;
  };
  const buildRunPairs = (csiRaw: number[]): Array<{ start: number; code: number }> => {
    const pairs: Array<{ start: number; code: number }> = [];
    for (let index = 0; index + 1 < csiRaw.length; index += 2) {
      const start = csiRaw[index];
      const code = csiRaw[index + 1];
      if (typeof start === "number" && typeof code === "number") {
        pairs.push({ start, code });
      }
    }
    return pairs.sort((left, right) => left.start - right.start);
  };
  const readObjectRegistryEntries = (
    registryRoot: unknown
  ): Array<{
    objectId: number;
    objectNodeId: string | null;
    objectType: number | null;
  }> => {
    if (!Array.isArray(registryRoot)) {
      return [];
    }

    return registryRoot
      .filter((entry): entry is Record<PropertyKey, unknown> => isRecord(entry))
      .map((entry) => ({
        objectId: readOptionalNumber(entry.Qli),
        objectNodeId: readOptionalString(entry.qli),
        objectType: readOptionalNumber(entry.Xli)
      }))
      .filter(
        (
          entry
        ): entry is {
          objectId: number;
          objectNodeId: string | null;
          objectType: number | null;
        } => entry.objectId !== null
      );
  };
  const readImageRegistryEntries = (
    registryRoot: unknown,
    cacheImages: Record<string, unknown>
  ): Array<{
    imageId: number;
    imageNodeId: string | null;
    imageType: number | null;
    cacheKey: string | null;
    extension: string | null;
    source: string | null;
  }> => {
    if (!Array.isArray(registryRoot)) {
      return [];
    }

    return registryRoot
      .filter((entry): entry is Record<PropertyKey, unknown> => isRecord(entry))
      .map((entry) => {
        const cacheKey = readOptionalString(entry.FFi);
        const cachedImage = cacheKey === null ? undefined : cacheImages[cacheKey];
        const htmlImage = isRecord(cachedImage) ? cachedImage : null;

        return {
          imageId: readOptionalNumber(entry.Qli),
          imageNodeId: readOptionalString(entry.qli),
          imageType: readOptionalNumber(entry.Xli),
          cacheKey,
          extension: readOptionalString(entry.UFi),
          source:
            htmlImage !== null && typeof htmlImage.src === "string" && htmlImage.src.length > 0
              ? htmlImage.src
              : null
        };
      })
      .filter(
        (
          entry
        ): entry is {
          imageId: number;
          imageNodeId: string | null;
          imageType: number | null;
          cacheKey: string | null;
          extension: string | null;
          source: string | null;
        } => entry.imageId !== null
      );
  };
  const parseControlPlaceholders = (
    nodeWords: number[],
    objectById: Map<number, { objectNodeId: string | null; objectType: number | null }>,
    imageById: Map<
      number,
      {
        imageNodeId: string | null;
        imageType: number | null;
        cacheKey: string | null;
        extension: string | null;
        source: string | null;
      }
    >
  ): Array<{
    startWord: number;
    endWordExclusive: number;
    controlCode: number;
    repeatControlCode: number;
    token: string;
    objectId: number;
    objectNodeId: string | null;
    objectType: number | null;
    imageNodeId: string | null;
    imageType: number | null;
    cacheKey: string | null;
    extension: string | null;
    source: string | null;
    rawWords: number[];
  }> => {
    const refs: Array<{
      startWord: number;
      endWordExclusive: number;
      controlCode: number;
      repeatControlCode: number;
      token: string;
      objectId: number;
      objectNodeId: string | null;
      objectType: number | null;
      imageNodeId: string | null;
      imageType: number | null;
      cacheKey: string | null;
      extension: string | null;
      source: string | null;
      rawWords: number[];
    }> = [];
    for (let index = 0; index + 7 < nodeWords.length; ) {
      const controlCode = nodeWords[index];
      const tokenLeft = nodeWords[index + 1];
      const tokenRight = nodeWords[index + 2];
      const imageId = nodeWords[index + 3];
      const zeroA = nodeWords[index + 4];
      const zeroB = nodeWords[index + 5];
      const zeroC = nodeWords[index + 6];
      const repeatControlCode = nodeWords[index + 7];

      if (
        typeof controlCode !== "number" ||
        typeof tokenLeft !== "number" ||
        typeof tokenRight !== "number" ||
        typeof imageId !== "number" ||
        typeof zeroA !== "number" ||
        typeof zeroB !== "number" ||
        typeof zeroC !== "number" ||
        typeof repeatControlCode !== "number"
      ) {
        index += 1;
        continue;
      }

      const token = decodeToken(tokenLeft, tokenRight);
      if (
        !looksLikeToken(token) ||
        controlCode !== repeatControlCode ||
        zeroA !== 0 ||
        zeroB !== 0 ||
        zeroC !== 0
      ) {
        index += 1;
        continue;
      }

      const object = objectById.get(imageId);
      if (object === undefined) {
        index += 1;
        continue;
      }
      const image = imageById.get(imageId);

      refs.push({
        startWord: index,
        endWordExclusive: index + 8,
        controlCode,
        repeatControlCode,
        token,
        objectId: imageId,
        objectNodeId: object?.objectNodeId ?? null,
        objectType: object?.objectType ?? null,
        imageNodeId: image?.imageNodeId ?? null,
        imageType: image?.imageType ?? null,
        cacheKey: image?.cacheKey ?? null,
        extension: image?.extension ?? null,
        source: image?.source ?? null,
        rawWords: nodeWords.slice(index, index + 8)
      });
      index += 8;
    }

    return refs;
  };
  const buildRemovedWordIndexSet = (
    placeholderSpans: Array<{ startWord: number; endWordExclusive: number }>,
    extraRemovedIndexes: number[] = []
  ): Set<number> => {
    const removedIndexes = new Set<number>();
    placeholderSpans.forEach((span) => {
      for (let index = span.startWord; index < span.endWordExclusive; index += 1) {
        removedIndexes.add(index);
      }
    });
    extraRemovedIndexes.forEach((index) => {
      removedIndexes.add(index);
    });
    return removedIndexes;
  };
  const stripRecognizedPlaceholderWords = (
    nodeWords: number[],
    removedIndexes: Set<number>
  ): number[] => nodeWords.filter((_, index) => !removedIndexes.has(index));
  const readLeadingControlCode = (nodeWords: number[]): number | null => {
    const firstMeaningfulWord = nodeWords.find(
      (word) => word !== 0 && word !== 9 && word !== 10 && word !== 13 && word !== 32
    );

    return typeof firstMeaningfulWord === "number" && firstMeaningfulWord >= 1 && firstMeaningfulWord <= 31
      ? firstMeaningfulWord
      : null;
  };
  const applySecondaryControlCleanup = (
    nodeWords: number[],
    placeholderSpans: Array<{ startWord: number; endWordExclusive: number }>,
    currentNode: TextChainNodeLike
  ): {
    removedRawIndexes: number[];
    cleanedWords: number[];
    appliedSectionMarker31Rule: boolean;
    remainingLeadingControlCode: number | null;
  } => {
    const placeholderRemovedIndexes = buildRemovedWordIndexSet(placeholderSpans);
    const placeholderCleanedWords = stripRecognizedPlaceholderWords(nodeWords, placeholderRemovedIndexes);
    const leadingControlCode = readLeadingControlCode(placeholderCleanedWords);
    const optionalNumberMatches = (value: unknown, expected: number): boolean =>
      value === undefined || value === null || value === expected;
    const shouldStripSectionMarker31 =
      leadingControlCode === 31 &&
      readOptionalNumber(currentNode.Jci) === -2147483648 &&
      optionalNumberMatches(readOptionalNumber(currentNode.Ooi), 4) &&
      optionalNumberMatches(readOptionalNumber(currentNode.koi), 2) &&
      optionalNumberMatches(readOptionalNumber(currentNode.Hoi), 1) &&
      optionalNumberMatches(readOptionalNumber(currentNode.Moi), 1) &&
      optionalNumberMatches(readOptionalNumber(currentNode.Noi), 8);

    if (!shouldStripSectionMarker31) {
      return {
        removedRawIndexes: [],
        cleanedWords: placeholderCleanedWords,
        appliedSectionMarker31Rule: false,
        remainingLeadingControlCode: leadingControlCode
      };
    }

    const removedRawIndexes = nodeWords
      .map((word, index) => ({ word, index }))
      .filter(({ word, index }) => word === 31 && !placeholderRemovedIndexes.has(index))
      .map(({ index }) => index);
    const removedIndexes = buildRemovedWordIndexSet(placeholderSpans, removedRawIndexes);
    const cleanedWords = stripRecognizedPlaceholderWords(nodeWords, removedIndexes);

    return {
      removedRawIndexes,
      cleanedWords,
      appliedSectionMarker31Rule: removedRawIndexes.length > 0,
      remainingLeadingControlCode: readLeadingControlCode(cleanedWords)
    };
  };
  const applyResidualSeparator31Cleanup = (
    nodeWords: number[],
    removedIndexes: Set<number>
  ): {
    removedRawIndexes: number[];
    appliedSeparator31Rule: boolean;
  } => {
    const extraRemovedIndexes = new Set<number>();

    nodeWords.forEach((word, index) => {
      if (word !== 31 || removedIndexes.has(index)) {
        return;
      }

      extraRemovedIndexes.add(index);
      const previousIndex = index - 1;
      const nextIndex = index + 1;
      if (
        previousIndex >= 0 &&
        nextIndex < nodeWords.length &&
        !removedIndexes.has(previousIndex) &&
        !removedIndexes.has(nextIndex) &&
        nodeWords[previousIndex] === 32 &&
        nodeWords[nextIndex] === 32
      ) {
        extraRemovedIndexes.add(previousIndex);
      }
    });

    const removedRawIndexes = Array.from(extraRemovedIndexes).sort((left, right) => left - right);
    return {
      removedRawIndexes,
      appliedSeparator31Rule: removedRawIndexes.length > 0
    };
  };
  const readResidualControlWordOffsets = (nodeWords: number[]): number[] =>
    nodeWords
      .map((word, index) => ({ word, index }))
      .filter(
        ({ word }) =>
          word !== 0 &&
          word !== 9 &&
          word !== 10 &&
          word !== 13 &&
          word >= 1 &&
          word <= 31
      )
      .map(({ index }) => index);
  const buildCleanWordPrefix = (
    nodeWords: number[],
    removedIndexes: Set<number>
  ): number[] => {
    const prefix: number[] = [0];
    nodeWords.forEach((word, index) => {
      const keepWord = !removedIndexes.has(index) && word !== 0 && word !== 13;
      prefix.push((prefix[index] ?? 0) + (keepWord ? 1 : 0));
    });
    return prefix;
  };
  const buildCleanText = (
    nodeWords: number[],
    removedIndexes: Set<number>
  ): string => {
    return nodeWords
      .filter((word, index) => !removedIndexes.has(index) && word !== 0 && word !== 13)
      .map((word) => String.fromCharCode(word))
      .join("");
  };
  const mapRawOffsetToCleanOffset = (
    cleanPrefix: number[],
    rawOffset: number,
    maxOffset: number
  ): number => {
    const clamped = Math.max(0, Math.min(rawOffset, maxOffset));
    return cleanPrefix[clamped] ?? cleanPrefix.at(-1) ?? 0;
  };
  const buildNodeRuns = (
    nodeWords: number[],
    cleanText: string,
    cleanPrefix: number[],
    baseFormatting: ParagraphFormatting | undefined,
    paraStyle: Record<PropertyKey, unknown> | null,
    paraStyleRef: number | null,
    runPairs: Array<{ start: number; code: number }>
  ): TextRun[] => {
    const baseTextStyle = formattingToTextStyle(baseFormatting);
    const baseCharStyleCode = baseFormatting?.charStyleCode ?? paraStyleRef ?? null;

    if (cleanText.length === 0) {
      return [];
    }

    if (runPairs.length === 0) {
      return [
        {
          text: cleanText,
          start: 0,
          end: cleanText.length,
          textStyle: baseTextStyle,
          ...(baseCharStyleCode === null ? {} : { charStyleCode: baseCharStyleCode }),
          ...(paraStyleRef === null ? {} : { styleRef: paraStyleRef }),
          ...(baseFormatting === undefined ? {} : { formatting: baseFormatting })
        }
      ];
    }

    const runs: TextRun[] = [];
    const firstStart = runPairs[0]?.start ?? 0;
    const firstCleanStart = mapRawOffsetToCleanOffset(cleanPrefix, firstStart, nodeWords.length);
    if (firstCleanStart > 0) {
      runs.push({
        text: cleanText.slice(0, firstCleanStart),
        start: 0,
        end: firstCleanStart,
        textStyle: baseTextStyle,
        ...(baseCharStyleCode === null ? {} : { charStyleCode: baseCharStyleCode }),
        ...(paraStyleRef === null ? {} : { styleRef: paraStyleRef }),
        ...(baseFormatting === undefined ? {} : { formatting: baseFormatting })
      });
    }

    runPairs.forEach((pair, index) => {
      const cleanStart = mapRawOffsetToCleanOffset(cleanPrefix, pair.start, nodeWords.length);
      const nextRawStart = runPairs[index + 1]?.start ?? nodeWords.length;
      const cleanEnd = mapRawOffsetToCleanOffset(cleanPrefix, nextRawStart, nodeWords.length);
      if (cleanEnd <= cleanStart) {
        return;
      }

      const charStyle = readStyleTableEntry(styleTables?.Y5n, pair.code);
      const formatting = buildParagraphFormatting(charStyle, paraStyle, pair.code, paraStyleRef);
      runs.push({
        text: cleanText.slice(cleanStart, cleanEnd),
        start: cleanStart,
        end: cleanEnd,
        textStyle: formattingToTextStyle(formatting),
        charStyleCode: pair.code,
        ...(paraStyleRef === null ? {} : { styleRef: paraStyleRef }),
        ...(formatting === undefined ? {} : { formatting })
      });
    });

    return runs;
  };
  const sliceRuns = (runs: TextRun[], start: number, end: number): TextRun[] =>
    runs.flatMap((run) => {
      const overlapStart = Math.max(run.start, start);
      const overlapEnd = Math.min(run.end, end);
      if (overlapEnd <= overlapStart) {
        return [];
      }

      return [
        {
          text: run.text.slice(overlapStart - run.start, overlapEnd - run.start),
          start: overlapStart - start,
          end: overlapEnd - start,
          textStyle: run.textStyle,
          ...(run.charStyleCode === undefined ? {} : { charStyleCode: run.charStyleCode }),
          ...(run.styleRef === undefined ? {} : { styleRef: run.styleRef }),
          ...(run.formatting === undefined ? {} : { formatting: run.formatting })
        }
      ];
    });

  const app = (globalThis as typeof globalThis & { HwpApp?: HwpAppLike }).HwpApp;
  const documentRoot = app?.document as Record<PropertyKey, unknown> | undefined;
  const rootNode = getTextChainRootNode(documentRoot);
  if (!rootNode) {
    return null;
  }

  const ivr = documentRoot?.Ivr;
  const styleTables = isRecord(ivr) ? ivr : undefined;
  const cacheImages = app?.cache?.images ?? {};
  const objectEntries = readObjectRegistryEntries(styleTables?.j5n && isRecord(styleTables.j5n) ? styleTables.j5n.n4n : undefined);
  const imageEntries = readImageRegistryEntries(
    styleTables?.u6n && isRecord(styleTables.u6n) ? styleTables.u6n.U4n : undefined,
    cacheImages
  );
  const objectById = new Map(
    objectEntries.map((entry) => [entry.objectId, { objectNodeId: entry.objectNodeId, objectType: entry.objectType }])
  );
  const imageById = new Map(
    imageEntries.map((entry) => [
      entry.imageId,
      {
        imageNodeId: entry.imageNodeId,
        imageType: entry.imageType,
        cacheKey: entry.cacheKey,
        extension: entry.extension,
        source: entry.source
      }
    ])
  );
  const tableCellRegistryEntries =
    styleTables?.o6n && isRecord(styleTables.o6n) && Array.isArray(styleTables.o6n.n4n)
      ? styleTables.o6n.n4n.length
      : 0;
  const tableStructureEntries =
    styleTables?.z5n && isRecord(styleTables.z5n) && Array.isArray(styleTables.z5n.n4n)
      ? styleTables.z5n.n4n.length
      : 0;
  const documentSvr = isRecord(documentRoot?.Svr) ? documentRoot.Svr : null;
  const documentZvr = isRecord(documentRoot?.Zvr) ? documentRoot.Zvr : null;
  const documentZvrBodyMirror = documentZvr && isRecord(documentZvr.$bi) ? documentZvr.$bi : null;
  const documentZvrSelectionBridge =
    documentZvrBodyMirror !== null && isRecord(documentZvrBodyMirror._Vi)
      ? documentZvrBodyMirror._Vi
      : null;
  const hasTableSelectionBridge =
    Array.isArray(documentSvr?._ie) ||
    documentZvrSelectionBridge?.z0i !== undefined ||
    documentZvrBodyMirror?.z0i !== undefined;
  const directPlaceholderImageIds = new Set<number>();
  const strippedObjectPlaceholderIds = new Set<number>();
  const strippedImagePlaceholderIdsMissingPayload = new Set<number>();
  const blocks: HancomDocument["blocks"] = [];
  const warnings: string[] = [];
  const seen = new WeakSet<object>();
  let imageNodeCount = 0;
  let nodesWithRecognizedPlaceholderSpans = 0;
  let nodesWithSectionMarkerCleanup = 0;
  let nodesWithResidualSeparator31Cleanup = 0;
  let nodesWithResidualControlWords = 0;
  const residualLeadingControlBuckets = new Map<number, number>();

  let node: unknown = rootNode;
  let paragraphIndex = 0;
  let currentText = "";
  let currentRuns: TextRun[] = [];
  let currentNodeIds: string[] = [];
  let currentParagraphStyleRefs: number[] = [];
  let currentParagraphStyleVariants: ParagraphStyleVariant[] = [];

  const flushParagraph = (): void => {
    if (currentText.length === 0) {
      return;
    }

    const uniqueTextStyles = currentRuns.reduce<TextStyle[]>((styles, run) => {
      if (!styles.some((style) => hasSameTextStyle(style, run.textStyle))) {
        styles.push(run.textStyle);
      }
      return styles;
    }, []);
    const uniqueParaStyleRefs = Array.from(new Set(currentParagraphStyleRefs));
    const uniqueParagraphStyleVariants = currentParagraphStyleVariants.reduce<ParagraphStyleVariant[]>(
      (variants, candidate) => {
        if (!variants.some((variant) => hasSameParagraphStyleVariant(variant, candidate))) {
          variants.push(candidate);
        }
        return variants;
      },
      []
    );
    const paragraphStyleConsistent = uniqueParagraphStyleVariants.length <= 1;
    const resolvedParagraphAlignment = paragraphStyleConsistent
      ? resolveSingleParagraphStyleValue(
          uniqueParagraphStyleVariants.map((variant) => variant.alignment)
        )
      : undefined;
    const resolvedParagraphLineSpacing = paragraphStyleConsistent
      ? resolveSingleParagraphStyleValue(
          uniqueParagraphStyleVariants.map((variant) => variant.lineSpacing)
        )
      : undefined;
    const paragraphStyle = {
      ...(resolvedParagraphAlignment === undefined
        ? {}
        : { alignment: resolvedParagraphAlignment }),
      ...(resolvedParagraphLineSpacing === undefined
        ? {}
        : { lineSpacing: resolvedParagraphLineSpacing })
    };

    blocks.push({
      id: currentNodeIds[0] ?? `text-chain-paragraph-${paragraphIndex}`,
      kind: "paragraph",
      text: currentText,
      runs: currentRuns,
      paragraphStyle,
      ...(uniqueTextStyles.length === 1 ? { dominantTextStyle: uniqueTextStyles[0] } : {}),
      ...(uniqueParaStyleRefs.length === 0 ? {} : { paraStyleRefs: uniqueParaStyleRefs }),
      ...(currentRuns.length === 0 ? {} : { paragraphStyleConsistent }),
      ...(uniqueParagraphStyleVariants.length === 0
        ? {}
        : { paraStyleVariants: uniqueParagraphStyleVariants }),
      ...(currentNodeIds.length === 0 ? {} : { rawNodeIds: currentNodeIds })
    });

    paragraphIndex += 1;
    currentText = "";
    currentRuns = [];
    currentNodeIds = [];
    currentParagraphStyleRefs = [];
    currentParagraphStyleVariants = [];
  };
  const appendParagraphSegment = (
    segmentText: string,
    segmentRuns: TextRun[],
    nodeId: string | null,
    paraStyleRef: number | null,
    paragraphStyleVariant: ParagraphStyleVariant | undefined
  ): void => {
    if (segmentText.length === 0) {
      return;
    }

    const paragraphOffset = currentText.length;
    if (nodeId !== null) {
      currentNodeIds.push(nodeId);
    }
    if (paraStyleRef !== null) {
      currentParagraphStyleRefs.push(paraStyleRef);
    }
    if (paragraphStyleVariant !== undefined) {
      currentParagraphStyleVariants.push(paragraphStyleVariant);
    }

    currentRuns.push(
      ...segmentRuns.map((run) => ({
        ...run,
        start: paragraphOffset + run.start,
        end: paragraphOffset + run.end
      }))
    );
    currentText += segmentText;
  };

  while (isTextChainNode(node) && !seen.has(node)) {
    seen.add(node);

    const nodeWords = Array.from(node.Aoi);
    const placeholderSpans = parseControlPlaceholders(nodeWords, objectById, imageById);
    const imageRefs = placeholderSpans.filter(
      (span) =>
        span.imageNodeId !== null ||
        span.imageType !== null ||
        span.cacheKey !== null ||
        span.extension !== null ||
        span.source !== null
    );
    imageRefs.forEach((span) => {
      directPlaceholderImageIds.add(span.objectId);
      if (span.source === null) {
        strippedImagePlaceholderIdsMissingPayload.add(span.objectId);
      }
    });
    placeholderSpans
      .filter(
        (span) =>
          span.imageNodeId === null &&
          span.imageType === null &&
          span.cacheKey === null &&
          span.extension === null &&
          span.source === null
      )
      .forEach((span) => {
        strippedObjectPlaceholderIds.add(span.objectId);
      });

    const secondaryCleanup = applySecondaryControlCleanup(nodeWords, placeholderSpans, node);
    const placeholderAndSectionRemovedIndexes = buildRemovedWordIndexSet(
      placeholderSpans,
      secondaryCleanup.removedRawIndexes
    );
    const separator31Cleanup = applyResidualSeparator31Cleanup(
      nodeWords,
      placeholderAndSectionRemovedIndexes
    );
    const removedIndexes = buildRemovedWordIndexSet(placeholderSpans, [
      ...secondaryCleanup.removedRawIndexes,
      ...separator31Cleanup.removedRawIndexes
    ]);
    const cleanedWords = stripRecognizedPlaceholderWords(nodeWords, removedIndexes);
    if (secondaryCleanup.appliedSectionMarker31Rule) {
      nodesWithSectionMarkerCleanup += 1;
    }
    if (separator31Cleanup.appliedSeparator31Rule) {
      nodesWithResidualSeparator31Cleanup += 1;
    }
    const normalizedText = removeNullCharacters(decodeUint16Text(Uint16Array.from(cleanedWords)));
    const isParagraphBreak = normalizedText === "\r";
    if (isParagraphBreak) {
      const imageRefsWithPayload = imageRefs.filter((imageRef) => imageRef.source !== null);
      if (imageRefsWithPayload.length > 0) {
        flushParagraph();
        for (const imageRef of imageRefsWithPayload) {
          blocks.push({
            kind: "image",
            id:
              imageRef.objectNodeId ??
              imageRef.imageNodeId ??
              `${readOptionalString(node.qli) ?? `text-chain-image-${imageNodeCount}`}:${imageRef.objectId}`,
            altText:
              imageRef.extension === null
                ? `image ${imageRef.objectId}`
                : `image ${imageRef.objectId}.${imageRef.extension}`,
            ...(imageRef.source === null ? {} : { source: imageRef.source })
          });
          imageNodeCount += 1;
        }
      }
      flushParagraph();
      node = node.tdi;
      continue;
    }

    if (placeholderSpans.length > 0) {
      nodesWithRecognizedPlaceholderSpans += 1;
    }
    const residualControlWordOffsets = readResidualControlWordOffsets(cleanedWords);
    if (residualControlWordOffsets.length > 0) {
      nodesWithResidualControlWords += 1;
      const remainingLeadingControlCode = readLeadingControlCode(cleanedWords);
      if (remainingLeadingControlCode !== null) {
        residualLeadingControlBuckets.set(
          remainingLeadingControlCode,
          (residualLeadingControlBuckets.get(remainingLeadingControlCode) ?? 0) + 1
        );
      }
    }
    const isControlLike = looksLikeControlText(normalizedText);
    if (isControlLike && imageRefs.every((span) => span.source === null)) {
      node = node.tdi;
      continue;
    }

    const nodeId = readOptionalString(node.qli);
    const baseStyleRef = readOptionalNumber(node.sdi?.Msi);
    const paraStyleRef = baseStyleRef;
    const baseCharStyle = readStyleTableEntry(styleTables?.Y5n, baseStyleRef);
    const paraStyle = readStyleTableEntry(styleTables?.$5n, paraStyleRef);
    const baseFormatting = buildParagraphFormatting(
      baseCharStyle,
      paraStyle,
      baseStyleRef,
      paraStyleRef
    );
    const paragraphStyleVariant = formattingToParagraphStyleVariant(baseFormatting);
    const runPairs = buildRunPairs(node.Csi instanceof Uint32Array ? Array.from(node.Csi) : []);
    const cleanPrefix = buildCleanWordPrefix(nodeWords, removedIndexes);
    const textWithoutBreaks = buildCleanText(nodeWords, removedIndexes);
    const nodeRuns = buildNodeRuns(
      nodeWords,
      textWithoutBreaks,
      cleanPrefix,
      baseFormatting,
      paraStyle,
      paraStyleRef,
      runPairs
    );

    if (imageRefs.length === 0) {
      appendParagraphSegment(
        textWithoutBreaks,
        nodeRuns,
        nodeId,
        paraStyleRef,
        paragraphStyleVariant
      );
      node = node.tdi;
      continue;
    }

    let rawCursor = 0;
    for (const imageRef of imageRefs) {
      const segmentStart = mapRawOffsetToCleanOffset(cleanPrefix, rawCursor, nodeWords.length);
      const segmentEnd = mapRawOffsetToCleanOffset(cleanPrefix, imageRef.startWord, nodeWords.length);
      if (segmentEnd > segmentStart) {
        appendParagraphSegment(
          textWithoutBreaks.slice(segmentStart, segmentEnd),
          sliceRuns(nodeRuns, segmentStart, segmentEnd),
          nodeId,
          paraStyleRef,
          paragraphStyleVariant
        );
      }

      if (imageRef.source !== null) {
        flushParagraph();
        blocks.push({
          kind: "image",
          id:
            imageRef.objectNodeId ??
            imageRef.imageNodeId ??
            `${nodeId ?? `text-chain-image-${imageNodeCount}`}:${imageRef.objectId}`,
          altText:
            imageRef.extension === null
              ? `image ${imageRef.objectId}`
              : `image ${imageRef.objectId}.${imageRef.extension}`,
          source: imageRef.source
        });
        imageNodeCount += 1;
      }

      rawCursor = imageRef.endWordExclusive;
    }

    const trailingStart = mapRawOffsetToCleanOffset(cleanPrefix, rawCursor, nodeWords.length);
    const trailingEnd = mapRawOffsetToCleanOffset(cleanPrefix, nodeWords.length, nodeWords.length);
    if (trailingEnd > trailingStart) {
      appendParagraphSegment(
        textWithoutBreaks.slice(trailingStart, trailingEnd),
        sliceRuns(nodeRuns, trailingStart, trailingEnd),
        nodeId,
        paraStyleRef,
        paragraphStyleVariant
      );
    }
    node = node.tdi;
  }

  flushParagraph();

  if (imageNodeCount === 0) {
    warnings.push(
      "Table/image/page-boundary exact read-path is not fully confirmed; this snapshot currently exposes paragraphs and no direct image anchors from the sampled text chain."
    );
  } else {
    warnings.push(
      "Table/page-boundary exact read-path is not confirmed. Image nodes are emitted only when text-chain control placeholders resolve through Ivr.j5n.n4n and Ivr.u6n.U4n."
    );
  }
  if (nodesWithRecognizedPlaceholderSpans > 0) {
    warnings.push(
      `Removed recognized placeholder spans from ${nodesWithRecognizedPlaceholderSpans} text-chain node(s) before paragraph reconstruction.`
    );
  }
  if (nodesWithSectionMarkerCleanup > 0) {
    warnings.push(
      `Applied leading-31 section-marker cleanup to ${nodesWithSectionMarkerCleanup} text-chain node(s) after exact placeholder removal.`
    );
  }
  if (nodesWithResidualSeparator31Cleanup > 0) {
    warnings.push(
      `Applied residual separator-31 cleanup to ${nodesWithResidualSeparator31Cleanup} text-chain node(s) after exact placeholder removal.`
    );
  }
  if (nodesWithResidualControlWords > 0) {
    warnings.push(
      `Recognized placeholder removal still left residual control words in ${nodesWithResidualControlWords} node(s); exact clean-text reconstruction is not complete.`
    );
  }
  if (residualLeadingControlBuckets.size > 0) {
    warnings.push(
      `Residual non-placeholder control-prefix buckets remain after cleanup: ${Array.from(
        residualLeadingControlBuckets.entries()
      )
        .sort((left, right) => left[0] - right[0])
        .map(([controlCode, count]) => `${controlCode}(${count})`)
        .join(", ")}.`
    );
  }
  const residualLeading11Count = residualLeadingControlBuckets.get(11);
  if (typeof residualLeading11Count === "number" && residualLeading11Count > 0) {
    warnings.push(
      `Residual leading-11 control-prefix family remains in ${residualLeading11Count} node(s). Current evidence places this bucket near paragraph-tail/layout-control clusters, so the SDK preserves it instead of stripping without an exact runtime rule.`
    );
  }
  if (tableStructureEntries > 0) {
    if (tableCellRegistryEntries > 0 && hasTableSelectionBridge) {
      warnings.push(
        `Detected ${tableStructureEntries} table-structure candidate entries under Ivr.z5n.n4n. Exact table reconstruction remains disabled because current z5n structural snapshots and selection-time Zvr.$bi / Svr._ie -> Ivr.o6n.n4n joins still do not yield stable row/cell ordering.`
      );
    } else {
      warnings.push(
        `Detected ${tableStructureEntries} table-structure candidate entries under Ivr.z5n.n4n, but exact table reconstruction remains disabled because the o6n/selection bridge needed for cell ordering is unavailable in this runtime snapshot.`
      );
    }
  }
  const unanchoredImageIds = imageEntries
    .map((entry) => entry.imageId)
    .filter((imageId) => !directPlaceholderImageIds.has(imageId));
  if (unanchoredImageIds.length > 0) {
    warnings.push(
      `Loaded image asset ids ${unanchoredImageIds.join(", ")} exist in Ivr.u6n.U4n but were excluded from exact image blocks because they do not have a direct text-chain control anchor through Ivr.j5n.n4n in this document.`
    );
  }
  if (strippedObjectPlaceholderIds.size > 0) {
    warnings.push(
      `Stripped direct object placeholder ids ${Array.from(strippedObjectPlaceholderIds)
        .sort((left, right) => left - right)
        .join(", ")} from paragraph text because they resolve through Ivr.j5n.n4n but do not join Ivr.u6n.U4n as exact placed images.`
    );
  }
  if (strippedImagePlaceholderIdsMissingPayload.size > 0) {
    warnings.push(
      `Skipped direct image placeholder ids ${Array.from(strippedImagePlaceholderIdsMissingPayload)
        .sort((left, right) => left - right)
        .join(", ")} because exact image blocks require a loaded cache.images payload.`
    );
  }

  return {
    metadata: {
      title: document.title,
      capturedAt: new Date().toISOString(),
      source: "text-chain"
    },
    capabilities: {
      paragraphs: true,
      inlineRuns: true,
      tables: false,
      images: imageNodeCount > 0,
      pageBoundaries: false
    },
    warnings,
    blocks
  };
}

type HwpAppLike = Record<PropertyKey, unknown> & {
  Core?: unknown;
  ActionManager?: unknown;
  Models?: unknown;
  UIAPI?: Record<PropertyKey, unknown>;
  cache?: {
    images?: Record<string, unknown>;
  };
  document?: unknown;
};

type TextChainNodeLike = Record<PropertyKey, unknown> & {
  Aoi: Uint16Array;
  Csi?: Uint32Array;
  qli?: unknown;
  Ooi?: unknown;
  koi?: unknown;
  Hoi?: unknown;
  Moi?: unknown;
  Noi?: unknown;
  Jci?: unknown;
  idi?: unknown;
  ndi?: unknown;
  sdi?: {
    Msi?: unknown;
  };
  tdi?: unknown;
};
