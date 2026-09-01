import assert from "node:assert/strict";
import test from "node:test";
import { fromProductHuntResult } from "../src/result";

test("adapts an explicit Product Hunt success without exposing its internal discriminator", () => {
  assert.deepEqual(fromProductHuntResult({ ok: true, count: 1, products: ["alpha"] }), {
    status: "completed",
    data: { count: 1, products: ["alpha"] }
  });
});

test("adapts an explicit Product Hunt failure", () => {
  assert.deepEqual(fromProductHuntResult({ ok: false, error: "Product Hunt is unavailable." }), {
    status: "failed",
    message: "Product Hunt is unavailable."
  });
});

test("never treats malformed adapter output as completed", () => {
  for (const malformed of [
    null,
    [],
    {},
    { count: 1 },
    { ok: false },
    { ok: false, error: "" },
    { ok: true, error: "conflicting outcome" }
  ]) {
    assert.deepEqual(fromProductHuntResult(malformed), {
      status: "failed",
      message: "Product Hunt returned a malformed result."
    });
  }
});
