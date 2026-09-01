import assert from "node:assert/strict";
import test from "node:test";
import { rememberProduct, resolveProduct } from "../src/api/registry";

test("resolves a bare productId through the known-product registry instead of treating it as a relative URL", () => {
  rememberProduct({
    productId: "601099500000099",
    url: "https://www.temu.com/known-product-g-601099500000099.html",
    title: "Known product",
    imageUrl: null,
    displayedPrice: null,
    referencePrice: null,
    rating: null,
    reviewCount: null,
    soldText: null,
    deliveryText: null,
    sponsored: false,
    source: "live-page",
    observedAt: "2026-09-01T00:00:00.000Z"
  });

  const resolved = resolveProduct("601099500000099");
  assert.equal(resolved.productId, "601099500000099");
  assert.equal(resolved.url, "https://www.temu.com/known-product-g-601099500000099.html");
  assert.equal(resolved.snapshot?.title, "Known product");
});
