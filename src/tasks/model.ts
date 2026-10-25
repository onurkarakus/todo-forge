import type { Subtask, TaskPriority, TaskSource, TodoMatch, TrackedTask } from "../types";
import { createId } from "../utils/id";

const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const isDueDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
};

export const sortTasks = (tasks: readonly TrackedTask[]): TrackedTask[] => {
  return [...tasks].sort((left, right) => {
    if (left.done !== right.done) {
      return left.done ? 1 : -1;
    }
    if (PRIORITY_RANK[left.priority] !== PRIORITY_RANK[right.priority]) {
      return PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    }
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.title.localeCompare(right.title);
  });
};

export const taskFromMatch = (match: TodoMatch, order: number): TrackedTask => {
  const source: TaskSource = {
    uri: match.uri,
    line: match.line,
    tag: match.tag,
    text: match.text,
  };
  return {
    id: createId(),
    title: match.text || match.raw.trim() || match.tag,
    priority: "medium",
    note: "",
    done: false,
    order,
    subtasks: [],
    sources: [source],
  };
};

export const findTaskForMatch = (
  tasks: readonly TrackedTask[],
  match: Pick<TodoMatch, "uri" | "line" | "tag">,
): TrackedTask | undefined => {
  return tasks.find((task) =>
    task.sources.some(
      (source) => source.uri === match.uri && source.line === match.line && source.tag === match.tag,
    ),
  );
};

export const toggleTaskDone = (tasks: readonly TrackedTask[], id: string): TrackedTask[] => {
  return tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task));
};

export const toggleSubtask = (
  tasks: readonly TrackedTask[],
  taskId: string,
  subtaskId: string,
): TrackedTask[] => {
  return tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }
    return {
      ...task,
      subtasks: task.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask,
      ),
    };
  });
};

export const reorderWithin = <T extends { id: string; order: number }>(
  items: readonly T[],
  draggedId: string,
  targetId: string | undefined,
): T[] => {
  const next = [...items];
  const from = next.findIndex((item) => item.id === draggedId);
  if (from < 0) {
    return next.map((item, order) => ({ ...item, order }));
  }
  const [dragged] = next.splice(from, 1);
  if (!dragged) {
    return items.map((item, order) => ({ ...item, order }));
  }
  if (!targetId) {
    next.push(dragged);
  } else {
    let to = next.findIndex((item) => item.id === targetId);
    if (to < 0) {
      to = next.length;
    }
    next.splice(to, 0, dragged);
  }
  return next.map((item, order) => ({ ...item, order }));
};

export const reorderTasks = (
  tasks: readonly TrackedTask[],
  draggedId: string,
  targetId: string | undefined,
): TrackedTask[] => {
  return reorderWithin(sortTasks(tasks), draggedId, targetId);
};

export const reorderSubtasks = (
  tasks: readonly TrackedTask[],
  taskId: string,
  draggedId: string,
  targetId: string | undefined,
): TrackedTask[] => {
  return tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }
    const subtasks = reorderWithin(
      [...task.subtasks].sort((left, right) => left.order - right.order),
      draggedId,
      targetId,
    );
    return { ...task, subtasks };
  });
};

export const addSubtask = (task: TrackedTask, title: string): TrackedTask => {
  const subtask: Subtask = {
    id: createId(),
    title: title.trim(),
    done: false,
    order: task.subtasks.length,
  };
  return { ...task, subtasks: [...task.subtasks, subtask] };
};

const isPriority = (value: unknown): value is TaskPriority => {
  return value === "high" || value === "medium" || value === "low";
};

const readSubtask = (value: unknown, index: number): Subtask | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.title !== "string") {
    return undefined;
  }
  return {
    id: typeof record.id === "string" ? record.id : createId(),
    title: record.title,
    done: record.done === true,
    order: typeof record.order === "number" ? record.order : index,
  };
};

const readSource = (value: unknown): TaskSource | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.uri !== "string" || typeof record.tag !== "string") {
    return undefined;
  }
  return {
    uri: record.uri,
    line: typeof record.line === "number" ? record.line : 0,
    tag: record.tag,
    text: typeof record.text === "string" ? record.text : "",
  };
};

export const readTask = (value: unknown, index: number): TrackedTask | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.title !== "string" || record.title.trim().length === 0) {
    return undefined;
  }
  const dueDate = typeof record.dueDate === "string" && isDueDate(record.dueDate) ? record.dueDate : undefined;
  const subtasks = Array.isArray(record.subtasks)
    ? record.subtasks
        .map((entry, subIndex) => readSubtask(entry, subIndex))
        .filter((entry): entry is Subtask => entry !== undefined)
    : [];
  const sources = Array.isArray(record.sources)
    ? record.sources
        .map((entry) => readSource(entry))
        .filter((entry): entry is TaskSource => entry !== undefined)
    : [];
  return {
    id: typeof record.id === "string" ? record.id : createId(),
    title: record.title.trim(),
    priority: isPriority(record.priority) ? record.priority : "medium",
    dueDate,
    note: typeof record.note === "string" ? record.note : "",
    done: record.done === true,
    order: typeof record.order === "number" ? record.order : index,
    subtasks,
    sources,
  };
};

export const parseTaskFile = (
  raw: string,
): { tasks: TrackedTask[]; error?: string } => {
  try {
    const parsed = JSON.parse(raw) as { tasks?: unknown };
    if (!parsed || !Array.isArray(parsed.tasks)) {
      return { tasks: [], error: "Task file has no tasks array." };
    }
    const tasks = parsed.tasks
      .map((entry, index) => readTask(entry, index))
      .filter((entry): entry is TrackedTask => entry !== undefined);
    return { tasks };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { tasks: [], error: message };
  }
};

export const serializeTasks = (tasks: readonly TrackedTask[]): string => {
  return `${JSON.stringify({ version: 1, tasks }, null, 2)}\n`;
};

export interface TaskDraft {
  title: string;
  priority: TaskPriority;
  dueDate: string;
  note: string;
  subtasks: { title: string; done: boolean }[];
}

export const applyDraft = (task: TrackedTask, draft: TaskDraft): { task?: TrackedTask; error?: string } => {
  const title = draft.title.trim();
  if (!title) {
    return { error: "Title is required." };
  }
  if (draft.dueDate.trim() && !isDueDate(draft.dueDate.trim())) {
    return { error: "Due date must be YYYY-MM-DD." };
  }
  const subtasks: Subtask[] = draft.subtasks
    .map((subtask, index) => ({
      id: task.subtasks[index]?.id ?? createId(),
      title: subtask.title.trim(),
      done: subtask.done,
      order: index,
    }))
    .filter((subtask) => subtask.title.length > 0);
  return {
    task: {
      ...task,
      title,
      priority: draft.priority,
      dueDate: draft.dueDate.trim() || undefined,
      note: draft.note,
      subtasks,
    },
  };
};
