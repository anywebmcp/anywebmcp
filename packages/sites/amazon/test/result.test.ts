import assert from "node:assert/strict";
import test from "node:test";
import { fromAmazonResult } from "../src/result";

test("adapts successful Amazon data to the shared completed result", () => {
  assert.deepEqual(fromAmazonResult({ ok: true as const, returnedProducts: 0, products: [] }), {
    status: "completed",
    data: { returnedProducts: 0, products: [] }
  });
});

test("adapts expected Amazon blockers to the shared failed result", () => {
  assert.deepEqual(fromAmazonResult({
    ok: false,
    error: "bot_check",
    message: "Amazon returned a bot check."
  }), {
    status: "failed",
    message: "bot_check: Amazon returned a bot check."
  });
});
