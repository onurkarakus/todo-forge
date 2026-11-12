/**
 * Parsers for tag lists exported by other IDEs. They read files the user
 * picks; nothing is fetched.
 */

export const VISUAL_STUDIO_DEFAULT_TAGS = ["TODO", "HACK", "UNDONE"];
export const RIDER_DEFAULT_TAGS = ["TODO", "BUG"];

const decodeXml = (value: string): string => {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
};

const unique = (tags: readonly string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed || seen.has(trimmed.toUpperCase())) {
      continue;
    }
    seen.add(trimmed.toUpperCase());
    result.push(trimmed);
  }
  return result;
};

/**
 * Reads tags from a ReSharper/Rider `.DotSettings` file. Patterns are regexes
 * such as `(\W|^)(?<TAG>TODO)(\W|$)(.*)`; the TAG group holds the word.
 */
export const parseRiderDotSettings = (xml: string): string[] => {
  const tags: string[] = [];
  const entry = /<s:String x:Key="\/Default\/PatternsAndTemplates\/Todo\/TodoPatterns\/=[^/"]+\/(Pattern|Name)\/@EntryValue">([^<]*)<\/s:String>/g;
  const names: string[] = [];
  for (const found of xml.matchAll(entry)) {
    const kind = found[1];
    const value = decodeXml(found[2] ?? "");
    if (kind === "Pattern") {
      const group = /\(\?<TAG>([^)]*)\)/i.exec(value);
      if (group?.[1]) {
        tags.push(...group[1].split("|").map((tag) => tag.replace(/\\b/g, "").replace(/[^A-Za-z0-9_-]/g, "")));
      }
    } else {
      names.push(value);
    }
  }
  if (tags.length === 0) {
    tags.push(...names.map((name) => name.toUpperCase().replace(/[^A-Z0-9_-]/g, "")));
  }
  return unique(tags.filter((tag) => tag.length > 0 && !/^NOTIMPLEMENTED$/i.test(tag)));
};

/**
 * Reads Task List tokens from a Visual Studio `.vssettings` export. Tokens look
 * like `TODO:2;HACK:2` or `"TODO":2,"HACK":2` depending on the VS version.
 */
export const parseVisualStudioSettings = (xml: string): string[] => {
  const property = /<PropertyValue name="CommentTokens">([^<]*)<\/PropertyValue>/i.exec(xml);
  const raw = property ? decodeXml(property[1] ?? "") : "";
  const tags: string[] = [];
  for (const found of raw.matchAll(/"?([A-Za-z][\w-]*)"?\s*:\s*\d/g)) {
    tags.push(found[1] ?? "");
  }
  return unique(tags.filter((tag) => tag !== "UnresolvedMergeConflict"));
};

export const mergeTags = (current: readonly string[], incoming: readonly string[]): string[] => {
  return unique([...current, ...incoming]);
};

export interface MappedCommentMarkers {
  markers: { tag: string; color?: string; backgroundColor?: string; bold?: boolean; italic?: boolean; strikethrough?: boolean; underline?: boolean }[];
  ignored: string[];
}

/**
 * Maps Better Comments / Better Comments Next `tags` arrays. Tags that are
 * already TodoForge TODO words (TODO, FIXME, …) are skipped so they stay in
 * the tree instead of becoming editor-only markers.
 */
export const mapBetterCommentsTags = (value: unknown, todoTags: readonly string[] = []): MappedCommentMarkers => {
  const ignored: string[] = [];
  const markers: MappedCommentMarkers["markers"] = [];
  if (!Array.isArray(value)) {
    return { markers, ignored };
  }
  const reserved = new Set(todoTags.map((tag) => tag.toLowerCase()));
  reserved.add("todo");
  reserved.add("fixme");
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.tag !== "string" || record.tag.length === 0) {
      continue;
    }
    if (reserved.has(record.tag.toLowerCase())) {
      ignored.push(record.tag);
      continue;
    }
    const marker: MappedCommentMarkers["markers"][number] = { tag: record.tag };
    if (typeof record.color === "string") {
      marker.color = record.color;
    }
    if (typeof record.backgroundColor === "string" && record.backgroundColor !== "transparent") {
      marker.backgroundColor = record.backgroundColor;
    }
    if (record.bold === true) {
      marker.bold = true;
    }
    if (record.italic === true) {
      marker.italic = true;
    }
    if (record.strikethrough === true) {
      marker.strikethrough = true;
    }
    if (record.underline === true) {
      marker.underline = true;
    }
    markers.push(marker);
  }
  return { markers, ignored };
};
