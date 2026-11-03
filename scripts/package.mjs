// Builds one VSIX per platform, each with only its own ripgrep binary, plus a
// universal VSIX with all of them. Nothing is published.
//
// The binaries are copied to bin/<platform>-<arch>/ before each build, so the
// VSIX needs no node_modules (vsce runs with --no-dependencies).
//
//   node scripts/package.mjs                 all targets
//   node scripts/package.mjs linux-x64 ...   selected targets
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

// VS Code target -> @vscode/ripgrep platform package.
// Alpine uses the static musl Linux builds that @vscode/ripgrep ships.
const TARGETS = {
  "win32-x64": "win32-x64",
  "win32-arm64": "win32-arm64",
  "linux-x64": "linux-x64",
  "linux-arm64": "linux-arm64",
  "linux-armhf": "linux-arm",
  "alpine-x64": "linux-x64",
  "alpine-arm64": "linux-arm64",
  "darwin-x64": "darwin-x64",
  "darwin-arm64": "darwin-arm64",
};

const run = (command, args) => {
  const isWindows = process.platform === "win32";
  execFileSync(isWindows ? `${command}.cmd` : command, args, { cwd: root, stdio: "inherit", shell: isWindows });
};

const requested = process.argv.slice(2);
const targets = requested.length > 0 ? requested : [...Object.keys(TARGETS), "universal"];
for (const target of targets) {
  if (target !== "universal" && !TARGETS[target]) {
    throw new Error(`Unknown target ${target}. Use one of: ${Object.keys(TARGETS).join(", ")}, universal`);
  }
}

run("npm", ["run", "package"]);
const rgPackages = targets.includes("universal")
  ? []
  : [...new Set(targets.map((target) => `@vscode/ripgrep-${TARGETS[target]}`))];
run("node", ["scripts/fetch-ripgrep.mjs", ...rgPackages]);

const binDir = path.join(root, "bin");
const stageRipgrep = (rgTargets) => {
  fs.rmSync(binDir, { recursive: true, force: true });
  for (const rg of rgTargets) {
    const source = path.join(root, "node_modules", "@vscode", `ripgrep-${rg}`, "bin");
    const name = rg.startsWith("win32") ? "rg.exe" : "rg";
    if (!fs.existsSync(path.join(source, name))) {
      throw new Error(`Missing ripgrep for ${rg}. Run: node scripts/fetch-ripgrep.mjs @vscode/ripgrep-${rg}`);
    }
    fs.mkdirSync(path.join(binDir, rg), { recursive: true });
    fs.copyFileSync(path.join(source, name), path.join(binDir, rg, name));
    fs.chmodSync(path.join(binDir, rg, name), 0o755);
  }
};
const allRg = [...new Set(Object.values(TARGETS))];
const outDir = path.join(root, "vsix");
fs.mkdirSync(outDir, { recursive: true });

for (const target of targets) {
  stageRipgrep(target === "universal" ? allRg : [TARGETS[target]]);
  const out = path.join(outDir, `${pkg.name}-${target}-${pkg.version}.vsix`);
  const args = ["vsce", "package", "--no-dependencies", "--out", out];
  if (target !== "universal") {
    args.push("--target", target);
  }
  run("npx", args);
}

fs.rmSync(binDir, { recursive: true, force: true });
console.log(`VSIX files are in ${path.relative(process.cwd(), outDir) || "."}`);
