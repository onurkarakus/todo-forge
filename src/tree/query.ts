import { daysUntil, PRIORITY_RANK } from "../syntax/metadata";
import type { BlameInfo, SortBy, TodoMatch } from "../types";

/**
 * Filter query language used by the live filter and saved views.
 *
 *   plain words        match tag, text, path, owner and labels
 *   tag:FIXME          tag equals (comma for several: tag:TODO,FIXME)
 *   owner:onur  @onur  inline owner or blame author
 *   #label             inline label
 *   path:src/api       path contains
 *   is:mine            mine (inline owner or blame author is you)
 *   is:stale           older than the stale threshold
 *   is:overdue         due date in the past
 *   is:due             has a due date
 *   is:new             added on this branch or uncommitted
 *   -word / -tag:X     negation
 */
export interface QueryContext {
  today: string;
  staleAfterDays: number;
  nowSeconds: number;
  me: { names: string[]; emails: string[] };
  blameOf: (match: TodoMatch) => BlameInfo | undefined;
  isNew: (match: TodoMatch) => boolean;
}

interface Term {
  negate: boolean;
  key: string;
  value: string;
}

export const parseQuery = (query: string): Term[] => {
  const terms: Term[] = [];
  const tokens = query.match(/-?(?:[a-z]+:)?"[^"]*"|\S+/gi) ?? [];
  for (const token of tokens) {
    let rest = token;
    let negate = false;
    if (rest.startsWith("-") && rest.length > 1) {
      negate = true;
      rest = rest.slice(1);
    }
    const keyed = /^([a-z]+):(.*)$/i.exec(rest);
    if (keyed && ["tag", "owner", "path", "is", "label"].includes((keyed[1] ?? "").toLowerCase())) {
      terms.push({ negate, key: (keyed[1] ?? "").toLowerCase(), value: (keyed[2] ?? "").replace(/^"|"$/g, "") });
      continue;
    }
    if (rest.startsWith("@") && rest.length > 1) {
      terms.push({ negate, key: "owner", value: rest.slice(1) });
      continue;
    }
    if (rest.startsWith("#") && rest.length > 1 && !/^#\d+$/.test(rest)) {
      terms.push({ negate, key: "label", value: rest.slice(1) });
      continue;
    }
    terms.push({ negate, key: "text", value: rest.replace(/^"|"$/g, "") });
  }
  return terms;
};

export const ageInDays = (blame: BlameInfo | undefined, nowSeconds: number): number | undefined => {
  if (!blame) {
    return undefined;
  }
  if (blame.uncommitted) {
    return 0;
  }
  return Math.max(0, Math.floor((nowSeconds - blame.time) / 86_400));
};

const normalize = (value: string): string => value.trim().toLowerCase();

export const isMine = (match: TodoMatch, context: QueryContext): boolean => {
  const names = context.me.names.map(normalize).filter((name) => name.length > 0);
  const emails = context.me.emails.map(normalize).filter((email) => email.length > 0);
  const owner = match.meta?.owner ? normalize(match.meta.owner) : undefined;
  if (owner) {
    const ownerMatches = names.some((name) => name === owner || name.split(/\s+/)[0] === owner) ||
      emails.some((email) => email === owner || email.split("@")[0] === owner);
    return ownerMatches;
  }
  const blame = context.blameOf(match);
  if (!blame) {
    return false;
  }
  if (blame.uncommitted) {
    return true;
  }
  return emails.includes(normalize(blame.email)) || names.includes(normalize(blame.author));
};

const ownerText = (match: TodoMatch, context: QueryContext): string => {
  return [match.meta?.owner ?? "", context.blameOf(match)?.author ?? "", context.blameOf(match)?.email ?? ""]
    .join(" ")
    .toLowerCase();
};

const termMatches = (term: Term, match: TodoMatch, context: QueryContext): boolean => {
  const value = term.value.toLowerCase();
  switch (term.key) {
    case "tag":
      return value.split(",").some((tag) => tag.length > 0 && match.tag.toLowerCase() === tag);
    case "owner":
      return ownerText(match, context).includes(value);
    case "label":
      return (match.meta?.labels ?? []).some((label) => label.toLowerCase() === value) || (match.subTag ?? "").toLowerCase() === value;
    case "path":
      return match.relativePath.toLowerCase().includes(value);
    case "is": {
      if (value === "mine") {
        return isMine(match, context);
      }
      if (value === "stale") {
        const age = ageInDays(context.blameOf(match), context.nowSeconds);
        return age !== undefined && age >= context.staleAfterDays;
      }
      if (value === "overdue") {
        return Boolean(match.meta?.due && daysUntil(match.meta.due, context.today) < 0);
      }
      if (value === "due") {
        return Boolean(match.meta?.due);
      }
      if (value === "new") {
        return context.isNew(match);
      }
      if (value === "code") {
        return match.kind === "code";
      }
      return false;
    }
    default: {
      const haystack = [
        match.tag,
        match.text,
        match.relativePath,
        match.subTag ?? "",
        match.meta?.owner ?? "",
        ...(match.meta?.labels ?? []),
      ]
        .join("\n")
        .toLowerCase();
      return haystack.includes(value);
    }
  }
};

export const filterByQuery = (
  matches: readonly TodoMatch[],
  query: string,
  context: QueryContext,
): TodoMatch[] => {
  const terms = parseQuery(query);
  if (terms.length === 0) {
    return [...matches];
  }
  return matches.filter((match) => terms.every((term) => termMatches(term, match, context) !== term.negate));
};

/** True when the query needs blame data (owner, age or mine filters). */
export const queryNeedsBlame = (query: string): boolean => {
  return parseQuery(query).some(
    (term) => term.key === "owner" || (term.key === "is" && ["mine", "stale"].includes(term.value.toLowerCase())),
  );
};

const byLocation = (left: TodoMatch, right: TodoMatch): number => {
  if (left.relativePath !== right.relativePath) {
    return left.relativePath.localeCompare(right.relativePath);
  }
  return left.line - right.line || left.column - right.column;
};

export const sortMatches = (
  matches: readonly TodoMatch[],
  sortBy: SortBy,
  context: Pick<QueryContext, "blameOf" | "nowSeconds">,
): TodoMatch[] => {
  const sorted = [...matches];
  if (sortBy === "age") {
    const age = (match: TodoMatch): number => ageInDays(context.blameOf(match), context.nowSeconds) ?? -1;
    return sorted.sort((left, right) => age(right) - age(left) || byLocation(left, right));
  }
  if (sortBy === "due") {
    const due = (match: TodoMatch): string => match.meta?.due ?? "9999-12-31";
    return sorted.sort((left, right) => due(left).localeCompare(due(right)) || byLocation(left, right));
  }
  if (sortBy === "priority") {
    const rank = (match: TodoMatch): number => (match.meta?.priority ? PRIORITY_RANK[match.meta.priority] : 3);
    return sorted.sort((left, right) => rank(left) - rank(right) || byLocation(left, right));
  }
  return sorted.sort(byLocation);
};

/** Short relative age such as 3d, 5w, 7mo, 2y. */
export const formatAge = (days: number): string => {
  if (days < 1) {
    return "today";
  }
  if (days < 14) {
    return `${days}d`;
  }
  if (days < 60) {
    return `${Math.floor(days / 7)}w`;
  }
  if (days < 365) {
    return `${Math.floor(days / 30)}mo`;
  }
  return `${Math.floor(days / 365)}y`;
};
