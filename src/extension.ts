import * as vscode from "vscode";

import { createController } from "./controller";
import { initLogger, logError, logInfo } from "./logger";
import { errorMessage } from "./utils/errors";

export const activate = (context: vscode.ExtensionContext): void => {
  const channel = vscode.window.createOutputChannel("TodoForge");
  initLogger(channel);
  context.subscriptions.push(channel);
  try {
    const controller = createController(context);
    context.subscriptions.push({ dispose: () => controller.dispose() });
    logInfo("TodoForge activated");
  } catch (error) {
    logError("Activation failed", error);
    void vscode.window.showErrorMessage(`TodoForge failed to activate: ${errorMessage(error)}`);
  }
};

export const deactivate = (): void => {
  logInfo("TodoForge deactivated");
};
