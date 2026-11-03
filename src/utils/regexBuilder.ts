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
  /** Finds a tag inside a custom-regex match that has no `tag` group. */
  tagFinder: RegExp;
  custom: boolean;
  error?: string;
}

/** Patterns for .NET code that marks unfinished work without a comment tag. */
export const DOTNET_RG_PATTERN = "NotImplementedException|\\[Obsolete|<Obsolete|#warning";

export const buildRgPattern = (
  tags: readonly string[],
  markdownEnabled: boolean,
  dotnetPatterns = false,
): string => {
  const alt = tagAlternation(tags);
  const parts = [alt.length > 0 ? `\\b(?:${alt})\\b` : "\\bTODO\\b"];
  if (markdownEnabled) {
    parts.push("^\\s*(?:[-*+]|\\d+[.)])\\s+\\[[ xX]\\]");
  }
  if (dotnetPatterns) {
    parts.push(DOTNET_RG_PATTERN);
  }
  return parts.length === 1 ? parts[0] ?? "" : `(?:${parts.join("|")})`;
};

/** Adds a named `tag` group around `$TAGS` so a migrated Todo Tree regex keeps its tag. */
export const ensureTagGroup = (pattern: string): string => {
  if (pattern.includes("(?<tag>") || !pattern.includes("$TAGS")) {
    return pattern;
  }
  return pattern.replace(/\(\$TAGS\)/g, "$TAGS").replaceAll("$TAGS", "(?<tag>$TAGS)");
};

export const compileMatcher = (
  tags: readonly string[],
  caseSensitive: boolean,
  custom: string,
): CompiledMatcher => {
  const flags = caseSensitive ? "g" : "gi";
  const alt = tagAlternation(tags);
  const body = alt.length > 0 ? alt : "TODO";
  const fallbackSource = `(?<![\\w])(?<tag>${body})\\b`;
  const tagFinder = new RegExp(`(?<![\\w])(?:${body})\\b`, caseSensitive ? "" : "i");
  const trimmed = custom.trim();
  if (!trimmed) {
    return { regex: new RegExp(fallbackSource, flags), tagFinder, custom: false };
  }

  const source = trimmed.replaceAll("$TAGS", body);
  try {
    return { regex: new RegExp(source, flags), tagFinder, custom: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      regex: new RegExp(fallbackSource, flags),
      tagFinder,
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
