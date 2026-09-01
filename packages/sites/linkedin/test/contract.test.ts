import assert from "node:assert/strict";
import test from "node:test";
import { assertSiteContract, importAndMountSite } from "@openwebmcp/common/test";
import { fixture, linkedInDom } from "./support";

test("registers and wraps all five LinkedIn tools without submitting a comment", async t => {
  const dom = linkedInDom(fixture("mounted-posts.html"));
  dom.installGlobals();
  let submitClicks = 0;
  dom.document.querySelector(".submit-comment")?.addEventListener("click", () => { submitClicks += 1; });

  const harness = await importAndMountSite(
    () => import("../src/index"),
    { document: dom.document, window: dom.window }
  );
  t.after(() => harness.dispose());

  assertSiteContract(harness, [
    "linkedin_list_loaded_posts",
    "linkedin_collect_feed_posts",
    "linkedin_read_post",
    "linkedin_ensure_post",
    "linkedin_prepare_comment_draft"
  ]);

  const listed = await harness.execute<{ posts: Array<{ postId: string; truncated: boolean }> }>(
    "linkedin_list_loaded_posts",
    { limit: 3 }
  );
  assert.equal(listed.status, "completed");
  if (listed.status !== "completed") return;
  assert.equal(listed.data.posts.length, 3);
  const postId = listed.data.posts[0].postId;

  const collected = await harness.execute("linkedin_collect_feed_posts", {
    limit: 3,
    maxScrolls: 0
  });
  assert.equal(collected.status, "completed", JSON.stringify(collected));

  const read = await harness.execute<{ source: string }>("linkedin_read_post", { postId });
  assert.equal(read.status, "completed", JSON.stringify(read));
  if (read.status === "completed") assert.equal(read.data.source, "live");

  const unknown = await harness.execute("linkedin_read_post", {
    postId: "urn:li:activity:999999999999999999"
  });
  assert.deepEqual(unknown, {
    status: "failed",
    message: "UNKNOWN_POST_ID: This post ID is not known in the current LinkedIn page session. List or collect feed posts again and use a returned postId."
  });

  const ensured = await harness.execute<{ ensured: boolean }>("linkedin_ensure_post", {
    postId,
    maxScrolls: 1
  });
  assert.equal(ensured.status, "completed", JSON.stringify(ensured));
  if (ensured.status === "completed") assert.equal(ensured.data.ensured, true);

  const prepared = await harness.execute<{
    prepared: boolean;
    submitted: boolean;
    matchesExpected: boolean;
    nextStep: string;
  }>("linkedin_prepare_comment_draft", {
    postId,
    text: "A sanitized draft for manual review"
  });
  assert.equal(prepared.status, "completed", JSON.stringify(prepared));
  if (prepared.status === "completed") {
    assert.equal(prepared.data.prepared, true);
    assert.equal(prepared.data.submitted, false);
    assert.equal(prepared.data.matchesExpected, true);
    assert.match(prepared.data.nextStep, /click LinkedIn's Comment button manually/);
  }
  assert.equal(submitClicks, 0);
});
