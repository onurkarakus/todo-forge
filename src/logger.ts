import type * as vscode from "vscode";

let channel: vscode.LogOutputChannel | undefined;

export const initLogger = (output: vscode.LogOutputChannel): void => {
  channel = output;
};

export const logInfo = (message: string): void => {
  channel?.info(message);
};

export const logError = (message: string, error?: unknown): void => {
  const detail =
    error instanceof Error ? (error.stack ?? error.message) : error === undefined ? "" : String(error);
  channel?.error(`${message}${detail ? ` ${detail}` : ""}`);
};
