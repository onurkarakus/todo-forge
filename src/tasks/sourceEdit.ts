export const replaceTagOnLine = (
  line: string,
  tag: string,
  column: number,
): string | undefined => {
  const slice = line.slice(column, column + tag.length);
  if (slice.toLowerCase() === tag.toLowerCase()) {
    return `${line.slice(0, column)}DONE${line.slice(column + tag.length)}`;
  }
  const lower = line.toLowerCase();
  const found = lower.indexOf(tag.toLowerCase());
  if (found < 0) {
    return undefined;
  }
  return `${line.slice(0, found)}DONE${line.slice(found + tag.length)}`;
};

export const setCheckboxLine = (line: string, checked: boolean): string | undefined => {
  const match = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\].*)$/.exec(line);
  if (!match) {
    return undefined;
  }
  const mark = checked ? "x" : " ";
  return `${match[1] ?? ""}${mark}${match[3] ?? ""}`;
};

export const toggleCheckboxLine = (line: string): string | undefined => {
  const match = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\].*)$/.exec(line);
  if (!match) {
    return undefined;
  }
  const current = match[2] ?? " ";
  return setCheckboxLine(line, current.toLowerCase() !== "x");
};
