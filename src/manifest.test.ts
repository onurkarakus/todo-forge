import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "mocha";

const root = path.join(__dirname, "..");
const readJson = (file: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(root, file), "utf8")) as Record<string, unknown>;

const manifestText = fs.readFileSync(path.join(root, "package.json"), "utf8");
const manifest = JSON.parse(manifestText) as {
  engines: { vscode: string };
  devDependencies: Record<string, string>;
  keywords: string[];
  contributes: {
    commands: { command: string }[];
    menus: Record<string, { command?: string }[]>;
    configuration: { properties: Record<string, { default?: unknown }> };
    walkthroughs: { steps: { media: { image?: string; markdown?: string } }[] }[];
  };
};

describe("manifest", () => {
  it("keeps @types/vscode at the engine minimum", () => {
    assert.equal(manifest.engines.vscode, `^${manifest.devDependencies["@types/vscode"]}`);
  });

  it("has every %key% in both NLS files", () => {
    const keys = [...manifestText.matchAll(/"%([^%"]+)%"/g)].map((found) => found[1] as string);
    const en = readJson("package.nls.json");
    const tr = readJson("package.nls.tr.json");
    for (const key of keys) {
      assert.ok(key in en, `package.nls.json: ${key}`);
      assert.ok(key in tr, `package.nls.tr.json: ${key}`);
    }
  });

  it("translates every runtime string", () => {
    const en = readJson("l10n/bundle.l10n.json");
    const tr = readJson("l10n/bundle.l10n.tr.json");
    assert.deepEqual(Object.keys(tr).sort(), Object.keys(en).sort());
    for (const [key, value] of Object.entries(tr)) {
      const placeholders = (text: string): string[] => (text.match(/\{\d+\}/g) ?? []).sort();
      assert.deepEqual(placeholders(String(value)), placeholders(key), key);
    }
  });

  it("only references declared commands in menus", () => {
    const declared = new Set(manifest.contributes.commands.map((command) => command.command));
    for (const [menu, items] of Object.entries(manifest.contributes.menus)) {
      for (const item of items) {
        if (item.command) {
          assert.ok(declared.has(item.command), `${menu}: ${item.command}`);
        }
      }
    }
  });

  it("registers every declared command in the source", () => {
    const sources = fs
      .readdirSync(path.join(root, "src"), { recursive: true })
      .map(String)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) => fs.readFileSync(path.join(root, "src", file), "utf8"))
      .join("\n");
    for (const { command } of manifest.contributes.commands) {
      const id = command.replace(/^todoforge\./, "");
      assert.ok(sources.includes(`register("${command}"`) || sources.includes(`"${command}"`), `${id} is not registered`);
    }
  });

  it("ships the walkthrough media it references", () => {
    for (const step of manifest.contributes.walkthroughs[0]?.steps ?? []) {
      const file = step.media.image ?? step.media.markdown;
      assert.ok(file && fs.existsSync(path.join(root, file)), `missing ${file}`);
    }
  });

  it("stays within Marketplace limits", () => {
    assert.ok(manifest.keywords.length <= 30);
    assert.ok(!/\.svg"/.test(JSON.stringify((readJson("package.json") as { icon?: string }).icon ?? "")));
  });

  it("is quiet by default: no telemetry, AI, Problems or CodeLens unless the user opts in", () => {
    const properties = manifest.contributes.configuration.properties;
    assert.equal(properties["todoforge.ai.enabled"]?.default, false);
    assert.equal(properties["todoforge.problems.enabled"]?.default, false);
    assert.equal(properties["todoforge.codelens.enabled"]?.default, false);
    assert.ok(!manifestText.toLowerCase().includes("telemetry\":"));
  });
});
