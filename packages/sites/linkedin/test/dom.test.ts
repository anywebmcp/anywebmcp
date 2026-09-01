import assert from "node:assert/strict";
import test from "node:test";
import {
  collectFeedPosts,
  ensurePost,
  listLoadedPosts,
  prepareCommentDraft,
  readPost
} from "../src/api/dom";
import { fixture, linkedInDom } from "./support";

function useDom(dom: ReturnType<typeof linkedInDom>) {
  dom.installGlobals();
  Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
  Object.defineProperty(globalThis, "window", { configurable: true, value: dom.window });
}

test("parses mounted posts and preserves URN, canonical URL, and fingerprint identities", async () => {
  const dom = linkedInDom(fixture("mounted-posts.html"));
  useDom(dom);

  const result = listLoadedPosts({ limit: 10 });
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.equal(result.totalLoaded, 3);
  assert.equal(result.posts[0].postId, "urn:li:activity:100000000000000001");
  assert.equal(result.posts[0].url, "https://www.linkedin.com/feed/update/urn:li:activity:100000000000000001/");
  assert.equal(result.posts[0].truncated, true);
  assert.equal(result.posts[1].postId, "url:https://www.linkedin.com/posts/example-labs_sanitized-update-activity-200000000000000002-abcd");
  assert.equal(result.posts[1].stability, "canonical");
  assert.match(result.posts[2].postId, /^fp:v1:/);
  assert.equal(result.posts[2].stability, "fingerprint");

  const full = await readPost(result.posts[0].postId);
  assert.equal(full.ok, true);
  if (full.ok) {
    assert.equal(full.source, "live");
    assert.equal(full.post.truncated, false);
    assert.ok(full.post.text.length > result.posts[0].text.length);
  }
});

test("bounds the in-page post registry and evicts its oldest identities", async () => {
  const posts = Array.from({ length: 205 }, (_, index) => {
    const id = String(600000000000000000n + BigInt(index));
    return `<article role="listitem" data-urn="urn:li:activity:${id}"><span data-view-name="feed-actor-name">Registry Author ${index}</span><div componentkey="feed-commentary_${index}">Sanitized registry fixture post number ${index} has enough deterministic text to pass the parser threshold.</div></article>`;
  }).join("");
  const dom = linkedInDom(`<!doctype html><html><body><main><section data-testid="mainFeed">${posts}</section></main></body></html>`);
  useDom(dom);

  const listed = listLoadedPosts({ limit: 25 });
  assert.equal(listed.ok, true);
  if (!listed.ok) return;
  assert.equal(listed.totalLoaded, 205);
  for (const root of dom.document.querySelectorAll("[role='listitem']")) root.remove();

  const evicted = await readPost("urn:li:activity:600000000000000000");
  assert.equal(evicted.ok, false);
  if (!evicted.ok) assert.equal(evicted.error.code, "UNKNOWN_POST_ID");
  const retained = await readPost("urn:li:activity:600000000000000204");
  assert.equal(retained.ok, true);
  if (retained.ok) assert.equal(retained.source, "registry");
});

test("collects in the window scroll container and restores its original position", async () => {
  const dom = linkedInDom(fixture("mounted-posts.html"));
  useDom(dom);
  const original = dom.windowScrollPosition();

  const result = await collectFeedPosts({ limit: 4, maxScrolls: 1, restorePosition: true });
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.equal(result.scrollContainer, "window");
  assert.equal(result.scrollsPerformed, 1);
  assert.equal(result.restoredScrollPosition, true);
  assert.equal(dom.windowScrollPosition(), original);
});

test("collects in an element scroll container and restores its original position", async () => {
  const dom = linkedInDom(fixture("mounted-posts.html"), { elementScroll: true });
  useDom(dom);
  const original = dom.elementScrollPosition();

  const result = await collectFeedPosts({ limit: 4, maxScrolls: 1, restorePosition: true });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.scrollContainer, "main");
  assert.equal(result.scrollsPerformed, 1);
  assert.equal(result.restoredScrollPosition, true);
  assert.equal(dom.elementScrollPosition(), original);
});

test("recovers a previously registered post after LinkedIn unmounts it", async () => {
  const postHtml = fixture("virtualized-post.html");
  let remount: (() => void) | null = null;
  const dom = linkedInDom(`<!doctype html><html><body><main><section data-testid="mainFeed">${postHtml}</section></main></body></html>`, {
    onWindowScroll() { remount?.(); }
  });
  useDom(dom);
  const listed = listLoadedPosts();
  assert.equal(listed.ok, true);
  if (!listed.ok) return;
  const postId = listed.posts[0].postId;
  const root = dom.document.querySelector<HTMLElement>("[role='listitem']")!;
  root.remove();
  remount = () => {
    if (!root.isConnected) dom.document.querySelector("[data-testid='mainFeed']")?.append(root);
  };

  const registryRead = await readPost(postId);
  assert.equal(registryRead.ok, true);
  if (registryRead.ok) {
    assert.equal(registryRead.source, "registry");
    assert.equal(registryRead.post.mounted, false);
  }

  const recovered = await ensurePost(postId, 2);
  assert.equal(recovered.ok, true);
  if (recovered.ok) {
    assert.equal(recovered.recovered, true);
    assert.equal(recovered.mounted, true);
    assert.ok(recovered.scrollsPerformed <= 2);
  }

  remount = null;
  root.remove();
  const boundedFailure = await ensurePost(postId, 0);
  assert.equal(boundedFailure.ok, false);
  if (!boundedFailure.ok) {
    assert.equal(boundedFailure.error.code, "POST_NOT_MOUNTED");
    assert.equal(boundedFailure.error.diagnostics.scrollsPerformed, 0);
  }
});

test("opens an empty comment editor, inserts a verified draft, and never submits", async () => {
  const dom = linkedInDom(fixture("comment-editor.html"));
  useDom(dom);
  const listed = listLoadedPosts();
  assert.equal(listed.ok, true);
  if (!listed.ok) return;
  let submitClicks = 0;
  const openButton = dom.document.querySelector<HTMLButtonElement>("[data-view-name='feed-comment-button']")!;
  openButton.addEventListener("click", () => {
    const host = dom.document.querySelector<HTMLElement>("[data-editor-host]")!;
    host.innerHTML = `<div class="comments-comment-box__form"><div contenteditable="true" role="textbox"></div><button class="submit-comment">Comment</button></div>`;
    const editor = host.querySelector<HTMLElement>("[contenteditable='true']")!;
    dom.activateEditor(editor);
    host.querySelector(".submit-comment")?.addEventListener("click", () => { submitClicks += 1; });
  });

  const result = await prepareCommentDraft(listed.posts[0].postId, "Verified fixture draft");
  assert.equal(result.ok, true, JSON.stringify(result));
  if (result.ok) {
    assert.equal(result.prepared, true);
    assert.equal(result.submitted, false);
    assert.equal(result.text, "Verified fixture draft");
    assert.equal(result.matchesExpected, true);
  }
  assert.equal(submitClicks, 0);
});

test("refuses to overwrite a conflicting existing draft", async () => {
  const dom = linkedInDom(fixture("conflicting-draft.html"));
  useDom(dom);
  const listed = listLoadedPosts();
  assert.equal(listed.ok, true);
  if (!listed.ok) return;
  const editor = dom.document.querySelector<HTMLElement>("[contenteditable='true']")!;
  dom.activateEditor(editor);

  const result = await prepareCommentDraft(listed.posts[0].postId, "Replacement draft");
  assert.equal(result.ok, false, JSON.stringify(result));
  if (!result.ok) assert.equal(result.error.code, "EDITOR_NOT_EMPTY");
  assert.equal(editor.innerText, "Keep this existing draft");
});

test("keeps signed-out, inaccessible, invalid-draft, and unknown-post outcomes bounded", async () => {
  const dom = linkedInDom(fixture("signed-out.html"));
  useDom(dom);

  const listed = listLoadedPosts();
  assert.equal(listed.ok, true);
  if (listed.ok) assert.deepEqual(listed.posts, []);

  const unknown = await readPost("urn:li:activity:999999999999999999");
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.error.code, "UNKNOWN_POST_ID");

  const invalid = await prepareCommentDraft("urn:li:activity:999999999999999999", "   ");
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, "INVALID_DRAFT");
});

test("converts unexpected DOM failures to a safe site-specific result", () => {
  const dom = linkedInDom(fixture("mounted-posts.html"));
  useDom(dom);
  Object.assign(dom.document, {
    querySelectorAll() { throw new Error("sanitized internal selector failure"); }
  });

  const result = listLoadedPosts();
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "UNEXPECTED_ERROR");
    assert.equal(result.error.retryable, true);
    assert.equal(result.error.diagnostics.detail, "sanitized internal selector failure");
  }
});
