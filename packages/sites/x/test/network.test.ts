import assert from "node:assert/strict";
import test from "node:test";
import { getCapturedPosts, getNetworkStatus, installNetworkCapture } from "../src/api/network";

test("capture is installed explicitly once and observes GraphQL traffic", async t => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let nativeCalls = 0;
  const payload = {
    data: {
      result: {
        __typename: "Tweet",
        rest_id: "700",
        legacy: { full_text: "Captured post", reply_count: 1, retweet_count: 2, favorite_count: 3, bookmark_count: 4 },
        core: { user_results: { result: { core: { name: "Network User", screen_name: "network_user" } } } }
      }
    }
  };
  const response = {
    url: "https://x.com/i/api/graphql/hash/HomeTimeline",
    clone() { return this; },
    async json() { return payload; }
  } as unknown as Response;
  const fixtureWindow = {
    async fetch(_input?: RequestInfo | URL) {
      nativeCalls += 1;
      return response;
    }
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: fixtureWindow });
  t.after(() => previousWindow
    ? Object.defineProperty(globalThis, "window", previousWindow)
    : delete (globalThis as Record<string, unknown>).window);

  installNetworkCapture();
  const installedFetch = fixtureWindow.fetch;
  installNetworkCapture();
  assert.equal(fixtureWindow.fetch, installedFetch, "repeated initialization must not wrap fetch twice");

  const request = new Request("https://x.com/i/api/graphql/hash/HomeTimeline", {
    headers: { "x-client-transaction-id": "sanitized-transaction" }
  });
  assert.equal(await fixtureWindow.fetch(request), response);
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(nativeCalls, 1);
  assert.deepEqual(getNetworkStatus(), {
    capturedOperations: ["HomeTimeline"],
    capturedPostCount: 1,
    hasTransactionId: true
  });
  assert.deepEqual(getCapturedPosts(1)[0], {
    id: "700",
    url: "https://x.com/network_user/status/700",
    author: "Network User",
    handle: "@network_user",
    text: "Captured post",
    createdAt: null,
    metrics: { replies: 1, reposts: 2, likes: 3, bookmarks: 4 }
  });
});
