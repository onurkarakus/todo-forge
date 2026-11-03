import type { GroupBy, TagGroup, TodoMatch } from "../types";
import { formatMatchLabel } from "./label";

export interface ViewNode {
  id: string;
  kind: "root" | "group" | "workspace" | "folder" | "file" | "match" | "empty";
  label: string;
  count: number;
  parentId?: string;
  match?: TodoMatch;
  /** File URI for file nodes, folder path relative to its workspace folder for folder nodes. */
  resourcePath?: string;
  /** Absolute workspace folder path for workspace and folder nodes. */
  workspaceFolder?: string;
  children: ViewNode[];
}

export interface GroupOptions {
  groupBy: GroupBy;
  labelFormat: string;
  tagGroups: readonly TagGroup[];
  markdownSeparate: boolean;
  /** Workspace folders in display order. More than one adds a level per folder when grouping by file. */
  workspaceFolders: readonly { path: string; name: string }[];
  /** Matches arrive pre-sorted; keep that order inside groups instead of sorting by location. */
  keepOrder?: boolean;
  /** Label for the Markdown group. */
  markdownLabel?: string;
  /** Label for owner-less TODOs when grouping by owner. */
  noOwnerLabel?: string;
  /** Configured tag order; tag groups follow it, unknown tags come last alphabetically. */
  tagOrder?: readonly string[];
}

const byLocation = (left: TodoMatch, right: TodoMatch): number => {
  if (left.relativePath !== right.relativePath) {
    return left.relativePath.localeCompare(right.relativePath);
  }
  return left.line - right.line || left.column - right.column;
};

export const matchNode = (match: TodoMatch, labelFormat: string, idPrefix = ""): ViewNode => {
  return {
    id: `${idPrefix}${match.id}`,
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

const ordered = (matches: readonly TodoMatch[], keepOrder: boolean): TodoMatch[] => {
  return keepOrder ? [...matches] : [...matches].sort(byLocation);
};

const tagComparator = (order: readonly string[] | undefined) => {
  const rank = new Map((order ?? []).map((tag, index) => [tag.toLowerCase(), index]));
  return (left: string, right: string): number => {
    const a = rank.get(left.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    const b = rank.get(right.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    return a - b || left.localeCompare(right);
  };
};

const groupByKey = (
  matches: readonly TodoMatch[],
  keyOf: (match: TodoMatch) => string,
  options: GroupOptions,
  idPrefix: string,
  compare: (left: string, right: string) => number = (left, right) => left.localeCompare(right),
): ViewNode[] => {
  const buckets = new Map<string, TodoMatch[]>();
  for (const match of matches) {
    const key = keyOf(match);
    const list = buckets.get(key) ?? [];
    list.push(match);
    buckets.set(key, list);
  }
  const keys = [...buckets.keys()].sort(compare);
  return keys.map((key) => {
    const list = buckets.get(key) ?? [];
    return {
      id: `${idPrefix}:${key}`,
      kind: "group" as const,
      label: key,
      count: list.length,
      children: ordered(list, options.keepOrder === true).map((match) => matchNode(match, options.labelFormat)),
    };
  });
};

const groupByTag = (matches: readonly TodoMatch[], options: GroupOptions): ViewNode[] => {
  const byTagOrder = tagComparator(options.tagOrder);
  if (options.tagGroups.length === 0) {
    return groupByKey(matches, (match) => match.tag, options, "tag", byTagOrder);
  }
  const claimed = new Set<string>();
  for (const group of options.tagGroups) {
    for (const tag of group.tags) {
      claimed.add(tag.toLowerCase());
    }
  }
  const nodes: ViewNode[] = [];
  for (const group of options.tagGroups) {
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
      children: groupByKey(inner, (match) => match.tag, options, `tag:${group.name}`, byTagOrder),
    });
  }
  const rest = matches.filter((match) => !claimed.has(match.tag.toLowerCase()));
  nodes.push(...groupByKey(rest, (match) => match.tag, options, "tag", byTagOrder));
  return nodes;
};

interface FolderBuilder {
  id: string;
  name: string;
  relative: string;
  folders: Map<string, FolderBuilder>;
  files: Map<string, TodoMatch[]>;
}

const newFolder = (id: string, name: string, relative: string): FolderBuilder => {
  return { id, name, relative, folders: new Map(), files: new Map() };
};

const addFile = (root: FolderBuilder, match: TodoMatch, idRoot: string): void => {
  const parts = match.relativePath.split("/");
  parts.pop();
  let cursor = root;
  let walked = "";
  for (const part of parts) {
    walked = walked ? `${walked}/${part}` : part;
    const existing = cursor.folders.get(part);
    if (existing) {
      cursor = existing;
      continue;
    }
    const created = newFolder(`folder:${idRoot}:${walked}`, part, walked);
    cursor.folders.set(part, created);
    cursor = created;
  }
  // Key files by URI so equal relative paths in different roots never merge.
  const list = cursor.files.get(match.uri) ?? [];
  list.push(match);
  cursor.files.set(match.uri, list);
};

/** Collapses single-child folder chains such as src/app/api into one node. */
const compact = (node: ViewNode): ViewNode => {
  let current = node;
  while (
    current.kind === "folder" &&
    current.children.length === 1 &&
    current.children[0]?.kind === "folder"
  ) {
    const child = current.children[0];
    current = { ...child, label: `${current.label}/${child.label}` };
  }
  return { ...current, children: current.children.map(compact) };
};

const folderNode = (builder: FolderBuilder, options: GroupOptions, workspaceFolder: string | undefined): ViewNode => {
  const folders = [...builder.folders.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((child) => folderNode(child, options, workspaceFolder));
  const files = [...builder.files.entries()]
    .map(([uri, matches]) => {
      const sorted = ordered(matches, options.keepOrder === true);
      const first = sorted[0];
      const name = first ? first.relativePath.split("/").pop() ?? first.relativePath : uri;
      return {
        id: `file:${uri}`,
        kind: "file" as const,
        label: name,
        count: sorted.length,
        resourcePath: uri,
        children: sorted.map((match) => matchNode(match, options.labelFormat)),
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
  return {
    id: builder.id,
    kind: "folder",
    label: builder.name,
    count: 0,
    resourcePath: builder.relative,
    workspaceFolder,
    children: [...folders, ...files],
  };
};

const groupByFile = (matches: readonly TodoMatch[], options: GroupOptions): ViewNode[] => {
  const multiRoot = options.workspaceFolders.length > 1;
  const byRoot = new Map<string, TodoMatch[]>();
  for (const match of matches) {
    const key = multiRoot ? match.workspaceFolder ?? "" : "";
    const list = byRoot.get(key) ?? [];
    list.push(match);
    byRoot.set(key, list);
  }
  const buildRoot = (key: string, list: readonly TodoMatch[]): ViewNode[] => {
    const root = newFolder(`folder-root:${key}`, "", "");
    for (const match of list) {
      addFile(root, match, key);
    }
    const workspaceFolder = key || options.workspaceFolders[0]?.path;
    return folderNode(root, options, workspaceFolder).children.map(compact);
  };
  if (!multiRoot) {
    return buildRoot("", matches);
  }
  const nodes: ViewNode[] = [];
  const known = new Set(options.workspaceFolders.map((folder) => folder.path));
  for (const folder of options.workspaceFolders) {
    const list = byRoot.get(folder.path);
    if (!list || list.length === 0) {
      continue;
    }
    nodes.push({
      id: `workspace:${folder.path}`,
      kind: "workspace",
      label: folder.name,
      count: list.length,
      workspaceFolder: folder.path,
      children: buildRoot(folder.path, list),
    });
  }
  for (const [key, list] of byRoot) {
    if (!known.has(key) && list.length > 0) {
      nodes.push(...buildRoot(key, list));
    }
  }
  return nodes;
};

export const groupMatches = (matches: readonly TodoMatch[], options: GroupOptions): ViewNode => {
  const markdown = options.markdownSeparate ? matches.filter((match) => match.kind === "markdown") : [];
  const code = options.markdownSeparate ? matches.filter((match) => match.kind !== "markdown") : [...matches];
  let children: ViewNode[];
  if (options.groupBy === "file") {
    children = groupByFile(code, options);
  } else if (options.groupBy === "subtag") {
    children = groupByKey(code, (match) => match.subTag || match.meta?.labels[0] || "(none)", options, "subtag");
  } else if (options.groupBy === "owner") {
    children = groupByKey(code, (match) => match.meta?.owner || options.noOwnerLabel || "(no owner)", options, "owner");
  } else if (options.groupBy === "flat") {
    children = ordered(code, options.keepOrder === true).map((match) => matchNode(match, options.labelFormat));
  } else {
    children = groupByTag(code, options);
  }
  if (markdown.length > 0) {
    children.push({
      id: "group:markdown",
      kind: "group",
      label: options.markdownLabel ?? "Markdown Checklists",
      count: markdown.length,
      children: ordered(markdown, options.keepOrder === true).map((match) => matchNode(match, "${text}")),
    });
  }
  return withCounts({
    id: "root:found",
    kind: "root",
    label: "TODOs",
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
