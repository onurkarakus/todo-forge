import * as vscode from "vscode";

import { createController, type TodoForgeTestApi } from "./controller";
import { initLogger, logError, logInfo } from "./logger";
import { errorMessage } from "./utils/errors";

export const activate = (context: vscode.ExtensionContext): TodoForgeTestApi | undefined => {
  const started = performance.now();
  const channel = vscode.window.createOutputChannel("TodoForge", { log: true });
  initLogger(channel);
  context.subscriptions.push(channel);
  try {
    const controller = createController(context);
    context.subscriptions.push({ dispose: () => controller.dispose() });
    logInfo(`Activated in ${Math.round(performance.now() - started)}ms`);
    return controller.api;
  } catch (error) {
    logError("Activation failed", error);
    void vscode.window.showErrorMessage(vscode.l10n.t("TodoForge failed to start: {0}", errorMessage(error)));
    return undefined;
  }
};

export const deactivate = (): void => {
  logInfo("Deactivated");
};
