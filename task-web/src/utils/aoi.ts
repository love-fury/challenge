/* eslint-disable complexity */

export interface AoiRegistryMatch {
  index?: number | null;
  objectNodeId?: string | null;
  registryType?: number | null;
  cacheKey?: string | null;
}

export interface AoiPlaceholderSpan {
  startWord: number;
  endWordExclusive: number;
  controlCode: number;
  repeatControlCode: number;
  token: string;
  objectId: number;
  rawWords: number[];
  objectMatch?: AoiRegistryMatch;
  imageMatch?: AoiRegistryMatch;
}

export interface AoiControlPrefixContext {
  Ooi?: number | null;
  koi?: number | null;
  Hoi?: number | null;
  Moi?: number | null;
  Noi?: number | null;
  Jci?: number | null;
}

export interface AoiControlPrefixCleanupResult {
  cleanedWords: number[];
  removedWordValues: number[];
  appliedRules: string[];
  remainingLeadingControlCode: number | null;
}

interface DetectAoiPlaceholderSpansOptions {
  resolveObject?: (objectId: number) => AoiRegistryMatch | null | undefined;
  resolveImage?: (objectId: number) => AoiRegistryMatch | null | undefined;
}

export function decodeAoiWords(words: readonly number[]): string {
  return words
    .map((word) => String.fromCharCode(word))
    .join("")
    .replace(/\0/g, "");
}

export function decodeAoiToken(left: number, right: number): string {
  const bytes = Array.from(new Uint8Array(Uint16Array.of(left, right).buffer)).filter(
    (byte) => byte !== 0
  );
  return String.fromCharCode(...bytes);
}

export function looksLikeAoiAsciiToken(token: string): boolean {
  return /^[ -~]{3,4}$/.test(token);
}

export function detectAoiPlaceholderSpans(
  words: readonly number[],
  options: DetectAoiPlaceholderSpansOptions = {}
): AoiPlaceholderSpan[] {
  const isIntegerWord = (value: number | undefined): value is number =>
    typeof value === "number" && Number.isInteger(value);
  const spans: AoiPlaceholderSpan[] = [];
  let index = 0;

  while (index + 7 < words.length) {
    const controlCode = words[index];
    const tokenLeft = words[index + 1];
    const tokenRight = words[index + 2];
    const objectId = words[index + 3];
    const zeroA = words[index + 4];
    const zeroB = words[index + 5];
    const zeroC = words[index + 6];
    const repeatControlCode = words[index + 7];

    if (
      !isIntegerWord(controlCode) ||
      !isIntegerWord(tokenLeft) ||
      !isIntegerWord(tokenRight) ||
      !isIntegerWord(objectId) ||
      !isIntegerWord(zeroA) ||
      !isIntegerWord(zeroB) ||
      !isIntegerWord(zeroC) ||
      !isIntegerWord(repeatControlCode)
    ) {
      index += 1;
      continue;
    }

    const token = decodeAoiToken(tokenLeft, tokenRight);
    const objectMatch = options.resolveObject?.(objectId) ?? null;
    const imageMatch = options.resolveImage?.(objectId) ?? null;

    const isExactPlaceholderFamily =
      controlCode === repeatControlCode &&
      zeroA === 0 &&
      zeroB === 0 &&
      zeroC === 0 &&
      looksLikeAoiAsciiToken(token) &&
      objectMatch !== null;

    if (!isExactPlaceholderFamily) {
      index += 1;
      continue;
    }

    spans.push({
      startWord: index,
      endWordExclusive: index + 8,
      controlCode,
      repeatControlCode,
      token,
      objectId,
      rawWords: words.slice(index, index + 8),
      ...(objectMatch === null ? {} : { objectMatch }),
      ...(imageMatch === null ? {} : { imageMatch })
    });
    index += 8;
  }

  return spans;
}

export function stripAoiPlaceholderSpans(
  words: readonly number[],
  spans: readonly Pick<AoiPlaceholderSpan, "startWord" | "endWordExclusive">[]
): number[] {
  if (spans.length === 0) {
    return [...words];
  }

  const removedIndexes = new Set<number>();
  for (const span of spans) {
    for (let index = span.startWord; index < span.endWordExclusive; index += 1) {
      removedIndexes.add(index);
    }
  }

  return words.filter((_, index) => !removedIndexes.has(index));
}

export function hasMeaningfulAoiText(text: string): boolean {
  return /[가-힣A-Za-z0-9]/.test(text);
}

export function cleanupAoiControlPrefixWords(
  words: readonly number[],
  context: AoiControlPrefixContext = {}
): AoiControlPrefixCleanupResult {
  const isIgnoredWord = (word: number): boolean =>
    word === 0 || word === 9 || word === 10 || word === 13 || word === 32;
  const readLeadingControlCode = (candidateWords: readonly number[]): number | null => {
    const firstMeaningfulWord = candidateWords.find((word) => !isIgnoredWord(word));
    return typeof firstMeaningfulWord === "number" &&
      firstMeaningfulWord >= 1 &&
      firstMeaningfulWord <= 31
      ? firstMeaningfulWord
      : null;
  };
  const matchesOptionalFlag = (value: number | null | undefined, expected: number): boolean =>
    value === undefined || value === null || value === expected;

  const leadingControlCode = readLeadingControlCode(words);
  const shouldStripSectionMarker31 =
    leadingControlCode === 31 &&
    context.Jci === -2147483648 &&
    matchesOptionalFlag(context.Ooi, 4) &&
    matchesOptionalFlag(context.koi, 2) &&
    matchesOptionalFlag(context.Hoi, 1) &&
    matchesOptionalFlag(context.Moi, 1) &&
    matchesOptionalFlag(context.Noi, 8);

  if (!shouldStripSectionMarker31) {
    return {
      cleanedWords: [...words],
      removedWordValues: [],
      appliedRules: [],
      remainingLeadingControlCode: leadingControlCode
    };
  }

  const cleanedWords = words.filter((word) => word !== 31);

  return {
    cleanedWords,
    removedWordValues: words.filter((word) => word === 31),
    appliedRules: ["strip-leading-31-section-marker"],
    remainingLeadingControlCode: readLeadingControlCode(cleanedWords)
  };
}
