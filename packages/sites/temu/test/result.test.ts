import assert from "node:assert/strict";
import test from "node:test";
import { fromTemuResult } from "../src/result";

test("adapts successful Temu reads to the shared completed result", () => {
  assert.deepEqual(fromTemuResult({ ok: true as const, count: 2, products: ["a", "b"] }), {
    status: "completed",
    data: { count: 2, products: ["a", "b"] }
  });
});

test("requests navigation when fetched search HTML has no rendered products", () => {
  assert.deepEqual(fromTemuResult({
    ok: false,
    error: {
      code: "NO_SERVER_RENDERED_RESULTS",
      message: "No products were rendered.",
      diagnostics: { url: "https://www.temu.com/search_result.html?search_key=usb+c+hub" }
    }
  }), {
    status: "navigation_required",
    url: "https://www.temu.com/search_result.html?search_key=usb+c+hub",
    instruction: "Open the Temu search-results page, wait for product cards to render, then call temu_search_products again without query."
  });
});

test("requests navigation when a fetched product page cannot be verified", () => {
  assert.deepEqual(fromTemuResult({
    ok: false,
    error: {
      code: "PRODUCT_PAGE_NOT_READABLE",
      message: "No product details were rendered.",
      diagnostics: { url: "https://www.temu.com/example-g-601099500000001.html" }
    }
  }), {
    status: "navigation_required",
    url: "https://www.temu.com/example-g-601099500000001.html",
    instruction: "Open this Temu product page, wait for its title and price to render, then call temu_read_product again with the same product URL or productId."
  });
});

test("adapts expected blockers to the shared failed result", () => {
  assert.deepEqual(fromTemuResult({
    ok: false,
    error: {
      code: "AUTHENTICATION_REQUIRED",
      message: "Temu requires sign-in.",
      suggestedAction: "Sign in and retry.",
      diagnostics: { url: "https://www.temu.com/login.html" }
    }
  }), {
    status: "failed",
    message: "AUTHENTICATION_REQUIRED: Temu requires sign-in. Sign in and retry. Temu URL: https://www.temu.com/login.html"
  });
});
