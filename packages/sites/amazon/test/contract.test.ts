import assert from "node:assert/strict";
import test from "node:test";
import { assertSiteContract, importAndMountSite } from "@anywebmcp/common/test";

const toolNames = [
  "amazon_search_products",
  "amazon_get_product",
  "amazon_get_buying_options",
  "amazon_read_reviews",
  "amazon_get_review_summary",
  "amazon_compare_products"
] as const;

test("registers all six wrapped read-only Amazon tools", async t => {
  const harness = await importAndMountSite(() => import("../src/index"));
  t.after(() => harness.dispose());

  assertSiteContract(harness, toolNames);
  assert.equal(harness.site.matches.length, 23);
  for (const { tool } of harness.registrations) {
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.untrustedContentHint, true);
  }

  const invalidInputs: Record<(typeof toolNames)[number], Record<string, unknown>> = {
    amazon_search_products: { query: "" },
    amazon_get_product: { asin: "bad" },
    amazon_get_buying_options: { asin: "bad" },
    amazon_read_reviews: { asin: "bad" },
    amazon_get_review_summary: { asin: "bad" },
    amazon_compare_products: { asins: ["bad"] }
  };
  for (const name of toolNames) {
    const result = await harness.execute(name, invalidInputs[name]);
    assert.equal(result.status, "failed", `${name} must return a wrapped failure envelope`);
  }
});
