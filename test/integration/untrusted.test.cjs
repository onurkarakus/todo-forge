// Runs in Restricted Mode: the workspace is not trusted. See
// scripts/run-integration.mjs, which starts VS Code with workspace trust on.
const assert = require("node:assert/strict");
const vscode = require("vscode");

const waitFor = async (predicate, label, timeout = 20000) => {
  const started = Date.now();
  for (;;) {
    const value = await predicate();
    if (value) {
      return value;
    }
    if (Date.now() - started > timeout) {
      throw new Error(`timed out waiting for ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

describe("TodoForge in Restricted Mode", () => {
  let api;

  before(async () => {
    assert.equal(vscode.workspace.isTrusted, false, "workspace should be untrusted");
    const extension = vscode.extensions.getExtension("onurkarakus.todoforge");
    api = await extension.activate();
    await waitFor(() => api.scanned(), "first scan");
  });

  it("still scans and highlights TODOs", () => {
    const texts = api.all().map((match) => match.text);
    assert.ok(texts.includes("committed on the branch"));
    assert.ok(texts.includes("not committed yet"));
  });

  it("ignores the workspace custom regex", () => {
    assert.equal(vscode.workspace.getConfiguration("todoforge").get("regex.custom"), "");
    assert.ok(!api.all().some((match) => match.text === "custom only"), "workspace regex was used");
  });

  it("does not run git", async () => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    assert.deepEqual(api.changes(), { uncommitted: 0, branch: 0 });
    assert.equal(api.query("is:uncommitted"), 0);
  });

  it("keeps the chat tools off", async () => {
    const lm = vscode.lm;
    if (!lm || typeof lm.invokeTool !== "function") {
      return;
    }
    const listed = lm.tools.some((tool) => tool.name === "todoforge_listTodos");
    if (!listed) {
      return;
    }
    const result = await lm.invokeTool("todoforge_listTodos", { input: {}, toolInvocationToken: undefined }, new vscode.CancellationTokenSource().token);
    const text = result.content.map((part) => part.value ?? "").join("");
    assert.match(text, /Restricted Mode/);
    assert.doesNotMatch(text, /committed on the branch/);
  });
});
