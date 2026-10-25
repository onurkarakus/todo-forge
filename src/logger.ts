import * as vscode from "vscode";

let channel: vscode.OutputChannel | undefined;

export const initLogger = (output: vscode.OutputChannel): void => {
  channel = output;
};

export const logInfo = (message: string): void => {
  channel?.appendLine(`[info] ${message}`);
};

export const logError = (message: string, error?: unknown): void => {
  const detail =
    error instanceof Error ? (error.stack ?? error.message) : error === undefined ? "" : String(error);
  channel?.appendLine(`[error] ${message}${detail ? ` ${detail}` : ""}`);
};
