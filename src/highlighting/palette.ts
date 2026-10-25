import type { FontStyleName, RulerLane, TagStyle } from "../types";

export interface ResolvedTagStyle {
  foreground: string;
  background: string;
  icon: string;
  ruler: RulerLane;
  fontStyle: FontStyleName;
}

export const TAG_PALETTE: readonly { foreground: string; background: string }[] = [
  { foreground: "#E6B325", background: "#3A3114" },
  { foreground: "#FF6B6B", background: "#3D1F1F" },
  { foreground: "#C792EA", background: "#2C2140" },
  { foreground: "#F07178", background: "#3A2024" },
  { foreground: "#82AAFF", background: "#1C283D" },
  { foreground: "#FFCB6B", background: "#3A3118" },
  { foreground: "#89DDFF", background: "#16303A" },
  { foreground: "#C3E88D", background: "#24331C" },
];

const DEFAULT_ICONS: Record<string, string> = {
  TODO: "checklist",
  FIXME: "flame",
  HACK: "tools",
  BUG: "bug",
  NOTE: "note",
  XXX: "warning",
  REVIEW: "eye",
  OPTIMIZE: "zap",
  MARKDOWN: "checklist",
};

export const KNOWN_ICONS = new Set([
  "checklist",
  "flame",
  "tools",
  "bug",
  "note",
  "warning",
  "eye",
  "zap",
  "circle",
]);

export const styleForTag = (
  tag: string,
  index: number,
  overrides: Readonly<Record<string, TagStyle>>,
): ResolvedTagStyle => {
  const palette = TAG_PALETTE[index % TAG_PALETTE.length] ?? TAG_PALETTE[0];
  const override = overrides[tag] ?? {};
  const icon = override.icon && KNOWN_ICONS.has(override.icon) ? override.icon : DEFAULT_ICONS[tag] ?? "circle";
  return {
    foreground: override.foreground || (palette?.foreground ?? "#E6B325"),
    background: override.background || (palette?.background ?? "#3A3114"),
    icon,
    ruler: override.ruler ?? "right",
    fontStyle: override.fontStyle ?? "normal",
  };
};

export const paletteIndex = (tag: string, tags: readonly string[]): number => {
  const index = tags.findIndex((item) => item.toLowerCase() === tag.toLowerCase());
  return index >= 0 ? index : tags.length;
};
