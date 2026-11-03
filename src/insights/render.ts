import type { InsightItem, InsightsData } from "./model";

export interface InsightsStrings {
  title: string;
  total: string;
  files: string;
  overdue: string;
  stale: string;
  newOnBranch: string;
  byTag: string;
  byFolder: string;
  byOwner: string;
  ages: string;
  agesUnavailable: string;
  overdueList: string;
  oldestList: string;
  empty: string;
  privacy: string;
}

export const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

// The CSP has no 'unsafe-inline', so style="" attributes are ignored.
// Bar sizes are classes (w37, h80) defined in the nonce'd style block instead.
const percent = (count: number, max: number): number => (count === 0 ? 0 : Math.max(2, Math.round((count / max) * 100)));

const bars = (rows: readonly [string, number][], tone: string, used: Set<number>): string => {
  const max = Math.max(1, ...rows.map(([, count]) => count));
  return rows
    .map(([label, count]) => {
      const width = percent(count, max);
      used.add(width);
      return `<div class="bar-row"><span class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span><span class="bar-track"><span class="bar ${tone} w${width}"></span></span><span class="bar-value">${count}</span></div>`;
    })
    .join("");
};

const columns = (rows: readonly { label: string; count: number }[], used: Set<number>): string => {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return `<div class="columns">${rows
    .map((row) => {
      const height = percent(row.count, max);
      used.add(height);
      return `<div class="col"><span class="col-value">${row.count}</span><span class="col-track"><span class="col-bar h${height}"></span></span><span class="col-label">${escapeHtml(row.label)}</span></div>`;
    })
    .join("")}</div>`;
};

const sizeRules = (used: Set<number>): string =>
  [...used]
    .sort((a, b) => a - b)
    .map((value) => `.w${value}{width:${value}%}.h${value}{height:${value}%}`)
    .join("");

const list = (items: readonly InsightItem[]): string => {
  return `<ul class="items">${items
    .map(
      (item) =>
        `<li><a href="#" data-id="${escapeHtml(item.id)}">${escapeHtml(item.label)}</a><span class="where">${escapeHtml(item.where)}</span><span class="detail">${escapeHtml(item.detail)}</span></li>`,
    )
    .join("")}</ul>`;
};

const card = (title: string, body: string): string => `<section class="card"><h2>${escapeHtml(title)}</h2>${body}</section>`;

/** Builds a self-contained page: no remote scripts, styles, fonts or images. */
export const renderInsightsHtml = (
  data: InsightsData,
  strings: InsightsStrings,
  security: { nonce: string; cspSource: string },
): string => {
  const used = new Set<number>();
  const metric = (value: number, label: string, tone = ""): string =>
    `<div class="metric ${tone}"><span class="metric-value">${value}</span><span class="metric-label">${escapeHtml(label)}</span></div>`;
  const body =
    data.total === 0
      ? `<p class="empty">${escapeHtml(strings.empty)}</p>`
      : `<div class="metrics">${metric(data.total, strings.total)}${metric(data.files, strings.files)}${metric(data.overdueCount, strings.overdue, data.overdueCount > 0 ? "warn" : "")}${metric(data.staleCount, strings.stale)}${metric(data.newCount, strings.newOnBranch)}</div>
<div class="grid">
${card(strings.byTag, bars(data.byTag, "blue", used))}
${card(strings.ages, data.ages ? columns(data.ages, used) : `<p class="muted">${escapeHtml(strings.agesUnavailable)}</p>`)}
${card(strings.byFolder, bars(data.byFolder, "purple", used))}
${data.byOwner.length > 0 ? card(strings.byOwner, bars(data.byOwner, "green", used)) : ""}
${data.overdue.length > 0 ? card(strings.overdueList, list(data.overdue)) : ""}
${data.oldest.length > 0 ? card(strings.oldestList, list(data.oldest)) : ""}
</div>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${security.nonce}'; script-src 'nonce-${security.nonce}'; img-src ${security.cspSource} data:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(strings.title)}</title>
<style nonce="${security.nonce}">
body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);padding:16px 24px;max-width:1200px}
h1{font-size:1.5em;font-weight:600;margin:0 0 4px}
.sub{color:var(--vscode-descriptionForeground);margin:0 0 20px}
.metrics{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px}
.metric{flex:1 1 140px;border:1px solid var(--vscode-widget-border,var(--vscode-panel-border));border-radius:8px;padding:12px 16px;background:var(--vscode-editorWidget-background)}
.metric-value{display:block;font-size:2em;font-weight:600;line-height:1.2}
.metric-label{color:var(--vscode-descriptionForeground)}
.metric.warn .metric-value{color:var(--vscode-charts-orange)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px}
.card{border:1px solid var(--vscode-widget-border,var(--vscode-panel-border));border-radius:8px;padding:14px 16px;background:var(--vscode-editorWidget-background)}
.card h2{font-size:1em;font-weight:600;margin:0 0 12px}
.bar-row{display:grid;grid-template-columns:minmax(80px,40%) 1fr 40px;align-items:center;gap:8px;margin:4px 0}
.bar-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{height:10px;border-radius:5px;background:var(--vscode-editor-inactiveSelectionBackground)}
.bar{display:block;height:100%;border-radius:5px}
.bar.blue{background:var(--vscode-charts-blue)}
.bar.purple{background:var(--vscode-charts-purple)}
.bar.green{background:var(--vscode-charts-green)}
.bar-value,.col-value{text-align:right;font-variant-numeric:tabular-nums;color:var(--vscode-descriptionForeground)}
.columns{display:flex;gap:10px;align-items:flex-end;height:170px}
.col{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;gap:4px}
.col-track{flex:1;width:100%;position:relative}
.col-bar{position:absolute;bottom:0;left:0;right:0;border-radius:4px 4px 0 0;background:var(--vscode-charts-yellow)}
.col-label{font-size:.85em;color:var(--vscode-descriptionForeground);text-align:center}
.items{list-style:none;margin:0;padding:0}
.items li{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:6px 0;border-bottom:1px solid var(--vscode-widget-border,transparent)}
.items a{color:var(--vscode-textLink-foreground);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.items a:hover{text-decoration:underline}
.where{grid-column:1;color:var(--vscode-descriptionForeground);font-size:.9em}
.detail{grid-row:1;grid-column:2;color:var(--vscode-descriptionForeground);font-variant-numeric:tabular-nums}
.muted,.empty{color:var(--vscode-descriptionForeground)}
.privacy{margin-top:20px;color:var(--vscode-descriptionForeground);font-size:.9em}
${sizeRules(used)}
</style>
</head>
<body>
<h1>${escapeHtml(strings.title)}</h1>
${body}
<p class="privacy">${escapeHtml(strings.privacy)}</p>
<script nonce="${security.nonce}">
const vscode = acquireVsCodeApi();
document.addEventListener("click", (event) => {
  const target = event.target.closest("a[data-id]");
  if (!target) { return; }
  event.preventDefault();
  vscode.postMessage({ type: "open", id: target.getAttribute("data-id") });
});
</script>
</body>
</html>`;
};
