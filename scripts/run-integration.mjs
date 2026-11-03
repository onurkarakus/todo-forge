// Runs the integration tests in a real VS Code. Creates a throwaway git
// workspace from test/fixtures/sample with one committed branch TODO and one
// uncommitted TODO. Set VSCODE_EXECUTABLE to reuse an installed VS Code.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runTests } from "@vscode/test-electron";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "todoforge-it-")));
fs.cpSync(path.join(root, "test", "fixtures", "sample"), workspace, { recursive: true });

const git = (...args) => execFileSync("git", args, { cwd: workspace, stdio: "pipe" });
git("init", "-q", "-b", "main");
git("config", "user.name", "Integration Test");
git("config", "user.email", "it@example.com");
git("config", "commit.gpgsign", "false");
git("add", ".");
git("commit", "-q", "-m", "base");
git("checkout", "-q", "-b", "feature");
fs.appendFileSync(path.join(workspace, "src", "Program.cs"), "\n// FIXME(onur, 2020-01-01, !high): committed on the branch\n");
git("commit", "-q", "-am", "branch work");
fs.appendFileSync(path.join(workspace, "src", "Program.cs"), "// TODO(Integration): not committed yet\n");

const userData = fs.mkdtempSync(path.join(os.tmpdir(), "todoforge-it-user-"));
try {
  await runTests({
    vscodeExecutablePath: process.env.VSCODE_EXECUTABLE || undefined,
    extensionDevelopmentPath: root,
    extensionTestsPath: path.join(root, "test", "integration", "index.cjs"),
    launchArgs: [
      workspace,
      "--disable-extensions",
      "--disable-workspace-trust",
      "--skip-welcome",
      "--skip-release-notes",
      `--user-data-dir=${userData}`,
    ],
    extensionTestsEnv: { TODOFORGE_IT_WORKSPACE: workspace },
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  fs.rmSync(workspace, { recursive: true, force: true });
  fs.rmSync(userData, { recursive: true, force: true });
}
