/**
 * Parses `git diff --unified=0` output into the 1-based line numbers that were
 * added or changed in the new version of each file.
 *
 * Rename and copy headers (`rename from`/`rename to`, `copy from`/`copy to`,
 * `similarity index`) are recognized so a moved file is keyed by its new path.
 * A 100% similar rename or copy has no hunks, so it contributes no added lines.
 */
export const parseAddedLines = (diff: string): Map<string, Set<number>> => {
  const result = new Map<string, Set<number>>();
  let current: Set<number> | undefined;
  for (const raw of diff.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith("diff --git ")) {
      current = undefined;
      continue;
    }
    const renamedTo = /^rename to (.+)$/.exec(line);
    const copiedTo = /^copy to (.+)$/.exec(line);
    if (renamedTo || copiedTo) {
      const relative = unquote((renamedTo?.[1] ?? copiedTo?.[1] ?? "").trim());
      // Record the destination only when a later hunk adds lines.
      current = result.get(relative);
      continue;
    }
    if (line.startsWith("+++ ")) {
      const target = unquote(line.slice(4).trim().split("\t")[0] ?? "");
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
