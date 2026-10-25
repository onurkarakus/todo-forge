export const enabledExcludeGlobs = (value: unknown): string[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  const globs: string[] = [];
  for (const [glob, enabled] of Object.entries(value as Record<string, unknown>)) {
    if (enabled === true && glob.trim().length > 0) {
      globs.push(glob);
    }
  }
  return globs;
};

export const toRgExclude = (glob: string): string => {
  return glob.startsWith("!") ? glob : `!${glob}`;
};

export const mergeExcludes = (...groups: readonly (readonly string[])[]): string[] => {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const group of groups) {
    for (const glob of group) {
      const trimmed = glob.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      merged.push(trimmed);
    }
  }
  return merged;
};
