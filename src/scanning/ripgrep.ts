import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";



export interface RgHit {
  path: string;
  lineNumber: number;
  lineText: string;
  contextAfter: string[];
}

export interface RgRunResult {
  hits: RgHit[];
  cancelled: boolean;
  error?: string;
}

export interface RgRunRequest {
  rgPath: string;
  cwd: string;
  pattern: string;
  caseSensitive: boolean;
  useGitignore: boolean;
  maxFileSizeKb: number;
  excludeGlobs: readonly string[];
  includeGlobs: readonly string[];
  afterContext: number;
  files?: readonly string[];
  signal: AbortSignal;
}

const stripNewline = (value: string): string => {
  return value.replace(/\r?\n$/, "");
};

const toExclude = (glob: string): string => {
  return glob.startsWith("!") ? glob : `!${glob}`;
};

export const buildRgArgs = (request: RgRunRequest): string[] => {
  const args = [
    "--json",
    "--max-columns",
    "2000",
    "--max-filesize",
    `${request.maxFileSizeKb}K`,
    "--glob",
    "!.git/**",
  ];
  if (!request.caseSensitive) {
    args.push("-i");
  }
  if (!request.useGitignore) {
    args.push("--no-ignore");
  }
  if (request.afterContext > 0) {
    args.push("--after-context", String(request.afterContext));
  }
  for (const glob of request.excludeGlobs) {
    args.push("--glob", toExclude(glob));
  }
  for (const glob of request.includeGlobs) {
    if (glob.trim().length > 0) {
      args.push("--glob", glob);
    }
  }
  args.push("-e", request.pattern);
  if (request.files && request.files.length > 0) {
    args.push("--");
    for (const file of request.files) {
      args.push(path.relative(request.cwd, file) || file);
    }
  } else {
    args.push(".");
  }
  return args;
};

interface RgEvent {
  type?: string;
  data?: {
    path?: { text?: string };
    lines?: { text?: string };
    line_number?: number;
  };
}

export const runRipgrep = async (request: RgRunRequest): Promise<RgRunResult> => {
  if (request.signal.aborted) {
    return { hits: [], cancelled: true };
  }

  const hits: RgHit[] = [];
  let current: RgHit | undefined;
  let stderr = "";
  let cancelled = false;

  const child = spawn(request.rgPath, buildRgArgs(request), {
    cwd: request.cwd,
    windowsHide: true,
  });

  const finishCurrent = (): void => {
    if (!current) {
      return;
    }
    hits.push(current);
    current = undefined;
  };

  const onAbort = (): void => {
    cancelled = true;
    child.kill();
  };
  request.signal.addEventListener("abort", onAbort, { once: true });

  const stdout = readline.createInterface({ input: child.stdout });
  let parsed = 0;
  const reading = new Promise<void>((resolve) => {
    stdout.on("line", (line) => {
      parsed += 1;
      let event: RgEvent;
      try {
        event = JSON.parse(line) as RgEvent;
      } catch {
        return;
      }
      const type = event.type;
      const text = event.data?.lines?.text;
      const filePath = event.data?.path?.text;
      if ((type === "match" || type === "context") && text !== undefined && filePath) {
        const absolute = path.resolve(request.cwd, filePath);
        const lineText = stripNewline(text);
        if (type === "match") {
          finishCurrent();
          current = {
            path: absolute,
            lineNumber: event.data?.line_number ?? 1,
            lineText,
            contextAfter: [],
          };
          return;
        }
        if (current && current.path === absolute) {
          current.contextAfter.push(lineText);
        }
      }
      if (type === "summary") {
        finishCurrent();
      }
    });
    stdout.on("close", () => {
      finishCurrent();
      resolve();
    });
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    if (stderr.length < 4000) {
      stderr += chunk;
    }
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    child.on("error", () => resolve(null));
    child.on("close", (code) => resolve(code));
  });
  await reading;
  request.signal.removeEventListener("abort", onAbort);

  if (cancelled || request.signal.aborted) {
    return { hits: [], cancelled: true };
  }
  if (exitCode === null) {
    return { hits, cancelled: false, error: "ripgrep failed to start" };
  }
  if (exitCode !== 0 && exitCode !== 1) {
    return {
      hits,
      cancelled: false,
      error: stderr.trim() || `ripgrep exited with code ${exitCode} after ${parsed} lines`,
    };
  }
  return { hits, cancelled: false };
};
