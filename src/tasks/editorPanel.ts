import * as vscode from "vscode";

import type { TaskPriority, TrackedTask } from "../types";
import type { TaskDraft } from "./model";

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
};

const subtaskLines = (task: TrackedTask): string => {
  return [...task.subtasks]
    .sort((left, right) => left.order - right.order)
    .map((subtask) => `${subtask.done ? "[x] " : ""}${subtask.title}`)
    .join("\n");
};

export const openTaskEditor = async (task: TrackedTask): Promise<TaskDraft | undefined> => {
  const panel = vscode.window.createWebviewPanel(
    "todoforge.taskEditor",
    `Edit ${task.title}`,
    vscode.ViewColumn.Active,
    { enableScripts: true },
  );
  const nonce = `${Date.now()}${Math.random().toString(16).slice(2)}`;
  panel.webview.html = html(task, nonce);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (draft: TaskDraft | undefined): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(draft);
      panel.dispose();
    };
    panel.onDidDispose(() => finish(undefined));
    panel.webview.onDidReceiveMessage((message: { type?: string; draft?: TaskDraft }) => {
      if (message.type === "cancel") {
        finish(undefined);
        return;
      }
      if (message.type === "save" && message.draft) {
        finish(message.draft);
      }
    });
  });
};

const html = (task: TrackedTask, nonce: string): string => {
  const priority = (value: TaskPriority): string => {
    return task.priority === value ? "selected" : "";
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <title>Edit task</title>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px; }
    label { display: block; margin-top: 12px; }
    input, select, textarea { width: 100%; margin-top: 4px; box-sizing: border-box; }
    textarea { min-height: 80px; }
    .actions { margin-top: 16px; display: flex; gap: 8px; }
  </style>
</head>
<body>
  <label>Title<input id="title" value="${escapeHtml(task.title)}" /></label>
  <label>Priority
    <select id="priority">
      <option value="high" ${priority("high")}>High</option>
      <option value="medium" ${priority("medium")}>Medium</option>
      <option value="low" ${priority("low")}>Low</option>
    </select>
  </label>
  <label>Due date<input id="due" placeholder="YYYY-MM-DD" value="${escapeHtml(task.dueDate ?? "")}" /></label>
  <label>Note<textarea id="note">${escapeHtml(task.note)}</textarea></label>
  <label>Subtasks, one per line. Prefix [x] when done.<textarea id="subtasks">${escapeHtml(subtaskLines(task))}</textarea></label>
  <div class="actions">
    <button id="save">Save</button>
    <button id="cancel">Cancel</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const readSubtasks = () => document.getElementById("subtasks").value.split(/\\n/).map((line) => {
      const done = /^\\s*\\[x\\]\\s*/i.test(line);
      const title = line.replace(/^\\s*\\[x\\]\\s*/i, "").trim();
      return { title, done };
    }).filter((item) => item.title);
    document.getElementById("save").addEventListener("click", () => {
      vscode.postMessage({
        type: "save",
        draft: {
          title: document.getElementById("title").value,
          priority: document.getElementById("priority").value,
          dueDate: document.getElementById("due").value,
          note: document.getElementById("note").value,
          subtasks: readSubtasks()
        }
      });
    });
    document.getElementById("cancel").addEventListener("click", () => vscode.postMessage({ type: "cancel" }));
  </script>
</body>
</html>`;
};
