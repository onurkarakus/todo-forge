export const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const tagAlternation = (tags: readonly string[]): string => {
  const unique = [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))];
  unique.sort((left, right) => right.length - left.length);
  return unique.map(escapeRegex).join("|");
};

export interface CompiledMatcher {
  regex: RegExp;
  custom: boolean;
  error?: string;
}

const COMMENT_LEAD =
  /(?:\/\/\/?|\/\*|<!--|--|#|;|%|@\*|\(\*|(?:^|\s)'|(?:^|\s)\*)\s*$/;

export const isCommentContext = (prefix: string): boolean => {
  if (/^\s*$/.test(prefix)) {
    return true;
  }
  if (/["`]/.test(prefix.slice(-1))) {
    return false;
  }
  return COMMENT_LEAD.test(prefix);
};

export const buildRgPattern = (tags: readonly string[], markdownEnabled: boolean): string => {
  const alt = tagAlternation(tags);
  const tagPart = alt.length > 0 ? `\\b(?:${alt})\\b` : "\\bTODO\\b";
  if (!markdownEnabled) {
    return tagPart;
  }
  return `(?:${tagPart}|^\\s*(?:[-*+]|\\d+[.)])\\s+\\[[ xX]\\])`;
};

export const compileMatcher = (
  tags: readonly string[],
  caseSensitive: boolean,
  custom: string,
): CompiledMatcher => {
  const flags = caseSensitive ? "g" : "gi";
  const alt = tagAlternation(tags);
  const fallbackSource = `(?<![\\w])(?<tag>${alt.length > 0 ? alt : "TODO"})\\b`;
  const trimmed = custom.trim();
  if (!trimmed) {
    return { regex: new RegExp(fallbackSource, flags), custom: false };
  }

  const source = trimmed.replaceAll("$TAGS", alt.length > 0 ? alt : "TODO");
  try {
    return { regex: new RegExp(source, flags), custom: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      regex: new RegExp(fallbackSource, flags),
      custom: false,
      error: `Custom regex was rejected: ${message}`,
    };
  }
};

export const canonicalTag = (
  matched: string,
  tags: readonly string[],
  caseSensitive: boolean,
): string => {
  if (caseSensitive) {
    return tags.find((tag) => tag === matched) ?? matched;
  }
  const lower = matched.toLowerCase();
  return tags.find((tag) => tag.toLowerCase() === lower) ?? matched;
};
