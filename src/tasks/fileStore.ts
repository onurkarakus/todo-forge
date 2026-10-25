import fs from "node:fs/promises";
import path from "node:path";

import type { TrackedTask } from "../types";
import { errorMessage } from "../utils/errors";
import { parseTaskFile, serializeTasks } from "./model";

export const TASK_FILE = ".vscode/todoforge.tasks.json";

export const writeAtomic = async (file: string, contents: string): Promise<void> => {
  const directory = path.dirname(file);
  await fs.mkdir(directory, { recursive: true });
  const temp = path.join(directory, `.${path.basename(file)}.${process.pid}.tmp`);
  await fs.writeFile(temp, contents, "utf8");
  await fs.rename(temp, file);
};

export const readTaskFile = async (
  file: string,
): Promise<{ tasks: TrackedTask[]; error?: string }> => {
  try {
    const raw = await fs.readFile(file, "utf8");
    return parseTaskFile(raw);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { tasks: [] };
    }
    return { tasks: [], error: errorMessage(error) };
  }
};

export const writeTaskFile = async (file: string, tasks: readonly TrackedTask[]): Promise<void> => {
  await writeAtomic(file, serializeTasks(tasks));
};

export const taskFilePath = (workspaceFolder: string): string => {
  return path.join(workspaceFolder, TASK_FILE);
};
