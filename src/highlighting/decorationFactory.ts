import * as vscode from "vscode";

import type { TodoForgeSettings } from "../types";
import { iconSvg } from "./icons";
import { applyOpacity, styleForTag, type ResolvedTagStyle } from "./palette";

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

const clampOpacity = (value: number): number => Math.min(1, Math.max(0, value));

export const themeColorId = (key: string, part: "Foreground" | "Background"): string => `todoforge.${key}${part}`;

const borderColor = (resolved: ResolvedTagStyle, settings: TodoForgeSettings, theme: "dark" | "light"): string | undefined => {
  const flag = resolved.border ?? (settings.highlightBorder ? true : false);
  if (!flag) {
    return undefined;
  }
  const color = typeof flag === "string" ? flag : theme === "dark" ? resolved.colors.dark : resolved.colors.light;
  const opacity = clampOpacity(resolved.opacity * settings.highlightOpacity);
  return opacity === 1 ? color : applyOpacity(color, opacity);
};

/**
 * Built-in tags use contributed theme colors so they follow the active theme
 * (and `workbench.colorCustomizations`). Custom tags and user overrides use
 * separate dark and light colors. Gutter icons are images, so they get a
 * light and a dark variant. Opacity or a border falls back to hex colors so
 * the setting can be applied.
 */
export const createTagDecorations = (tag: string, settings: TodoForgeSettings): TagDecorations => {
  const resolved = styleForTag(tag, settings.tags, settings.tagStyles);
  const fontStyle = resolved.fontStyle === "italic" ? "italic" : undefined;
  const fontWeight = resolved.fontStyle === "bold" ? "600" : undefined;
  const textDecoration = resolved.fontStyle === "underline" ? "underline" : undefined;
  const wholeLine = settings.highlightStyle === "line";
  const opacity = clampOpacity(resolved.opacity * settings.highlightOpacity);
  const themed = Boolean(resolved.themeKey) && opacity === 1;
  const darkFg = opacity === 1 ? resolved.colors.dark : applyOpacity(resolved.colors.dark, opacity);
  const lightFg = opacity === 1 ? resolved.colors.light : applyOpacity(resolved.colors.light, opacity);
  const darkBg = applyOpacity(resolved.colors.darkBackground, opacity);
  const lightBg = applyOpacity(resolved.colors.lightBackground, opacity);
  const darkBorder = borderColor(resolved, settings, "dark");
  const lightBorder = borderColor(resolved, settings, "light");
  const gutter = settings.highlightGutterIcons !== false;
  const inline = vscode.window.createTextEditorDecorationType({
    fontStyle,
    fontWeight,
    textDecoration,
    isWholeLine: wholeLine,
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    gutterIconSize: "75%",
    ...(themed
      ? {
          color: new vscode.ThemeColor(themeColorId(resolved.themeKey as string, "Foreground")),
          backgroundColor: new vscode.ThemeColor(themeColorId(resolved.themeKey as string, "Background")),
        }
      : {}),
    dark: {
      ...(gutter ? { gutterIconPath: svgUri(resolved.icon, resolved.colors.dark) } : {}),
      ...(themed ? {} : { color: darkFg, backgroundColor: darkBg }),
      ...(darkBorder ? { border: "1px solid", borderColor: darkBorder } : {}),
    },
    light: {
      ...(gutter ? { gutterIconPath: svgUri(resolved.icon, resolved.colors.light) } : {}),
      ...(themed ? {} : { color: lightFg, backgroundColor: lightBg }),
      ...(lightBorder ? { border: "1px solid", borderColor: lightBorder } : {}),
    },
  });
  const lane = laneOf(resolved.ruler);
  const ruler = lane
    ? vscode.window.createTextEditorDecorationType({
        overviewRulerLane: lane,
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        ...(themed
          ? { overviewRulerColor: new vscode.ThemeColor(themeColorId(resolved.themeKey as string, "Foreground")) }
          : {}),
        dark: themed ? {} : { overviewRulerColor: darkFg },
        light: themed ? {} : { overviewRulerColor: lightFg },
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
