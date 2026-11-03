import * as vscode from "vscode";

import type { TodoForgeSettings } from "../types";
import { iconSvg } from "./icons";
import { styleForTag, type ResolvedTagStyle } from "./palette";

export interface TagDecorations {
  inline: vscode.TextEditorDecorationType;
  ruler?: vscode.TextEditorDecorationType;
}

const laneOf = (ruler: ResolvedTagStyle["ruler"]): vscode.OverviewRulerLane | undefined => {
  switch (ruler) {
    case "off":
      return undefined;
    case "left":
      return vscode.OverviewRulerLane.Left;
    case "center":
      return vscode.OverviewRulerLane.Center;
    case "full":
      return vscode.OverviewRulerLane.Full;
    default:
      return vscode.OverviewRulerLane.Right;
  }
};

const svgUri = (icon: string, color: string): vscode.Uri => {
  return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(iconSvg(icon, color))}`);
};

export const themeColorId = (key: string, part: "Foreground" | "Background"): string => `todoforge.${key}${part}`;

/**
 * Built-in tags use contributed theme colors so they follow the active theme
 * (and `workbench.colorCustomizations`). Custom tags and user overrides use
 * separate dark and light colors. Gutter icons are images, so they get a
 * light and a dark variant.
 */
export const createTagDecorations = (tag: string, settings: TodoForgeSettings): TagDecorations => {
  const resolved = styleForTag(tag, settings.tags, settings.tagStyles);
  const fontStyle = resolved.fontStyle === "italic" ? "italic" : undefined;
  const fontWeight = resolved.fontStyle === "bold" ? "600" : undefined;
  const textDecoration = resolved.fontStyle === "underline" ? "underline" : undefined;
  const wholeLine = settings.highlightStyle === "line";
  const themed = resolved.themeKey;
  const inline = vscode.window.createTextEditorDecorationType({
    fontStyle,
    fontWeight,
    textDecoration,
    isWholeLine: wholeLine,
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    gutterIconSize: "75%",
    ...(themed
      ? {
          color: new vscode.ThemeColor(themeColorId(themed, "Foreground")),
          backgroundColor: new vscode.ThemeColor(themeColorId(themed, "Background")),
        }
      : {}),
    dark: {
      gutterIconPath: svgUri(resolved.icon, resolved.colors.dark),
      ...(themed ? {} : { color: resolved.colors.dark, backgroundColor: resolved.colors.darkBackground }),
    },
    light: {
      gutterIconPath: svgUri(resolved.icon, resolved.colors.light),
      ...(themed ? {} : { color: resolved.colors.light, backgroundColor: resolved.colors.lightBackground }),
    },
  });
  const lane = laneOf(resolved.ruler);
  const ruler = lane
    ? vscode.window.createTextEditorDecorationType({
        overviewRulerLane: lane,
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        ...(themed
          ? { overviewRulerColor: new vscode.ThemeColor(themeColorId(themed, "Foreground")) }
          : {}),
        dark: themed ? {} : { overviewRulerColor: resolved.colors.dark },
        light: themed ? {} : { overviewRulerColor: resolved.colors.light },
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
