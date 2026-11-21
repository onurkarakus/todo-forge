import * as vscode from "vscode";

import { createController, type TodoForgeTestApi } from "./controller";
import { initLogger, logError, logInfo } from "./logger";
import { errorMessage } from "./utils/errors";

let flush: (() => Promise<void>) | undefined;

export const activate = (context: vscode.ExtensionContext): TodoForgeTestApi | undefined => {
  const started = performance.now();
  const channel = vscode.window.createOutputChannel("TodoForge", { log: true });
  initLogger(channel);
  context.subscriptions.push(channel);
  try {
    const controller = createController(context);
    context.subscriptions.push({ dispose: () => controller.dispose() });
    flush = controller.flush;
    logInfo(`Activated in ${Math.round(performance.now() - started)}ms`);
    return controller.api;
  } catch (error) {
    logError("Activation failed", error);
    void vscode.window.showErrorMessage(vscode.l10n.t("TodoForge failed to start: {0}", errorMessage(error)));
    return undefined;
  }
};

/** Saves the TODO index so the next window shows it right away. */
export const deactivate = async (): Promise<void> => {
  try {
    await flush?.();
  } catch (error) {
    logError("Could not save the TODO index", error);
  }
  logInfo("Deactivated");
};
