export interface PathCoalescer {
  push: (path: string) => void;
  dispose: () => void;
}

export const coalescePaths = (
  fn: (paths: string[]) => void,
  waitMs: number,
  maxBatch: number,
): PathCoalescer => {
  let paths = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (paths.size === 0) {
      return;
    }
    const batch = [...paths];
    paths = new Set();
    fn(batch);
  };

  return {
    push: (path: string): void => {
      paths.add(path);
      if (paths.size >= maxBatch) {
        flush();
        return;
      }
      if (!timer) {
        timer = setTimeout(flush, waitMs);
      }
    },
    dispose: (): void => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      paths = new Set();
    },
  };
};
