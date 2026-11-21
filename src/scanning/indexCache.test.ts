import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "mocha";

import type { TodoMatch } from "../types";
import {
  INDEX_CACHE_FILE,
  MAX_CACHED_MATCHES,
  indexCacheKey,
  parseIndexCache,
  readIndexCache,
  serializeIndexCache,
  writeIndexCache,
} from "./indexCache";

const match = (line: number): TodoMatch => ({
  id: `file:///w/a.ts#${line}`,
  uri: "file:///w/a.ts",
  workspaceFolder: "/w",
  relativePath: "a.ts",
  line,
  column: 3,
  endColumn: 7,
  leadColumn: 0,
  lineLength: 20,
  tag: "TODO",
  text: "text",
  raw: "// TODO(onur, 2026-12-01): text",
  kind: "tag",
  meta: { owner: "onur", due: "2026-12-01", labels: [] },
});

describe("index cache", () => {
  const key = indexCacheKey({ tags: ["TODO"], folders: ["/w"] });

  it("round-trips matches for the same key", () => {
    const text = serializeIndexCache(key, [match(1), match(2)]);
    assert.ok(text);
    assert.deepEqual(parseIndexCache(text, key), [match(1), match(2)]);
  });

  it("rejects another key, another version or malformed data", () => {
    const text = serializeIndexCache(key, [match(1)]) ?? "";
    assert.equal(parseIndexCache(text, indexCacheKey({ tags: ["FIXME"], folders: ["/w"] })), undefined);
    assert.equal(parseIndexCache(text.replace('"version":1', '"version":99'), key), undefined);
    assert.equal(parseIndexCache("{not json", key), undefined);
    const broken = JSON.parse(text) as { matches: unknown[] };
    broken.matches.push({ id: 1 });
    assert.equal(parseIndexCache(JSON.stringify(broken), key), undefined);
  });

  it("keys change with settings", () => {
    assert.notEqual(indexCacheKey({ a: 1 }), indexCacheKey({ a: 2 }));
    assert.equal(indexCacheKey({ a: 1 }), indexCacheKey({ a: 1 }));
  });

  it("does not cache very large indexes", () => {
    const many = Array.from({ length: MAX_CACHED_MATCHES + 1 }, (_, index) => match(index));
    assert.equal(serializeIndexCache(key, many), undefined);
  });

  it("writes atomically and reads back; too large removes the file", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "todoforge-cache-"));
    const file = path.join(dir, "nested", INDEX_CACHE_FILE);
    assert.equal(await writeIndexCache(file, key, [match(3)]), true);
    assert.deepEqual(await readIndexCache(file, key), [match(3)]);
    assert.deepEqual(fs.readdirSync(path.dirname(file)), [INDEX_CACHE_FILE]);
    const many = Array.from({ length: MAX_CACHED_MATCHES + 1 }, (_, index) => match(index));
    assert.equal(await writeIndexCache(file, key, many), false);
    assert.equal(fs.existsSync(file), false);
    assert.equal(await readIndexCache(file, key), undefined);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
