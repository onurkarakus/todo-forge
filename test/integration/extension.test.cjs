const assert = require("node:assert/strict");
const path = require("node:path");
const vscode = require("vscode");

const workspace = process.env.TODOFORGE_IT_WORKSPACE;
const program = vscode.Uri.file(path.join(workspace, "src", "Program.cs"));

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
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

describe("TodoForge in VS Code", function () {
  let api;

  before(async () => {
    const extension = vscode.extensions.getExtension("onurkarakus.todoforge");
    assert.ok(extension, "extension is installed");
    const started = Date.now();
    api = await extension.activate();
    console.log(`      activation: ${Date.now() - started}ms`);
    await waitFor(() => api.scanned(), "first scan");
  });

  it("registers its commands", async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const id of ["todoforge.filter", "todoforge.showInsights", "todoforge.importSettings", "todoforge.snooze", "todoforge.goToNext"]) {
      assert.ok(commands.includes(id), id);
    }
  });

  it("scans the workspace and skips build output", async () => {
    const files = new Set(api.all().map((match) => match.relativePath));
    assert.ok(files.has("src/Program.cs"));
    assert.ok(files.has("py/app.py"));
    for (const file of files) {
      assert.ok(!/\/(bin|obj)\//.test(file), `scanned ${file}`);
      assert.ok(!/\.(g|designer)\.cs$/.test(file), `scanned ${file}`);
    }
  });

  it("parses inline metadata from the branch TODO", () => {
    const fixme = api.all().find((match) => match.text === "committed on the branch");
    assert.ok(fixme);
    assert.deepEqual(fixme.meta, { owner: "onur", due: "2020-01-01", priority: "high", labels: [] });
  });

  it("splits uncommitted and branch TODOs in the Changes view", async () => {
    const counts = await waitFor(() => {
      const value = api.changes();
      return value.uncommitted > 0 && value.branch > 0 ? value : undefined;
    }, "git changes");
    assert.equal(counts.uncommitted, 1);
    assert.equal(counts.branch, 1);
  });

  it("filters with the query language", () => {
    const all = api.query("");
    assert.ok(all >= 5);
    assert.equal(api.query("is:overdue"), 1);
    assert.equal(api.query("is:new"), 2);
    assert.equal(api.query("@onur !high"), 0);
    assert.equal(api.query("@onur"), 1);
    assert.ok(api.query("-tag:TODO") < all);
    assert.equal(api.query(""), all);
  });

  it("shows a hover card with actions", async () => {
    const document = await vscode.workspace.openTextDocument(program);
    await vscode.window.showTextDocument(document);
    const line = document.getText().split("\n").findIndex((text) => text.includes("committed on the branch"));
    const column = document.lineAt(line).text.indexOf("FIXME") + 1;
    const hovers = await vscode.commands.executeCommand("vscode.executeHoverProvider", program, new vscode.Position(line, column));
    const text = hovers.flatMap((hover) => hover.contents.map((content) => content.value ?? String(content))).join("\n");
    assert.match(text, /committed on the branch/);
    assert.match(text, /2020-01-01/);
    assert.match(text, /command:todoforge\.snooze/);
  });

  it("offers quick fixes and applies a snooze", async () => {
    const document = await vscode.workspace.openTextDocument(program);
    const line = document.getText().split("\n").findIndex((text) => text.includes("committed on the branch"));
    const actions = await vscode.commands.executeCommand(
      "vscode.executeCodeActionProvider",
      program,
      new vscode.Range(line, 0, line, 0),
    );
    const titles = actions.map((action) => action.title);
    assert.ok(titles.some((title) => /Snooze FIXME by 1 week/.test(title)), titles.join(", "));
    assert.ok(titles.some((title) => /Remove FIXME comment/.test(title)));
    const snooze = actions.find((action) => /by 1 week/.test(action.title));
    assert.ok(await vscode.workspace.applyEdit(snooze.edit));
    const updated = document.lineAt(line).text;
    assert.match(updated, /FIXME\(onur, \d{4}-\d{2}-\d{2}, !high\):/);
    assert.doesNotMatch(updated, /2020-01-01/);
    await vscode.commands.executeCommand("undo");
  });

  it("completes a TODO snippet inside a comment", async () => {
    const document = await vscode.workspace.openTextDocument({ language: "csharp", content: "// TO" });
    await vscode.window.showTextDocument(document);
    const list = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", document.uri, new vscode.Position(0, 5));
    const labels = list.items.map((item) => (typeof item.label === "string" ? item.label : item.label.label));
    assert.ok(labels.includes("TODO(owner, date)"), labels.slice(0, 20).join(", "));
  });

  it("pins and unpins a TODO", async () => {
    const match = api.all().find((item) => item.relativePath === "py/app.py");
    await vscode.commands.executeCommand("todoforge.pin", match.id);
    assert.equal(api.pins(), 1);
    await vscode.commands.executeCommand("todoforge.unpin", match.id);
    assert.equal(api.pins(), 0);
  });

  it("navigates to the next TODO in the file", async () => {
    const document = await vscode.workspace.openTextDocument(program);
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await vscode.commands.executeCommand("todoforge.goToNext");
    const first = api.all().filter((match) => match.relativePath === "src/Program.cs").sort((a, b) => a.line - b.line)[0];
    assert.equal(vscode.window.activeTextEditor.selection.active.line, first.line);
  });

  it("picks up a new TODO typed in the editor", async () => {
    const document = await vscode.workspace.openTextDocument(program);
    const editor = await vscode.window.showTextDocument(document);
    await editor.edit((builder) => builder.insert(new vscode.Position(0, 0), "// HACK: typed live\n"));
    await waitFor(() => api.all().some((match) => match.text === "typed live"), "live edit");
    await vscode.commands.executeCommand("undo");
    await waitFor(() => !api.all().some((match) => match.text === "typed live"), "undo");
  });

  it("opens Insights", async () => {
    await vscode.commands.executeCommand("todoforge.showInsights");
    await waitFor(
      () => vscode.window.tabGroups.all.some((group) => group.tabs.some((tab) => tab.label === "TodoForge Insights")),
      "Insights tab",
    );
  });
});
