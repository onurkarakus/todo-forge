// Second window on the same workspace and user data as the main suite: the
// tree must show the saved index before the first scan finishes.
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
      throw new Error(`Timed out waiting for ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

describe("TodoForge after a reload", function () {
  it("restores the saved index, then scans", async () => {
    const extension = vscode.extensions.getExtension("onurkarakus.todoforge");
    const api = await extension.activate();
    await waitFor(() => api.cache().restored > 0 || api.scanned(), "restored or scanned");
    const restored = api.cache().restored;
    console.log(`      restored from saved index: ${restored} TODOs in ${api.cache().restoreMs}ms after start`);
    assert.ok(restored > 0, "the saved index was shown before the scan finished");
    await waitFor(() => api.scanned(), "first scan");
    assert.equal(api.all().length, restored);
    assert.ok(api.all().some((match) => match.text === "committed on the branch"));
  });
});
