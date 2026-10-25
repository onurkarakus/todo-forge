import type { TodoMatch } from "../types";
import { fileNameOf } from "../utils/paths";

export const formatMatchLabel = (format: string, match: TodoMatch): string => {
  return format
    .replaceAll("${tag}", match.tag)
    .replaceAll("${text}", match.text)
    .replaceAll("${file}", fileNameOf(match.relativePath))
    .replaceAll("${line}", String(match.line + 1))
    .replaceAll("${subtag}", match.subTag ?? "");
};
