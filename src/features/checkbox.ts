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
