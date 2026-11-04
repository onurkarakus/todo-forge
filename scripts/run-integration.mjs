// Runs the integration tests in a real VS Code. Creates a throwaway git
// workspace from test/fixtures/sample with one committed branch TODO and one
// uncommitted TODO. Set VSCODE_EXECUTABLE to reuse an installed VS Code.
//
// Two runs: the main suite (workspace trust off, like runTests always does)
// and a Restricted Mode suite. runTests always passes
// --disable-workspace-trust, so the second run starts VS Code directly.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";

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
const untrustedData = fs.mkdtempSync(path.join(os.tmpdir(), "todoforge-it-untrusted-"));
const testsPath = path.join(root, "test", "integration", "index.cjs");

// Restricted Mode run: workspace settings that must be ignored, and a line
// only that workspace regex would find.
const untrusted = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "todoforge-it-untrusted-ws-")));
fs.cpSync(workspace, untrusted, { recursive: true });
fs.mkdirSync(path.join(untrusted, ".vscode"), { recursive: true });
fs.writeFileSync(
  path.join(untrusted, ".vscode", "settings.json"),
  JSON.stringify({ "todoforge.regex.custom": "ZZ\\s+($TAGS)", "todoforge.git.baseBranch": "main" }, null, 2),
);
fs.writeFileSync(path.join(untrusted, "src", "Extra.cs"), "ZZ TODO: custom only\n");
fs.mkdirSync(path.join(untrustedData, "User"), { recursive: true });
fs.writeFileSync(
  path.join(untrustedData, "User", "settings.json"),
  JSON.stringify({ "security.workspace.trust.enabled": true, "security.workspace.trust.startupPrompt": "never", "security.workspace.trust.banner": "never", "todoforge.ai.chatTools": true }),
);

const runUntrusted = (executable) =>
  new Promise((resolve, reject) => {
    const env = { ...process.env, TODOFORGE_IT_WORKSPACE: untrusted, TODOFORGE_IT_SUITE: "untrusted" };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(
      executable,
      [
        untrusted,
        "--no-sandbox",
        "--disable-gpu-sandbox",
        "--disable-updates",
        "--disable-extensions",
        "--skip-welcome",
        "--skip-release-notes",
        `--user-data-dir=${untrustedData}`,
        `--extensionDevelopmentPath=${root}`,
        `--extensionTestsPath=${testsPath}`,
      ],
      { env, stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Restricted Mode run exited with ${code}`))));
  });

try {
  const executable = process.env.VSCODE_EXECUTABLE || (await downloadAndUnzipVSCode());
  await runTests({
    vscodeExecutablePath: executable,
    extensionDevelopmentPath: root,
    extensionTestsPath: testsPath,
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
  await runUntrusted(executable);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  for (const dir of [workspace, untrusted, userData, untrustedData]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
