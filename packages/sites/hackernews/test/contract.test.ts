import assert from "node:assert/strict";
import test from "node:test";
import { assertSiteContract, importAndMountSite } from "@anywebmcp/common/test";
import { createDirectFetchHackerNewsTransport } from "../src/transport/direct";
import { setHackerNewsTransport } from "../src/transport/state";
import {
  launchSearchHit,
  researchCommentHit,
  researchFirebaseItem,
  researchStoryHit,
  searchResponse,
  threadItem
} from "./fixtures/api-responses";

const TOOL_NAMES = [
  "hackernews_market_digest",
  "hackernews_research_topic",
  "hackernews_read_thread"
] as const;

function jsonResponse(value: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    ...init
  });
}

async function withHarness(
  fetch: typeof window.fetch,
  run: (harness: Awaited<ReturnType<typeof importAndMountSite>>) => Promise<void>
) {
  setHackerNewsTransport(createDirectFetchHackerNewsTransport(fetch));
  const harness = await importAndMountSite(
    () => import("../src/index"),
    { window: {} }
  );
  try {
    await run(harness);
  } finally {
    harness.dispose();
    setHackerNewsTransport(undefined);
  }
}

test("registers and executes all three wrapped tools offline", async () => {
  const requestedUrls: string[] = [];
  const fetch: typeof window.fetch = async input => {
    const url = new URL(String(input));
    requestedUrls.push(url.toString());

    if (url.hostname === "hacker-news.firebaseio.com") {
      assert.equal(url.pathname, "/v0/item/202.json");
      return jsonResponse(researchFirebaseItem);
    }
    if (url.pathname === "/api/v1/items/101") return jsonResponse(threadItem);
    if (url.pathname === "/api/v1/search_by_date") {
      return jsonResponse(searchResponse(
        url.searchParams.get("query") === "Show HN" ? [launchSearchHit] : []
      ));
    }
    if (url.pathname === "/api/v1/search") {
      return jsonResponse(searchResponse(
        url.searchParams.get("tags") === "story" ? [researchStoryHit] : [researchCommentHit]
      ));
    }
    throw new Error(`Unexpected fixture request: ${url}`);
  };

  await withHarness(fetch, async harness => {
    assertSiteContract(harness, TOOL_NAMES);
    assert.deepEqual(requestedUrls, [], "Importing and mounting must not start API requests.");
    for (const name of TOOL_NAMES) {
      assert.equal(harness.tool(name).annotations?.readOnlyHint, true);
      assert.equal(harness.tool(name).annotations?.untrustedContentHint, true);
    }

    const digest = await harness.execute<{ launches: Array<{ id: number }> }>(
      "hackernews_market_digest",
      { periodDays: 7, limit: 1, commentPreviewCount: 1 }
    );
    assert.equal(digest.status, "completed");
    assert.deepEqual(digest.data.launches.map(launch => launch.id), [101]);

    const research = await harness.execute<{ topThreads: Array<{ id: number }> }>(
      "hackernews_research_topic",
      { topic: "local-first", maxThreads: 1, maxEvidenceComments: 1 }
    );
    assert.equal(research.status, "completed");
    assert.deepEqual(research.data.topThreads.map(thread => thread.id), [202]);

    const thread = await harness.execute<{
      story: { id: number };
      comments: Array<{ id: number }>;
    }>("hackernews_read_thread", { id: 101, maxComments: 5, maxDepth: 3 });
    assert.equal(thread.status, "completed");
    assert.equal(thread.data.story.id, 101);
    assert.deepEqual(thread.data.comments.map(comment => comment.id), [102]);
  });

  assert.ok(requestedUrls.length > 0);
});

test("wraps HTTP failures as a safe public failure", async () => {
  const fetch: typeof window.fetch = async () => jsonResponse(
    { privateDiagnostic: "must not escape" },
    { status: 503, statusText: "fixture-secret" }
  );

  await withHarness(fetch, async harness => {
    assert.deepEqual(await harness.execute("hackernews_read_thread", { id: 101 }), {
      status: "failed",
      message: "Hacker News data is temporarily unavailable. Please try again."
    });
  });
});

test("rejects malformed API responses through the wrapped contract", async () => {
  const fetch: typeof window.fetch = async () => jsonResponse({ unexpected: true });

  await withHarness(fetch, async harness => {
    assert.deepEqual(await harness.execute("hackernews_market_digest"), {
      status: "failed",
      message: "Hacker News returned an unexpected data response. Please try again."
    });
  });
});

test("reports a missing thread item without throwing through the wrapper", async () => {
  const fetch: typeof window.fetch = async () => jsonResponse(null);

  await withHarness(fetch, async harness => {
    assert.deepEqual(await harness.execute("hackernews_read_thread", { id: 999_999_999 }), {
      status: "failed",
      message: "Hacker News item 999999999 was not found."
    });
  });
});

test("reports an actionable failure when no extension transport is installed", async () => {
  setHackerNewsTransport(undefined);
  const harness = await importAndMountSite(() => import("../src/index"));
  try {
    assert.deepEqual(await harness.execute("hackernews_read_thread", { id: 101 }), {
      status: "failed",
      message: "Hacker News extension transport is unavailable. Reload the Hacker News page with the AnyWeb MCP extension enabled."
    });
  } finally {
    harness.dispose();
  }
});
