import type { FontStyleName, RulerLane, TagStyle } from "../types";

/** Colors for one tag on dark and light themes. Backgrounds carry alpha. */
export interface TagColors {
  dark: string;
  light: string;
  darkBackground: string;
  lightBackground: string;
}

export interface BuiltinTag {
  /** Key used in the contributed theme color ids: `todoforge.<key>Foreground`. */
  key: string;
  icon: string;
  colors: TagColors;
}

const colors = (dark: string, light: string): TagColors => ({
  dark,
  light,
  darkBackground: `${dark}24`,
  lightBackground: `${light}1A`,
});

/**
 * Built-in tags. Each one contributes `todoforge.<key>Foreground` and
 * `todoforge.<key>Background`, so themes and users can recolor them with
 * `workbench.colorCustomizations`. Light colors meet 4.5:1 on white.
 */
export const BUILTIN_TAGS: Readonly<Record<string, BuiltinTag>> = {
  TODO: { key: "todo", icon: "checklist", colors: colors("#E6B325", "#8A5A00") },
  FIXME: { key: "fixme", icon: "flame", colors: colors("#FF6B6B", "#C62828") },
  HACK: { key: "hack", icon: "tools", colors: colors("#C792EA", "#7B3FB0") },
  BUG: { key: "bug", icon: "bug", colors: colors("#F07178", "#B3261E") },
  XXX: { key: "xxx", icon: "warning", colors: colors("#FF9E64", "#A84B0C") },
  UNDONE: { key: "undone", icon: "history", colors: colors("#82AAFF", "#1F5BB8") },
  NOTE: { key: "note", icon: "note", colors: colors("#89DDFF", "#0A6E80") },
  REVIEW: { key: "review", icon: "eye", colors: colors("#C3E88D", "#3B6E12") },
  OPTIMIZE: { key: "optimize", icon: "zap", colors: colors("#7FDBCA", "#0B6E5B") },
  NotImplemented: { key: "notImplemented", icon: "circle-slash", colors: colors("#FF7AB2", "#B0216A") },
  Obsolete: { key: "obsolete", icon: "archive", colors: colors("#A0A8B7", "#5A6170") },
  Warning: { key: "warning", icon: "warning", colors: colors("#FFCB6B", "#7A5200") },
  MARKDOWN: { key: "markdown", icon: "checklist", colors: colors("#9CDCFE", "#0B5C99") },
};

/** Extra theme colors used for due dates, stale TODOs and inline hints. */
export const STATUS_COLORS: Readonly<Record<string, { dark: string; light: string; description: string }>> = {
  overdueForeground: { dark: "#FF6B6B", light: "#C62828", description: "Overdue TODO hints and icons." },
  dueSoonForeground: { dark: "#E6B325", light: "#8A5A00", description: "Hints for TODOs due within seven days." },
  staleForeground: { dark: "#8B949E", light: "#6E7781", description: "Hints for stale TODOs." },
  hintForeground: { dark: "#8B949E", light: "#6E7781", description: "Inline TODO hints such as due dates." },
};

/** Fallback colors for custom tags, cycled in tag order. */
export const CUSTOM_PALETTE: readonly TagColors[] = [
  colors("#E6B325", "#8A5A00"),
  colors("#FF6B6B", "#C62828"),
  colors("#C792EA", "#7B3FB0"),
  colors("#82AAFF", "#1F5BB8"),
  colors("#89DDFF", "#0A6E80"),
  colors("#C3E88D", "#3B6E12"),
  colors("#FF9E64", "#A84B0C"),
  colors("#7FDBCA", "#0B6E5B"),
];

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
  "history",
  "circle-slash",
  "archive",
  "pin",
  "star",
]);

export interface ResolvedTagStyle {
  /** Theme color id when the tag is built in and the user set no override. */
  themeKey?: string;
  colors: TagColors;
  icon: string;
  ruler: RulerLane;
  fontStyle: FontStyleName;
}

const findBuiltin = (tag: string): BuiltinTag | undefined => {
  return BUILTIN_TAGS[tag] ?? Object.entries(BUILTIN_TAGS).find(([name]) => name.toLowerCase() === tag.toLowerCase())?.[1];
};

export const paletteIndex = (tag: string, tags: readonly string[]): number => {
  const index = tags.findIndex((item) => item.toLowerCase() === tag.toLowerCase());
  return index >= 0 ? index : tags.length;
};

export const styleForTag = (
  tag: string,
  tags: readonly string[],
  overrides: Readonly<Record<string, TagStyle>>,
): ResolvedTagStyle => {
  const builtin = findBuiltin(tag);
  const override = overrides[tag] ?? {};
  const base =
    builtin?.colors ?? CUSTOM_PALETTE[paletteIndex(tag, tags) % CUSTOM_PALETTE.length] ?? CUSTOM_PALETTE[0];
  const fallback = base as TagColors;
  const resolved: TagColors = {
    dark: override.foreground || fallback.dark,
    light: override.foreground || fallback.light,
    darkBackground: override.background || fallback.darkBackground,
    lightBackground: override.background || fallback.lightBackground,
  };
  const icon = override.icon && KNOWN_ICONS.has(override.icon) ? override.icon : builtin?.icon ?? "circle";
  return {
    themeKey: builtin && !override.foreground && !override.background ? builtin.key : undefined,
    colors: resolved,
    icon,
    ruler: override.ruler ?? "right",
    fontStyle: override.fontStyle ?? "normal",
  };
};

/** The `contributes.colors` entries for package.json, generated from the palette. */
export const contributedColors = (): { id: string; description: string; defaults: Record<string, string> }[] => {
  const entries: { id: string; description: string; defaults: Record<string, string> }[] = [];
  for (const [tag, builtin] of Object.entries(BUILTIN_TAGS)) {
    const label = tag === "MARKDOWN" ? "Markdown checklist items" : `${tag} tags`;
    entries.push(
      {
        id: `todoforge.${builtin.key}Foreground`,
        description: `Text and icon color for ${label}.`,
        defaults: {
          dark: builtin.colors.dark,
          light: builtin.colors.light,
          highContrast: builtin.colors.dark,
          highContrastLight: builtin.colors.light,
        },
      },
      {
        id: `todoforge.${builtin.key}Background`,
        description: `Background for ${label}.`,
        defaults: {
          dark: builtin.colors.darkBackground,
          light: builtin.colors.lightBackground,
          highContrast: "#00000000",
          highContrastLight: "#00000000",
        },
      },
    );
  }
  for (const [key, value] of Object.entries(STATUS_COLORS)) {
    entries.push({
      id: `todoforge.${key}`,
      description: value.description,
      defaults: { dark: value.dark, light: value.light, highContrast: value.dark, highContrastLight: value.light },
    });
  }
  return entries;
};
