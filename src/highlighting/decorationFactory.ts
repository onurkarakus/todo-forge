import * as vscode from "vscode";

import type { HighlightStyle, TagStyle, TodoForgeSettings } from "../types";
import { paletteIndex, styleForTag, type ResolvedTagStyle } from "./palette";
import { iconSvg } from "./icons";

export interface TagDecorations {
  inline: vscode.TextEditorDecorationType;
  ruler?: vscode.TextEditorDecorationType;
}

const laneOf = (ruler: ResolvedTagStyle["ruler"]): vscode.OverviewRulerLane | undefined => {
  if (ruler === "off") {
    return undefined;
  }
  if (ruler === "left") {
    return vscode.OverviewRulerLane.Left;
  }
  if (ruler === "center") {
    return vscode.OverviewRulerLane.Center;
  }
  if (ruler === "full") {
    return vscode.OverviewRulerLane.Full;
  }
  return vscode.OverviewRulerLane.Right;
};

const fontStyleOf = (style: ResolvedTagStyle["fontStyle"]): string | undefined => {
  return style === "normal" ? undefined : style;
};

export const createTagDecorations = (
  tag: string,
  settings: TodoForgeSettings,
): TagDecorations => {
  const resolved = styleForTag(tag, paletteIndex(tag, settings.tags), settings.tagStyles);
  const svg = iconSvg(resolved.icon, resolved.foreground);
  const inline = vscode.window.createTextEditorDecorationType({
    color: resolved.foreground,
    backgroundColor: resolved.background,
    fontStyle: fontStyleOf(resolved.fontStyle),
    isWholeLine: settings.highlightStyle === "line",
    gutterIconPath: vscode.Uri.parse(`data:image/svg+xml,${encodeURIComponent(svg)}`),
    gutterIconSize: "80%",
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });
  const lane = laneOf(resolved.ruler);
  const ruler = lane
    ? vscode.window.createTextEditorDecorationType({
        overviewRulerColor: resolved.foreground,
        overviewRulerLane: lane,
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      })
    : undefined;
  return { inline, ruler };
};

export const disposeDecorations = (types: Iterable<TagDecorations>): void => {
  for (const entry of types) {
    entry.inline.dispose();
    entry.ruler?.dispose();
  }
};

export type { TagStyle, HighlightStyle };
