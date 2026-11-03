/**
 * Parses `git diff --unified=0` output into the 1-based line numbers that were
 * added or changed in the new version of each file.
 */
export const parseAddedLines = (diff: string): Map<string, Set<number>> => {
  const result = new Map<string, Set<number>>();
  let current: Set<number> | undefined;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      const target = unquote(line.slice(4).trim());
      if (target === "/dev/null") {
        current = undefined;
        continue;
      }
      const relative = target.startsWith("b/") ? target.slice(2) : target;
      current = result.get(relative) ?? new Set<number>();
      result.set(relative, current);
      continue;
    }
    if (!current || !line.startsWith("@@")) {
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk) {
      continue;
    }
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    for (let offset = 0; offset < count; offset += 1) {
      current.add(start + offset);
    }
  }
  return result;
};

const unquote = (value: string): string => {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    return value;
  }
  return value
    .slice(1, -1)
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
};
