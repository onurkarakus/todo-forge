import type { GroupBy, TagGroup, TodoMatch } from "../types";
import { formatMatchLabel } from "./label";

export interface ViewNode {
  id: string;
  kind: "root" | "group" | "folder" | "file" | "match" | "empty";
  label: string;
  count: number;
  parentId?: string;
  match?: TodoMatch;
  resourcePath?: string;
  children: ViewNode[];
}

const byLocation = (left: TodoMatch, right: TodoMatch): number => {
  if (left.relativePath !== right.relativePath) {
    return left.relativePath.localeCompare(right.relativePath);
  }
  return left.line - right.line || left.column - right.column;
};

const matchNode = (match: TodoMatch, labelFormat: string): ViewNode => {
  return {
    id: match.id,
    kind: "match",
    label: formatMatchLabel(labelFormat, match),
    count: 1,
    match,
    resourcePath: match.uri,
    children: [],
  };
};

const countOf = (node: ViewNode): number => {
  if (node.kind === "match") {
    return 1;
  }
  return node.children.reduce((sum, child) => sum + countOf(child), 0);
};

const withCounts = (node: ViewNode): ViewNode => {
  const children = node.children.map(withCounts);
  const next = { ...node, children };
  next.count = node.kind === "match" ? 1 : countOf(next);
  return next;
};

const groupByKey = (
  matches: readonly TodoMatch[],
  keyOf: (match: TodoMatch) => string,
  labelFormat: string,
  idPrefix: string,
): ViewNode[] => {
  const buckets = new Map<string, TodoMatch[]>();
  for (const match of matches) {
    const key = keyOf(match);
    const list = buckets.get(key) ?? [];
    list.push(match);
    buckets.set(key, list);
  }
  const keys = [...buckets.keys()].sort((left, right) => left.localeCompare(right));
  return keys.map((key) => {
    const list = buckets.get(key) ?? [];
    return {
      id: `${idPrefix}:${key}`,
      kind: "group" as const,
      label: key,
      count: list.length,
      children: [...list].sort(byLocation).map((match) => matchNode(match, labelFormat)),
    };
  });
};

const groupByTag = (
  matches: readonly TodoMatch[],
  labelFormat: string,
  tagGroups: readonly TagGroup[],
): ViewNode[] => {
  if (tagGroups.length === 0) {
    return groupByKey(matches, (match) => match.tag, labelFormat, "tag");
  }
  const claimed = new Set<string>();
  for (const group of tagGroups) {
    for (const tag of group.tags) {
      claimed.add(tag.toLowerCase());
    }
  }
  const nodes: ViewNode[] = [];
  for (const group of tagGroups) {
    const wanted = new Set(group.tags.map((tag) => tag.toLowerCase()));
    const inner = matches.filter((match) => wanted.has(match.tag.toLowerCase()));
    if (inner.length === 0) {
      continue;
    }
    nodes.push({
      id: `tag-group:${group.name}`,
      kind: "group",
      label: group.name,
      count: inner.length,
      children: groupByKey(inner, (match) => match.tag, labelFormat, `tag:${group.name}`),
    });
  }
  const rest = matches.filter((match) => !claimed.has(match.tag.toLowerCase()));
  nodes.push(...groupByKey(rest, (match) => match.tag, labelFormat, "tag"));
  return nodes;
};

interface FolderBuilder {
  id: string;
  name: string;
  folders: Map<string, FolderBuilder>;
  files: Map<string, TodoMatch[]>;
}

const addFile = (root: FolderBuilder, match: TodoMatch): void => {
  const parts = match.relativePath.split("/");
  const file = parts.pop() ?? match.relativePath;
  let cursor = root;
  let walked = "";
  for (const part of parts) {
    walked = walked ? `${walked}/${part}` : part;
    const existing = cursor.folders.get(part);
    if (existing) {
      cursor = existing;
      continue;
    }
    const created: FolderBuilder = {
      id: `folder:${walked}`,
      name: part,
      folders: new Map(),
      files: new Map(),
    };
    cursor.folders.set(part, created);
    cursor = created;
  }
  const list = cursor.files.get(file) ?? [];
  list.push(match);
  cursor.files.set(file, list);
};

const folderNode = (builder: FolderBuilder, labelFormat: string): ViewNode => {
  const folders = [...builder.folders.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((child) => folderNode(child, labelFormat));
  const files = [...builder.files.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([name, matches]) => {
      const sorted = [...matches].sort(byLocation);
      const first = sorted[0];
      return {
        id: `file:${first?.uri ?? name}`,
        kind: "file" as const,
        label: name,
        count: sorted.length,
        resourcePath: first?.uri,
        children: sorted.map((match) => matchNode(match, labelFormat)),
      };
    });
  return {
    id: builder.id,
    kind: builder.id === "folder-root" ? "group" : "folder",
    label: builder.name,
    count: 0,
    resourcePath: builder.id === "folder-root" ? undefined : builder.id.slice("folder:".length),
    children: [...folders, ...files],
  };
};

const groupByFile = (matches: readonly TodoMatch[], labelFormat: string): ViewNode[] => {
  const root: FolderBuilder = {
    id: "folder-root",
    name: "",
    folders: new Map(),
    files: new Map(),
  };
  for (const match of matches) {
    addFile(root, match);
  }
  const node = folderNode(root, labelFormat);
  return node.children;
};

export const groupMatches = (
  matches: readonly TodoMatch[],
  groupBy: GroupBy,
  labelFormat: string,
  tagGroups: readonly TagGroup[],
  markdownSeparate: boolean,
): ViewNode => {
  const markdown = markdownSeparate ? matches.filter((match) => match.kind === "markdown") : [];
  const code = markdownSeparate ? matches.filter((match) => match.kind !== "markdown") : [...matches];
  let children: ViewNode[];
  if (groupBy === "file") {
    children = groupByFile(code, labelFormat);
  } else if (groupBy === "subtag") {
    children = groupByKey(code, (match) => match.subTag || "(none)", labelFormat, "subtag");
  } else if (groupBy === "flat") {
    children = [...code].sort(byLocation).map((match) => matchNode(match, labelFormat));
  } else {
    children = groupByTag(code, labelFormat, tagGroups);
  }
  if (markdown.length > 0) {
    children.push({
      id: "group:markdown",
      kind: "group",
      label: "Markdown Checklists",
      count: markdown.length,
      children: [...markdown].sort(byLocation).map((match) => matchNode(match, "${text}")),
    });
  }
  if (children.length === 0) {
    children = [
      {
        id: "empty:found",
        kind: "empty",
        label: "No TODOs found",
        count: 0,
        children: [],
      },
    ];
  }
  return withCounts({
    id: "root:found",
    kind: "root",
    label: "Found in Code",
    count: 0,
    children,
  });
};

export const indexNodes = (root: ViewNode): Map<string, ViewNode> => {
  const map = new Map<string, ViewNode>();
  const walk = (node: ViewNode, parent?: ViewNode): void => {
    node.parentId = parent?.id;
    map.set(node.id, node);
    for (const child of node.children) {
      walk(child, node);
    }
  };
  walk(root);
  return map;
};

export const findFileNodeId = (root: ViewNode, uri: string): string | undefined => {
  const map = indexNodes(root);
  for (const node of map.values()) {
    if (node.kind === "file" && node.resourcePath === uri) {
      return node.id;
    }
  }
  for (const node of map.values()) {
    if (node.kind === "match" && node.match?.uri === uri) {
      return node.id;
    }
  }
  return undefined;
};
