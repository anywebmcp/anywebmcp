import assert from "node:assert/strict";
import test from "node:test";
import temuSite from "../src/index";

test("registers the three read-only first-stage tools", () => {
  assert.deepEqual(
    temuSite.tools.map(tool => tool.name),
    ["temu_search_products", "temu_read_product", "temu_compare_products"]
  );
  assert.equal(temuSite.matches.includes("https://www.temu.com/*"), true);
  for (const tool of temuSite.tools) {
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.untrustedContentHint, true);
  }
});
