import picomatch from "picomatch";

/**
 * Applies the scan's include and exclude globs to explicit file paths.
 * ripgrep skips its own glob and ignore rules for paths passed on the
 * command line, so incremental scans filter paths here first.
 */
export interface PathFilter {
  accepts: (relativePosixPath: string) => boolean;
}

const ALWAYS_EXCLUDED = [".git", "**/.git", "**/.git/**", ".git/**"];

const compile = (globs: readonly string[]): ((value: string) => boolean) | undefined => {
  const cleaned = globs
    .map((glob) => glob.trim().replace(/^!/, ""))
    .filter((glob) => glob.length > 0);
  if (cleaned.length === 0) {
    return undefined;
  }
  const withSlash = cleaned.filter((glob) => glob.includes("/"));
  const baseOnly = cleaned.filter((glob) => !glob.includes("/"));
  const full = withSlash.length > 0 ? picomatch(withSlash, { dot: true }) : undefined;
  const base = baseOnly.length > 0 ? picomatch(baseOnly, { dot: true, basename: true }) : undefined;
  return (value: string): boolean => Boolean(full?.(value) || base?.(value));
};

const prefixes = (relative: string): string[] => {
  const parts = relative.split("/").filter((part) => part.length > 0);
  const result: string[] = [];
  for (let index = 1; index <= parts.length; index += 1) {
    result.push(parts.slice(0, index).join("/"));
  }
  return result;
};

export const createPathFilter = (
  excludeGlobs: readonly string[],
  includeGlobs: readonly string[],
): PathFilter => {
  const excluded = compile([...ALWAYS_EXCLUDED, ...excludeGlobs]);
  const included = compile(includeGlobs);
  return {
    accepts: (relativePosixPath: string): boolean => {
      const relative = relativePosixPath.replace(/^\.\//, "");
      if (relative.startsWith("../") || relative.length === 0) {
        return false;
      }
      if (excluded && prefixes(relative).some((candidate) => excluded(candidate))) {
        return false;
      }
      if (included && !included(relative)) {
        return false;
      }
      return true;
    },
  };
};
