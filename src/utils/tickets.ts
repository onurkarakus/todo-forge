/**
 * Ticket-like tokens in a TODO (read-only links, no API calls).
 * Supports #123, [JIRA-123], PROJ-123 and raw http(s) URLs.
 */

export interface TicketRef {
  /** Bare id such as `123` or `JIRA-123`, or the URL for raw links. */
  token: string;
  /** Text shown in the UI, such as `#123` or `JIRA-123`. */
  display: string;
  /** Resolved URL when a template or a raw URL is available. */
  url?: string;
  kind: "ticket" | "url";
}

const ISSUE_ID = /[A-Z][A-Z0-9]+-\d+/;
const BRACKET = /\[([A-Z][A-Z0-9]+-\d+)\]/g;
const HASH = /#(\d+)\b/g;
const BARE = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
const URL = /https?:\/\/[^\s)\]>'"]+/gi;

const isIssueId = (value: string): boolean => ISSUE_ID.test(value) || /^\d+$/.test(value);

export const applyTicketUrl = (template: string, token: string, tag: string, display: string): string => {
  const trimmed = template.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed
    .replace(/\$\{token\}/gi, encodeURIComponent(token) === token ? token : token)
    .replace(/\$\{encodedToken\}/gi, encodeURIComponent(token))
    .replace(/\$\{encoded\}/gi, encodeURIComponent(token))
    .replace(/\$\{subTag\}/gi, display)
    .replace(/\$\{tag\}/gi, tag);
};

const add = (list: TicketRef[], seen: Set<string>, ref: TicketRef): void => {
  const key = `${ref.kind}:${ref.token}`;
  if (seen.has(key) || !ref.token) {
    return;
  }
  seen.add(key);
  list.push(ref);
};

export const ticketsOf = (
  input: { tag: string; subTag?: string; text: string; raw: string },
  template: string,
): TicketRef[] => {
  const result: TicketRef[] = [];
  const seen = new Set<string>();
  const link = (token: string, display: string): string | undefined => {
    const url = applyTicketUrl(template, token, input.tag, display);
    return url.length > 0 ? url : undefined;
  };

  if (input.subTag) {
    const raw = input.subTag;
    const token = raw.startsWith("#") ? raw.slice(1) : raw.replace(/^\[|\]$/g, "");
    if (isIssueId(token)) {
      const display = /^\d+$/.test(token) ? `#${token}` : token;
      add(result, seen, { token, display, url: link(token, raw.startsWith("#") ? raw : display), kind: "ticket" });
    }
  }

  const haystack = `${input.raw}\n${input.text}`;
  for (const found of haystack.matchAll(BRACKET)) {
    const token = found[1] ?? "";
    add(result, seen, { token, display: token, url: link(token, token), kind: "ticket" });
  }
  for (const found of haystack.matchAll(HASH)) {
    const token = found[1] ?? "";
    add(result, seen, { token, display: `#${token}`, url: link(token, `#${token}`), kind: "ticket" });
  }
  for (const found of haystack.matchAll(BARE)) {
    const token = found[1] ?? "";
    add(result, seen, { token, display: token, url: link(token, token), kind: "ticket" });
  }
  for (const found of haystack.matchAll(URL)) {
    const url = found[0] ?? "";
    add(result, seen, { token: url, display: url, url, kind: "url" });
  }
  return result;
};
