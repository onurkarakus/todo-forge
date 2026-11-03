// Downloads the ripgrep binaries for every platform package listed by
// @vscode/ripgrep, so a VSIX can ship the right one. Build-time only:
// the extension itself never downloads anything.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "node_modules", "@vscode", "ripgrep", "package.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const optional = manifest.optionalDependencies ?? {};
const only = process.argv.slice(2);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "todoforge-rg-"));

const binaryName = (packageName) => (packageName.includes("win32") ? "rg.exe" : "rg");

// npm is npm.cmd on Windows; execFile cannot start .cmd files without a shell.
const npm = (args) =>
  execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

for (const [name, version] of Object.entries(optional)) {
  if (only.length > 0 && !only.includes(name)) {
    continue;
  }
  const dest = path.join(root, "node_modules", ...name.split("/"));
  const binary = path.join(dest, "bin", binaryName(name));
  if (fs.existsSync(binary)) {
    continue;
  }
  const packedName = npm(["pack", `${name}@${version}`, "--pack-destination", tmp])
    .trim()
    .split(/\r?\n/)
    .at(-1);
  if (!packedName) {
    throw new Error(`npm pack produced no tarball for ${name}@${version}`);
  }
  const extractDir = fs.mkdtempSync(path.join(tmp, "extract-"));
  execFileSync("tar", ["-xzf", path.join(tmp, packedName), "-C", extractDir]);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(path.join(extractDir, "package"), dest);
  if (!fs.existsSync(binary)) {
    throw new Error(`Packed ${name}@${version} without ${path.basename(binary)}`);
  }
  if (process.platform !== "win32") {
    fs.chmodSync(binary, 0o755);
  }
  console.log(`fetched ${name}@${version}`);
}

fs.rmSync(tmp, { recursive: true, force: true });
