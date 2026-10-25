export interface SubTagResult {
  subTag?: string;
  text: string;
  invalidPattern?: string;
}

const trimSeparators = (value: string): string => {
  return value.replace(/^[\s:.\-]+/, "").replace(/[\s:.\-]+$/, "").trim();
};

export const extractSubTag = (after: string, pattern: string): SubTagResult => {
  const trimmed = trimSeparators(after);
  if (!pattern.trim()) {
    return { text: trimmed };
  }

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, "i");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { text: trimmed, invalidPattern: message };
  }

  const match = regex.exec(trimmed);
  if (!match) {
    return { text: trimmed };
  }

  const subTag = match.slice(1).find((group) => group !== undefined && group.length > 0);
  if (!subTag) {
    return { text: trimmed };
  }

  const start = match.index;
  const removed = trimmed.slice(0, start) + trimmed.slice(start + match[0].length);
  return { subTag, text: trimSeparators(removed) };
};
