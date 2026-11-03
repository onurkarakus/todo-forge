import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { arch, platform } from "node:process";

const require = createRequire(__filename);

const ensureExecutable = (file: string): void => {
  if (platform === "win32") {
    return;
  }
  try {
    fs.accessSync(file, fs.constants.X_OK);
  } catch {
    // Some unzip tools drop the executable bit.
    fs.chmodSync(file, 0o755);
  }
};

/**
 * Finds the ripgrep binary. Packaged builds ship it in `bin/<platform>-<arch>/`
 * next to `dist/`; development builds use the @vscode/ripgrep platform package.
 */
export const resolveRgPath = (): string => {
  const binaryName = platform === "win32" ? "rg.exe" : "rg";
  const target = `${platform}-${arch}`;
  const bundled = path.join(__dirname, "..", "bin", target, binaryName);
  if (fs.existsSync(bundled)) {
    ensureExecutable(bundled);
    return bundled;
  }
  const platformPkg = `@vscode/ripgrep-${target}`;
  try {
    return require.resolve(`${platformPkg}/bin/${binaryName}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`TodoForge could not find ripgrep for ${target}. ${detail}`);
  }
};
