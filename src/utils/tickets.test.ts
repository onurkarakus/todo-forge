import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { applyTicketUrl, ticketsOf } from "./tickets";

describe("tickets", () => {
  it("builds a URL from a template", () => {
    assert.equal(
      applyTicketUrl("https://jira.example.com/browse/${token}", "ABC-12", "FIXME", "ABC-12"),
      "https://jira.example.com/browse/ABC-12",
    );
    assert.equal(
      applyTicketUrl("https://github.com/org/repo/issues/${token}", "123", "TODO", "#123"),
      "https://github.com/org/repo/issues/123",
    );
    assert.equal(applyTicketUrl("", "123", "TODO", "#123"), "");
  });

  it("extracts #123, [JIRA-123], bare issue ids and raw URLs", () => {
    const found = ticketsOf(
      {
        tag: "FIXME",
        subTag: "123",
        text: "see also PROJ-9 and https://example.com/x",
        raw: "// FIXME[JIRA-123] #45: see also PROJ-9 and https://example.com/x",
      },
      "https://issues.example.com/${token}",
    );
    const byDisplay = Object.fromEntries(found.map((item) => [item.display, item]));
    assert.equal(byDisplay["#123"]?.url, "https://issues.example.com/123");
    assert.equal(byDisplay["JIRA-123"]?.url, "https://issues.example.com/JIRA-123");
    assert.equal(byDisplay["#45"]?.url, "https://issues.example.com/45");
    assert.equal(byDisplay["PROJ-9"]?.url, "https://issues.example.com/PROJ-9");
    assert.equal(byDisplay["https://example.com/x"]?.kind, "url");
    assert.equal(byDisplay["https://example.com/x"]?.url, "https://example.com/x");
  });

  it("leaves ticket tokens without a URL when no template is set, except raw links", () => {
    const found = ticketsOf({ tag: "TODO", text: "fix ABC-1 also https://ex.com", raw: "// TODO: fix ABC-1 also https://ex.com" }, "");
    const tickets = found.filter((item) => item.kind === "ticket");
    const urls = found.filter((item) => item.kind === "url");
    assert.equal(tickets[0]?.display, "ABC-1");
    assert.equal(tickets[0]?.url, undefined);
    assert.equal(urls[0]?.url, "https://ex.com");
  });
});
