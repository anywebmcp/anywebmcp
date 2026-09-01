import assert from "node:assert/strict";
import test from "node:test";
import { parseToolResult } from "@openwebmcp/common/test";
import { postIntent } from "../src/intents";
import { createPostTool } from "../src/tools/create-post";
import { replyToPostTool } from "../src/tools/reply-to-post";
import { wrapTool } from "@openwebmcp/common";
import { intentFixture } from "./fixtures/x-pages";

test("intent URLs preserve special characters and are repeatable", () => {
  const post = postIntent(intentFixture.text);
  const reply = postIntent(intentFixture.text, intentFixture.postId);
  assert.equal(post.status, "navigation_required");
  assert.equal(reply.status, "navigation_required");
  if (post.status !== "navigation_required" || reply.status !== "navigation_required") return;
  assert.equal(post.url, intentFixture.postUrl);
  assert.equal(reply.url, intentFixture.replyUrl);
  assert.deepEqual(postIntent(intentFixture.text), post);
  assert.deepEqual(postIntent(intentFixture.text, intentFixture.postId), reply);
});

test("intent tools reject invalid inputs without submission side effects", async () => {
  let sideEffects = 0;
  const before = { href: "https://x.com/home" };
  Object.defineProperty(globalThis, "location", { configurable: true, value: before });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { querySelector() { sideEffects += 1; }, createElement() { sideEffects += 1; } }
  });
  try {
    assert.deepEqual(postIntent(" \n "), { status: "failed", message: "Post text cannot be empty." });
    assert.deepEqual(parseToolResult(await wrapTool(replyToPostTool).execute({ postId: "12x", text: "No" })), {
      status: "failed",
      message: "Post ID must contain only digits."
    });
    const result = parseToolResult(await wrapTool(createPostTool).execute({ text: "Draft only" }));
    assert.equal(result.status, "navigation_required");
    assert.equal(before.href, "https://x.com/home");
    assert.equal(sideEffects, 0);
  } finally {
    delete (globalThis as Record<string, unknown>).location;
    delete (globalThis as Record<string, unknown>).document;
  }
});
