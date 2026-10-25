import { createRequire } from "node:module";
import { arch, platform } from "node:process";

const require = createRequire(__filename);

// The @vscode/ripgrep entry is ESM and only points at a platform package.
// Resolve the binary file so VS Code 1.85 can load it without importing that entry.
export const resolveRgPath = (): string => {
  const binaryName = platform === "win32" ? "rg.exe" : "rg";
  const platformPkg = `@vscode/ripgrep-${platform}-${arch}`;
  try {
    return require.resolve(`${platformPkg}/bin/${binaryName}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`TodoForge could not find ripgrep (${platformPkg}). ${detail}`);
  }
};
