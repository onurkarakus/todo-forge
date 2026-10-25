import type { TodoMatch } from "../types";

export const filterMatches = (matches: readonly TodoMatch[], query: string): TodoMatch[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...matches];
  }
  return matches.filter((match) => {
    const haystack = [
      match.tag,
      match.text,
      match.relativePath,
      match.subTag ?? "",
      match.raw,
    ]
      .join("\n")
      .toLowerCase();
    return haystack.includes(needle);
  });
};
