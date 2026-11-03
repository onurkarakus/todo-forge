// Captures the Marketplace screenshots by driving a real VS Code window.
// Needs playwright-core (not a project dependency) and an X display:
//
//   npm i --no-save playwright-core
//   node scripts/screenshots/demo-workspace.mjs /tmp/contoso-shop
//   xvfb-run -a -s "-screen 0 1920x1200x24" node scripts/screenshots/capture.cjs \
//     --code /path/to/vscode/code --vsix vsix/todoforge-linux-x64-1.0.0.vsix \
//     --workspace /tmp/contoso-shop --out media/screenshots
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const { _electron } = require(arg("playwright", "playwright-core"));
const code = arg("code");
// The CLI wrapper (bin/code) installs extensions; the Electron binary runs the window.
const cli = arg("cli", path.join(path.dirname(code), "bin", "code"));
const vsix = path.resolve(arg("vsix"));
const workspace = path.resolve(arg("workspace", "/tmp/contoso-shop"));
const out = path.resolve(arg("out", "media/screenshots"));
const only = arg("only");
const WIDTH = 1440;
const HEIGHT = 900;
fs.mkdirSync(out, { recursive: true });

const settingsFor = (theme) => ({
  "workbench.colorTheme": theme,
  "workbench.startupEditor": "none",
  "workbench.tips.enabled": false,
  "workbench.secondarySideBar.defaultVisibility": "hidden",
  "workbench.layoutControl.enabled": false,
  "workbench.editor.empty.hint": "hidden",
  "chat.disableAIFeatures": true,
  "chat.commandCenter.enabled": false,
  "window.commandCenter": false,
  "window.title": "${rootName}",
  "window.restoreWindows": "none",
  "telemetry.telemetryLevel": "off",
  "update.mode": "none",
  "extensions.ignoreRecommendations": true,
  "extensions.autoCheckUpdates": false,
  "security.workspace.trust.enabled": false,
  "editor.fontSize": 14,
  "editor.lineHeight": 22,
  "editor.minimap.enabled": false,
  "editor.stickyScroll.enabled": false,
  "editor.hover.delay": 200,
  "editor.lightbulb.enabled": "off",
  "breadcrumbs.enabled": false,
  "git.autofetch": false,
  "scm.diffDecorations": "gutter",
  "github.copilot.enable": { "*": false },
});

const launch = async (theme) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "tf-shot-"));
  const extDir = path.join(userData, "extensions");
  fs.mkdirSync(path.join(userData, "User"), { recursive: true });
  fs.writeFileSync(path.join(userData, "User", "settings.json"), JSON.stringify(settingsFor(theme), null, 2));
  execFileSync(cli, [`--user-data-dir=${userData}`, `--extensions-dir=${extDir}`, "--install-extension", vsix], { stdio: "pipe" });
  const app = await _electron.launch({
    executablePath: code,
    args: [workspace, `--user-data-dir=${userData}`, `--extensions-dir=${extDir}`, "--skip-welcome", "--skip-release-notes", "--disable-workspace-trust", "--disable-gpu"],
  });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(size.w, size.h);
    win.setPosition(0, 0);
  }, { w: WIDTH, h: HEIGHT });
  await page.waitForSelector(".monaco-workbench", { timeout: 60000 });
  await page.waitForTimeout(4000);
  return { app, page };
};

const helpers = (page) => {
  const wait = (ms) => page.waitForTimeout(ms);
  const command = async (title) => {
    await page.keyboard.press("F1");
    await wait(300);
    await page.keyboard.type(title, { delay: 5 });
    await wait(500);
    if (process.env.SHOT_DEBUG) await page.screenshot({ path: path.join(out, `debug-${title.replace(/\W+/g, "_")}.png`) });
    await page.keyboard.press("Enter");
    await wait(800);
  };
  const open = async (file, line, column = 1) => {
    await page.keyboard.press("Control+P");
    await wait(300);
    await page.keyboard.type(file, { delay: 5 });
    await wait(700);
    await page.keyboard.press("Enter");
    await wait(900);
    if (line) {
      await page.keyboard.press("Control+G");
      await wait(200);
      await page.keyboard.type(`${line}:${column}`);
      await page.keyboard.press("Enter");
      await wait(400);
    }
  };
  const shot = async (name) => {
    await wait(500);
    const file = path.join(out, `${name}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  };
  const escape = async (times = 2) => {
    for (let i = 0; i < times; i++) {
      await page.keyboard.press("Escape");
      await wait(150);
    }
  };
  const showTodoForge = async () => {
    await command("View: Show TodoForge");
    await wait(800);
  };
  return { wait, command, open, shot, escape, showTodoForge };
};

const want = (name) => !only || only.split(",").includes(name);

const darkSession = async () => {
  const { app, page } = await launch("Default Dark Modern");
  const h = helpers(page);
  await h.command("Notifications: Clear All Notifications");
  await h.showTodoForge();
  await h.command("TodoForge: Refresh Changes");
  await h.open("OrdersController.cs", 16, 13);
  await h.escape();
  if (want("hero")) await h.shot("01-overview-dark");

  if (want("hover")) {
    await page.keyboard.press("Control+K");
    await page.keyboard.press("Control+I");
    await h.wait(1200);
    await h.shot("02-hover-dark");
    await h.escape();
  }
  if (want("quickfix")) {
    await page.keyboard.press("Control+.");
    await h.wait(1200);
    await h.shot("03-quick-fix-dark");
    await h.escape();
  }
  if (want("changes")) {
    await h.open("CheckoutService.cs", 7, 13);
    await h.escape();
    // Collapse the TODOs view so the Changes view gets the sidebar.
    const todosHeader = page.locator(".pane-header h3.title", { hasText: /^TODOs$/ }).first();
    await todosHeader.click();
    await h.wait(600);
    await h.shot("04-changes-dark");
    await todosHeader.click();
    await h.wait(400);
  }
  if (want("filter")) {
    await h.open("client.ts", 4, 10);
    await h.escape();
    await h.command("TodoForge: Filter…");
    await page.keyboard.type("is:mine ", { delay: 60 });
    await h.wait(1000);
    await h.shot("05-live-filter-dark");
    await h.escape();
    await h.command("TodoForge: Clear Filter");
  }
  if (want("insights")) {
    await h.command("TodoForge: Show Insights");
    await h.wait(2000);
    await h.shot("06-insights-dark");
    await h.command("View: Close Editor");
  }
  await app.close();
};

const lightSession = async () => {
  const { app, page } = await launch("Default Light Modern");
  const h = helpers(page);
  await h.command("Notifications: Clear All Notifications");
  await h.showTodoForge();
  if (want("light")) {
    await h.open("PaymentService.cs", 11, 13);
    await h.escape();
    await h.shot("07-overview-light");
  }
  if (want("completion")) {
    await h.open("client.ts", 8, 1);
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("// tod", { delay: 80 });
    await page.keyboard.press("Control+Space");
    await h.wait(1200);
    await h.shot("08-snippet-light");
    await h.escape();
    await page.keyboard.press("Control+Z");
    await page.keyboard.press("Control+Z");
    await page.keyboard.press("Control+Z");
  }
  if (want("walkthrough")) {
    await h.command("TodoForge: Get Started");
    await h.wait(2000);
    await h.shot("09-walkthrough-light");
    await h.command("View: Close Editor");
  }
  await app.close();
};

// Records a short GIF: type a TODO with metadata, watch the tree and inline
// hint update, then snooze it with a quick fix. Frames are screenshots.
const gifSession = async () => {
  const { app, page } = await launch("Default Dark Modern");
  const h = helpers(page);
  const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-frames-"));
  let frame = 0;
  const grab = async (repeat = 1) => {
    const buffer = await page.screenshot();
    for (let i = 0; i < repeat; i++) {
      fs.writeFileSync(path.join(frameDir, `f${String(frame++).padStart(4, "0")}.png`), buffer);
    }
  };
  await h.command("Notifications: Clear All Notifications");
  await h.showTodoForge();
  await h.open("client.ts", 7, 2);
  await h.escape();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await grab(6);
  const text = "  // TODO(onur, 2026-11-05, !high): refresh the token on 401";
  for (const char of text) {
    await page.keyboard.type(char);
    if (char !== " ") await grab();
  }
  await page.keyboard.press("Home");
  for (let i = 0; i < 12; i++) {
    await h.wait(120);
    await grab();
  }
  await page.keyboard.press("Control+.");
  await h.wait(700);
  await grab(10);
  await page.keyboard.press("ArrowDown");
  await h.wait(200);
  await grab(6);
  await page.keyboard.press("Enter");
  for (let i = 0; i < 6; i++) {
    await h.wait(150);
    await grab();
  }
  await grab(14);
  await app.close();
  const gif = path.join(out, "demo.gif");
  const palette = path.join(frameDir, "palette.png");
  const input = ["-framerate", "8", "-i", path.join(frameDir, "f%04d.png")];
  const scale = "scale=1100:-1:flags=lanczos";
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...input, "-vf", `${scale},palettegen=stats_mode=diff`, palette]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...input, "-i", palette, "-lavfi", `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, "-loop", "0", gif]);
  fs.rmSync(frameDir, { recursive: true, force: true });
  console.log(gif);
};

(async () => {
  const session = arg("session", "all");
  if (session === "all" || session === "dark") await darkSession();
  if (session === "all" || session === "light") await lightSession();
  if (session === "all" || session === "gif") await gifSession();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
