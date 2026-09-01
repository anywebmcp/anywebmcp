import assert from "node:assert/strict";
import test from "node:test";
import { readPosts } from "../src/dom/read-posts";
import { installBrowserFixture } from "./browser-fixture";
import { postCard, virtualizedBatches } from "./fixtures/x-pages";

const page = (cards: string[]) => `<main><section data-testid="primaryColumn">${cards.join("")}</section></main>`;

test("supports visible, batch, and next reads across virtualized batches", async t => {
  const browser = installBrowserFixture(page(virtualizedBatches[0]), {
    url: "https://x.com/home?fixture=virtualized",
    batches: virtualizedBatches
  });
  t.after(() => browser.dispose());

  const visible = await readPosts({ mode: "visible" });
  assert.deepEqual(visible.posts.map(post => post.id), ["301", "302"]);
  assert.equal(visible.stopReason, "viewport");
  assert.equal(visible.scrollsPerformed, 0);

  const batch = await readPosts({ mode: "batch", limit: 3 });
  assert.deepEqual(batch.posts.map(post => post.id), ["301", "302", "303"]);
  assert.equal(batch.lastPostId, "303");
  assert.equal(batch.stopReason, "limit");
  assert.equal(batch.scrollsPerformed, 1);

  const next = await readPosts({ mode: "next", afterPostId: "303", limit: 2 });
  assert.deepEqual(next.posts.map(post => post.id), ["304", "305"]);
  assert.equal(next.lastPostId, "305");
  assert.equal(next.stopReason, "limit");
});

test("filters identified replies after deduplication", async t => {
  const cards = [
    postCard({ id: "401", top: 20 }),
    postCard({ id: "402", top: 220, replyingTo: "@user401" }),
    postCard({ id: "403", top: 420, replyingTo: "@user401" })
  ];
  const browser = installBrowserFixture(page(cards), { url: "https://x.com/home?fixture=replies", stall: true });
  t.after(() => browser.dispose());
  const result = await readPosts({ mode: "visible", filter: "replies" });
  assert.deepEqual(result.posts.map(post => post.id), ["402", "403"]);
});

test("reports a stalled feed without claiming exhaustion", async t => {
  const browser = installBrowserFixture(page([postCard({ id: "501", top: 20 })]), {
    url: "https://x.com/home?fixture=stall",
    stall: true
  });
  t.after(() => browser.dispose());
  const result = await readPosts({ mode: "batch", limit: 5 });
  assert.equal(result.stopReason, "stalled");
  assert.equal(result.scrollsPerformed, 3);
  assert.deepEqual(result.posts.map(post => post.id), ["501"]);
});

test("rejects unknown anchors and invalid input", async t => {
  const browser = installBrowserFixture(page([postCard({ id: "601", top: 20 })]), {
    url: "https://x.com/home?fixture=invalid"
  });
  t.after(() => browser.dispose());
  await assert.rejects(
    readPosts({ mode: "next", afterPostId: "999", limit: 2 }),
    /must be a post returned on this page/
  );
  await assert.rejects(readPosts({ mode: "batch", limit: 0 }), /between 1 and 100/);
  await assert.rejects(readPosts({ mode: "visible", afterPostId: "601" }), /must be omitted/);
});

test("preserves cancellation and overlapping-read safeguards", async t => {
  const browser = installBrowserFixture(page([postCard({ id: "701", top: 20 })]), {
    url: "https://x.com/home?fixture=guards",
    stall: true,
    immediateTimers: false
  });
  t.after(() => browser.dispose());

  const controller = new AbortController();
  const running = readPosts({ mode: "batch", limit: 2 }, controller.signal);
  await assert.rejects(readPosts({ mode: "batch", limit: 2 }), /Another post read is still running/);
  controller.abort(new Error("fixture cancelled"));
  await assert.rejects(running, /fixture cancelled/);
});
