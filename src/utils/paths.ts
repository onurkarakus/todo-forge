import path from "node:path";

export const toPosixPath = (value: string): string => {
  return value.split(path.sep).join("/");
};

export const relativePosix = (folder: string, file: string): string => {
  const relative = path.relative(folder, file);
  if (!relative || relative.startsWith("..")) {
    return toPosixPath(file);
  }
  return toPosixPath(relative);
};

export const fileNameOf = (filePath: string): string => {
  const normalized = toPosixPath(filePath);
  const slash = normalized.lastIndexOf("/");
  return slash === -1 ? normalized : normalized.slice(slash + 1);
};

export const folderGlob = (relativeFolder: string): string => {
  const posix = toPosixPath(relativeFolder).replace(/^\.\/|\/$/g, "");
  if (!posix) {
    return "**/*";
  }
  return `**/${posix}/**`;
};
