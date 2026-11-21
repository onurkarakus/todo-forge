const assert = require("node:assert/strict");
const fs = require("node:fs");
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

  it("keeps the Changes view right while the file has unsaved edits", async () => {
    const document = await vscode.workspace.openTextDocument(program);
    const editor = await vscode.window.showTextDocument(document);
    // Three lines above both TODOs: their saved-file line numbers no longer match.
    await editor.edit((builder) => builder.insert(new vscode.Position(0, 0), "\n\n\n"));
    assert.ok(document.isDirty);
    await waitFor(() => {
      const value = api.changes();
      return value.uncommitted === 1 && value.branch === 1 ? value : undefined;
    }, "shifted changes", 5000);
    // A TODO typed but not saved is uncommitted too.
    await editor.edit((builder) => builder.insert(new vscode.Position(1, 0), "// TODO: typed, not saved\n"));
    await waitFor(() => api.changes().uncommitted === 2, "unsaved TODO in Changes", 5000);
    assert.equal(api.changes().branch, 1);
    await vscode.commands.executeCommand("workbench.action.files.revert");
    assert.ok(!document.isDirty);
    await waitFor(() => {
      const value = api.changes();
      return value.uncommitted === 1 && value.branch === 1 ? value : undefined;
    }, "changes after revert", 5000);
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
    await vscode.window.showTextDocument(document);
    const line = document.getText().split("\n").findIndex((text) => text.includes("committed on the branch"));
    const column = Math.max(0, document.lineAt(line).text.indexOf("FIXME"));
    const actions = await vscode.commands.executeCommand(
      "vscode.executeCodeActionProvider",
      program,
      new vscode.Range(line, column, line, column + 5),
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

  const isoIn = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  it("completes a relative due date to an ISO date", async () => {
    const document = await vscode.workspace.openTextDocument({ language: "csharp", content: "// TODO(me, +7" });
    await vscode.window.showTextDocument(document);
    const list = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", document.uri, new vscode.Position(0, 14));
    const item = list.items.find((entry) => (typeof entry.label === "string" ? entry.label : entry.label.label) === "+7d");
    assert.ok(item, list.items.map((entry) => JSON.stringify(entry.label)).slice(0, 10).join(", "));
    assert.equal(typeof item.insertText === "string" ? item.insertText : item.insertText.value, isoIn(7));
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
  });

  it("converts a relative due date with a quick fix", async () => {
    const file = path.join(workspace, "src", "Relative.cs");
    fs.writeFileSync(file, "// TODO(me, +2w, !low): relative date\n// FIXME(tomorrow): second\n");
    try {
      const uri = vscode.Uri.file(file);
      const match = await waitFor(() => api.all().find((item) => item.text === "relative date"), "relative TODO");
      assert.equal(match.meta.relativeDue, "+2w");
      assert.equal(match.meta.due, undefined);
      assert.equal(match.meta.owner, "me");
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
      const actions = await vscode.commands.executeCommand("vscode.executeCodeActionProvider", uri, new vscode.Range(0, 3, 0, 7));
      const titles = actions.map((action) => action.title);
      const convert = actions.find((action) => action.title === `Convert +2w to ${isoIn(14)}`);
      assert.ok(convert, titles.join(", "));
      assert.ok(titles.includes("Convert all relative due dates in this file"), titles.join(", "));
      assert.ok(await vscode.workspace.applyEdit(convert.edit));
      assert.equal(document.lineAt(0).text, `// TODO(me, ${isoIn(14)}, !low): relative date`);
      await vscode.commands.executeCommand("todoforge.resolveRelativeDates");
      assert.equal(document.lineAt(1).text, `// FIXME(${isoIn(1)}): second`);
      await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    } finally {
      fs.rmSync(file, { force: true });
      await waitFor(() => !api.all().some((item) => item.relativePath === "src/Relative.cs"), "relative file removed");
    }
  });

  it("applies pin and mute to every selected TODO", async () => {
    const picked = api.all().filter((item) => item.kind === "tag" && !item.meta?.due && item.relativePath !== "src/Program.cs").slice(0, 3);
    assert.equal(picked.length, 3);
    const elements = picked.map((match) => ({ type: "view", node: { id: match.id, kind: "match", label: match.text, count: 1, match, children: [] } }));
    await vscode.commands.executeCommand("todoforge.pin", elements[0], elements);
    assert.equal(api.pins(), 3);
    await vscode.commands.executeCommand("todoforge.unpin", elements[1], elements);
    assert.equal(api.pins(), 0);
    const before = api.visible().length;
    // Not awaited: the command waits on its "Undo" notification.
    void vscode.commands.executeCommand("todoforge.mute", elements[0], elements.slice(0, 2));
    await waitFor(() => api.muted() === 2, "two muted", 5000);
    assert.equal(api.visible().length, before - 2);
    await api.unmuteAll();
    assert.equal(api.muted(), 0);
  });

  it("refreshes only changed tree items on a live edit", async () => {
    // Items are refreshed only once the view has rendered them.
    await vscode.commands.executeCommand("todoforge.tree.focus");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const document = await vscode.workspace.openTextDocument(program);
    const editor = await vscode.window.showTextDocument(document);
    api.visible();
    const before = api.treeRefreshes();
    await editor.edit((builder) => builder.insert(new vscode.Position(0, 0), "\n"));
    await waitFor(() => api.treeRefreshes().partial > before.partial, "partial refresh", 5000);
    assert.equal(api.treeRefreshes().full, before.full);
    await vscode.commands.executeCommand("workbench.action.files.revert");
  });

  it("saves the index to workspace storage", async () => {
    await api.saveCache();
    const { file } = api.cache();
    assert.ok(file, "workspace storage");
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(saved.version, 1);
    assert.equal(saved.matches.length, api.all().length);
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

  const toolText = async (name, input) => {
    const result = await vscode.lm.invokeTool(name, { input, toolInvocationToken: undefined }, new vscode.CancellationTokenSource().token);
    return result.content.map((part) => part.value ?? "").join("");
  };

  const chatTools = (value) =>
    vscode.workspace.getConfiguration("todoforge").update("ai.chatTools", value, vscode.ConfigurationTarget.Global);

  it("keeps chat tools off by default", async () => {
    assert.equal(vscode.workspace.getConfiguration("todoforge").get("ai.chatTools"), false);
    const listed = vscode.lm.tools.some((tool) => tool.name === "todoforge_listTodos");
    if (listed) {
      const text = await toolText("todoforge_listTodos", {});
      assert.match(text, /turned off/);
      assert.doesNotMatch(text, /committed on the branch/);
    }
  });

  it("answers through read-only chat tools once turned on", async () => {
    await chatTools(true);
    try {
      const names = vscode.lm.tools.map((tool) => tool.name);
      for (const name of ["todoforge_listTodos", "todoforge_listChanges", "todoforge_getTodo"]) {
        assert.ok(names.includes(name), `missing tool ${name}`);
      }
      const overdue = await waitFor(async () => {
        const text = await toolText("todoforge_listTodos", { status: ["overdue"] });
        return /turned off/.test(text) ? undefined : text;
      }, "tools on");
      assert.match(overdue, /^1 of \d+ TODOs match "is:overdue"/);
      assert.match(overdue, /committed on the branch/);

      const limited = await toolText("todoforge_listTodos", { limit: 1 });
      assert.match(limited, /Showing 1 of \d+/);

      const changes = await toolText("todoforge_listChanges", {});
      assert.match(changes, /^1 uncommitted and 1 branch TODOs\. Base branch: main/);

      const fixme = api.all().find((match) => match.text === "committed on the branch");
      const detail = await toolText("todoforge_getTodo", { ref: `${fixme.relativePath}:${fixme.line + 1}` });
      assert.match(detail, /"tag": "FIXME"/);
      assert.match(detail, /"owner": "onur"/);
    } finally {
      await chatTools(undefined);
    }
    await waitFor(async () => /turned off/.test(await toolText("todoforge_listTodos", {})), "tools off again");
  });

  it("opens Insights", async () => {
    await vscode.commands.executeCommand("todoforge.showInsights");
    await waitFor(
      () => vscode.window.tabGroups.all.some((group) => group.tabs.some((tab) => tab.label === "TodoForge Insights")),
      "Insights tab",
    );
  });
});
