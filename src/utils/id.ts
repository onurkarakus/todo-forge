export const createId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const matchId = (
  uri: string,
  line: number,
  column: number,
  kind: string,
  tag: string,
): string => {
  return `${kind}:${uri}:${line}:${column}:${tag}`;
};
