import assert from "node:assert/strict";
import test from "node:test";
import { getRenderedPosts, getVisiblePosts } from "../src/dom/posts";
import { pageContext, withPostContext } from "../src/dom/post-context";
import { installBrowserFixture } from "./browser-fixture";
import { conversationFixture, postsFixture } from "./fixtures/x-pages";

test("parses visible posts, nested quotes, replies, previews, and media", t => {
  const browser = installBrowserFixture(postsFixture);
  t.after(() => browser.dispose());

  const rendered = getRenderedPosts();
  assert.equal(rendered.length, 3);
  assert.deepEqual(getVisiblePosts().map(post => post.id), ["100", "101"]);

  const first = rendered[0].post;
  assert.equal(first.author, "Ada Example");
  assert.equal(first.handle, "@ada_example");
  assert.equal(first.text, "Hello :wave: world");
  assert.deepEqual(first.metrics, { replies: 2, reposts: 3, likes: 5, bookmarks: 7, views: 11 });
  assert.deepEqual(first.media, [
    { type: "image", url: "https://pbs.twimg.com/media/photo.jpg", altText: "A safe photo" },
    { type: "gif", previewUrl: "https://pbs.twimg.com/tweet_video_thumb/clip.jpg" }
  ]);
  assert.equal(first.linkPreviews[0]?.url, "https://example.test/story");
  assert.equal(first.quotedPost?.id, "900");
  assert.equal(first.quotedPost?.text, "Nested quote");
  assert.deepEqual(first.quotedPost?.media, [
    { type: "image", url: "https://pbs.twimg.com/media/quoted.jpg", altText: "Quoted image" }
  ]);
  assert.deepEqual(rendered[1].replyingTo, ["@ada_example"]);
});

test("classifies conversation subjects, ancestors, replies, and related posts", t => {
  const browser = installBrowserFixture(conversationFixture, { url: "https://x.com/user200/status/200" });
  t.after(() => browser.dispose());

  const page = pageContext();
  assert.deepEqual(page, {
    url: "https://x.com/user200/status/200",
    kind: "conversation",
    tab: "Posts",
    sort: "Most recent",
    subjectPostId: "200"
  });
  const contextual = withPostContext(getRenderedPosts(), page, new Map());
  assert.deepEqual(contextual.map(item => [item.post.id, item.post.context.role, item.post.context.section]), [
    ["199", "ancestor", "conversation"],
    ["200", "subject", "conversation"],
    ["201", "reply", "conversation"],
    ["202", "related", "related"]
  ]);
});

test("parses supported route contexts", () => {
  const cases = [
    ["https://x.com/home", "home"],
    ["https://x.com/search?q=webmcp", "search"],
    ["https://x.com/explore", "search"],
    ["https://x.com/i/bookmarks", "bookmarks"],
    ["https://x.com/i/lists/123", "list"]
  ] as const;
  for (const [url, kind] of cases) {
    const browser = installBrowserFixture('<main><section data-testid="primaryColumn"></section></main>', { url });
    assert.equal(pageContext().kind, kind, url);
    browser.dispose();
  }
  const profile = installBrowserFixture(
    '<main><section data-testid="primaryColumn"><div role="tab" aria-selected="true">Replies</div></section></main>',
    { url: "https://x.com/example/with_replies" }
  );
  assert.equal(pageContext().kind, "profile");
  assert.equal(pageContext().tab, "Replies");
  profile.dispose();
});
