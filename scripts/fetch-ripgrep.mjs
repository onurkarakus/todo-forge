import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "node_modules", "@vscode", "ripgrep", "package.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const optional = manifest.optionalDependencies ?? {};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "todoforge-rg-"));

const binaryName = (packageName) => (packageName.includes("win32") ? "rg.exe" : "rg");

for (const [name, version] of Object.entries(optional)) {
  const dest = path.join(root, "node_modules", ...name.split("/"));
  const binary = path.join(dest, "bin", binaryName(name));
  if (fs.existsSync(binary)) {
    continue;
  }
  const packedName = execFileSync("npm", ["pack", `${name}@${version}`, "--pack-destination", tmp], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
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
