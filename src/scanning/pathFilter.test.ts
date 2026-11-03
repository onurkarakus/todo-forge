import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { DEFAULT_EXCLUDE_GLOBS } from "../config/defaults";
import { createPathFilter } from "./pathFilter";

describe("pathFilter", () => {
  const filter = createPathFilter(DEFAULT_EXCLUDE_GLOBS, []);

  it("drops build output and generated files", () => {
    assert.equal(filter.accepts("src/Api/bin/Debug/net8.0/App.cs"), false);
    assert.equal(filter.accepts("src/Api/obj/project.assets.json"), false);
    assert.equal(filter.accepts("node_modules/x/index.js"), false);
    assert.equal(filter.accepts("src/Form1.Designer.cs"), true, "case differs from the glob");
    assert.equal(filter.accepts("src/Form1.designer.cs"), false);
    assert.equal(filter.accepts("Grpc/Service.g.cs"), false);
    assert.equal(filter.accepts(".git/index"), false);
    assert.equal(filter.accepts("web/app.min.js"), false);
  });

  it("keeps sources, including a folder named packages", () => {
    assert.equal(filter.accepts("src/Api/Program.cs"), true);
    assert.equal(filter.accepts("packages/core/src/index.ts"), true);
    assert.equal(filter.accepts("packages/Newtonsoft.Json.13.0.1/lib/x.cs"), false);
  });

  it("applies include globs and basename globs", () => {
    const only = createPathFilter(["*.log"], ["src/**"]);
    assert.equal(only.accepts("src/a.ts"), true);
    assert.equal(only.accepts("test/a.ts"), false);
    assert.equal(only.accepts("src/deep/x.log"), false);
    assert.equal(only.accepts("../outside.ts"), false);
  });
});
