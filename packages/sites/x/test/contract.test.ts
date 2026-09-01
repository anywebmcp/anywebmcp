import assert from "node:assert/strict";
import test from "node:test";
import { assertSiteContract, importAndMountSite } from "@openwebmcp/common/test";

test("registers wrapped read and manual-navigation tools", async t => {
  let fetchCalls = 0;
  const harness = await importAndMountSite(
    () => import("../src/index"),
    {
      window: {
        fetch() {
          fetchCalls += 1;
          throw new Error("The contract smoke test must stay offline.");
        }
      }
    }
  );
  t.after(() => harness.dispose());

  assertSiteContract(harness, [
    "x_get_api_status",
    "x_get_posts",
    "x_create_post",
    "x_reply_to_post"
  ]);

  assert.deepEqual(await harness.execute("x_get_api_status"), {
    status: "completed",
    data: {
      capturedOperations: [],
      capturedPostCount: 0,
      hasTransactionId: false
    }
  });

  assert.deepEqual(await harness.execute("x_create_post", { text: "Review before posting" }), {
    status: "navigation_required",
    url: "https://x.com/intent/tweet?text=Review+before+posting",
    instruction: "Open this URL to prepare a post with text \"Review before posting\", then stop for user review. The user must confirm the draft by clicking Post in X manually. Do not click the button or call the tool again to submit. Nothing has been published."
  });
  assert.equal(fetchCalls, 0);
});
