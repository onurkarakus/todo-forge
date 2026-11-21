import type { ViewNode } from "./grouping";

/** What a tree node looks like to the view: its own content and the ids of its children. */
export interface NodeSignature {
  content: string;
  children: string;
}

export const signTree = (root: ViewNode, contentOf: (node: ViewNode) => string): Map<string, NodeSignature> => {
  const signatures = new Map<string, NodeSignature>();
  const walk = (node: ViewNode): void => {
    signatures.set(node.id, {
      content: contentOf(node),
      children: node.children.map((child) => child.id).join("\n"),
    });
    for (const child of node.children) {
      walk(child);
    }
  };
  walk(root);
  return signatures;
};

/**
 * The smallest set of node ids to refresh so the view matches `next`.
 * A refreshed node also reloads its children, so descendants of a listed node
 * are not listed. Returns "all" when the top level changed, when there is no
 * previous tree, or when more than `limit` nodes changed (one full refresh is
 * cheaper then).
 */
export const changedNodeIds = (
  previous: ReadonlyMap<string, NodeSignature> | undefined,
  next: ReadonlyMap<string, NodeSignature>,
  root: ViewNode,
  limit = 300,
): string[] | "all" => {
  if (!previous) {
    return "all";
  }
  const before = previous.get(root.id);
  const after = next.get(root.id);
  if (!before || !after || before.children !== after.children) {
    return "all";
  }
  const changed: string[] = [];
  const stack = [...root.children].reverse();
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      break;
    }
    const old = previous.get(node.id);
    const now = next.get(node.id);
    if (!old || !now || old.content !== now.content || old.children !== now.children) {
      changed.push(node.id);
      if (changed.length > limit) {
        return "all";
      }
      continue;
    }
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      const child = node.children[index];
      if (child) {
        stack.push(child);
      }
    }
  }
  return changed;
};
