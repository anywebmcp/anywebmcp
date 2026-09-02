import assert from "node:assert/strict";
import test from "node:test";
import { installHackerNewsBridge } from "../../../extension/src/hackernews-bridge";
import {
  handleHackerNewsBackgroundRequest,
  type HackerNewsBackgroundDependencies
} from "../src/transport/background";
import { createHackerNewsExtensionTransport } from "../src/transport/page";
import {
  HACKER_NEWS_BACKGROUND_REQUEST,
  HACKER_NEWS_ORIGIN,
  HACKER_NEWS_PAGE_REQUEST,
  type HackerNewsBackgroundRequest
} from "../src/transport/protocol";

function request(
  operation: HackerNewsBackgroundRequest["operation"],
  parameters: HackerNewsBackgroundRequest["parameters"]
) {
  return {
    type: HACKER_NEWS_BACKGROUND_REQUEST,
    requestId: `request_${operation}`,
    operation,
    parameters
  };
}

const sender = { origin: HACKER_NEWS_ORIGIN, url: `${HACKER_NEWS_ORIGIN}/news` };

test("background transport constructs only the three allowed Hacker News requests", async () => {
  const seen: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fixtures = [
    { hits: [], nbHits: 0 },
    { id: 123, children: [] },
    { id: 123, type: "story" }
  ];
  const dependencies: HackerNewsBackgroundDependencies = {
    fetch: async (input, init) => {
      seen.push({ url: String(input), init });
      return new Response(JSON.stringify(fixtures[seen.length - 1]));
    }
  };

  const results = await Promise.all([
    handleHackerNewsBackgroundRequest(request("algoliaSearch", {
      query: "local-first",
      tag: "story",
      from: 100,
      to: 200,
      hitsPerPage: 3,
      page: 0,
      sort: "date"
    }), sender, dependencies),
    handleHackerNewsBackgroundRequest(request("algoliaItem", { id: 123 }), sender, dependencies),
    handleHackerNewsBackgroundRequest(request("firebaseItem", { id: 123 }), sender, dependencies)
  ]);

  assert.ok(results.every(result => result.ok));
  assert.equal(seen[0].url, "https://hn.algolia.com/api/v1/search_by_date?query=local-first&tags=story&numericFilters=created_at_i%3E%3D100%2Ccreated_at_i%3C200&hitsPerPage=3&page=0");
  assert.equal(seen[1].url, "https://hn.algolia.com/api/v1/items/123");
  assert.equal(seen[2].url, "https://hacker-news.firebaseio.com/v0/item/123.json");
  for (const call of seen) {
    assert.equal(call.init?.credentials, "omit");
    assert.deepEqual(call.init?.headers, { accept: "application/json" });
  }
});

test("background transport rejects unknown operations, arbitrary URLs, invalid parameters, and non-HN senders", async () => {
  let fetches = 0;
  const dependencies = { fetch: async () => {
    fetches += 1;
    return new Response("null");
  } };
  const invalid = [
    { ...request("algoliaItem", { id: 1 }), operation: "fetch", parameters: { url: "https://example.com/private" } },
    { ...request("algoliaItem", { id: 1 }), parameters: { id: 1, url: "https://example.com" } },
    request("algoliaItem", { id: 0 }),
    request("algoliaSearch", {
      query: "x".repeat(201), tag: "story", from: 1, to: 2, hitsPerPage: 100, page: 0, sort: "date"
    })
  ];

  for (const message of invalid) {
    assert.deepEqual(
      await handleHackerNewsBackgroundRequest(message, sender, dependencies),
      { ok: false, code: "invalid_request" }
    );
  }
  assert.deepEqual(
    await handleHackerNewsBackgroundRequest(request("algoliaItem", { id: 1 }), {
      origin: "https://example.com"
    }, dependencies),
    { ok: false, code: "invalid_request" }
  );
  assert.equal(fetches, 0);
});

test("background transport trusts the sender document URL when the optional origin is opaque", async () => {
  const result = await handleHackerNewsBackgroundRequest(
    request("algoliaItem", { id: 123 }),
    {
      origin: "null",
      url: `${HACKER_NEWS_ORIGIN}/item?id=123`,
      tab: { url: `${HACKER_NEWS_ORIGIN}/item?id=123` }
    },
    { fetch: async () => new Response(JSON.stringify({ id: 123, children: [] })) }
  );

  assert.deepEqual(result, { ok: true, value: { id: 123, children: [] } });
});

test("background transport returns bounded HTTP, malformed-response, and timeout failures", async () => {
  const itemRequest = request("algoliaItem", { id: 123 });
  assert.deepEqual(await handleHackerNewsBackgroundRequest(itemRequest, sender, {
    fetch: async () => new Response("upstream detail", { status: 503 })
  }), { ok: false, code: "http" });

  assert.deepEqual(await handleHackerNewsBackgroundRequest(itemRequest, sender, {
    fetch: async () => new Response("not json")
  }), { ok: false, code: "malformed_response" });

  assert.deepEqual(await handleHackerNewsBackgroundRequest(itemRequest, sender, {
    fetch: async () => new Response(JSON.stringify({ unrelated: true }))
  }), { ok: false, code: "malformed_response" });

  assert.deepEqual(await handleHackerNewsBackgroundRequest(itemRequest, sender, {
    maxResponseBytes: 4,
    fetch: async () => new Response(JSON.stringify({ id: 123 }))
  }), { ok: false, code: "malformed_response" });

  assert.deepEqual(await handleHackerNewsBackgroundRequest(itemRequest, sender, {
    fetch: async () => { throw new Error("private network detail"); }
  }), { ok: false, code: "network" });

  assert.deepEqual(await handleHackerNewsBackgroundRequest(itemRequest, sender, {
    timeoutMs: 5,
    fetch: async (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })
  }), { ok: false, code: "timeout" });
});

test("background transport invokes worker APIs with the worker global as their receiver", async () => {
  const itemRequest = request("algoliaItem", { id: 123 });
  let fetchReceiver: unknown;
  let setTimeoutReceiver: unknown;
  let clearTimeoutReceiver: unknown;
  const setTimeout = function (this: unknown) {
    setTimeoutReceiver = this;
    return 1;
  } as unknown as typeof globalThis.setTimeout;
  const clearTimeout = function (this: unknown) {
    clearTimeoutReceiver = this;
  } as unknown as typeof globalThis.clearTimeout;

  const result = await handleHackerNewsBackgroundRequest(itemRequest, sender, {
    setTimeout,
    clearTimeout,
    fetch: async function () {
      fetchReceiver = this;
      return new Response(JSON.stringify({ id: 123, children: [] }));
    }
  });

  assert.equal(fetchReceiver, globalThis);
  assert.equal(setTimeoutReceiver, globalThis);
  assert.equal(clearTimeoutReceiver, globalThis);
  assert.deepEqual(result, { ok: true, value: { id: 123, children: [] } });
});

type Listener = (event: MessageEvent) => void;

class FakeWindow {
  readonly crypto = globalThis.crypto;
  private readonly listeners = new Set<Listener>();

  addEventListener(type: string, listener: EventListener) {
    if (type === "message") this.listeners.add(listener as Listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    if (type === "message") this.listeners.delete(listener as Listener);
  }

  postMessage(data: unknown, targetOrigin: string) {
    assert.equal(targetOrigin, HACKER_NEWS_ORIGIN);
    queueMicrotask(() => {
      const event = { data, source: this, origin: HACKER_NEWS_ORIGIN } as unknown as MessageEvent;
      for (const listener of [...this.listeners]) listener(event);
    });
  }

  setTimeout(handler: TimerHandler, timeout?: number) {
    return globalThis.setTimeout(handler, timeout) as unknown as number;
  }

  clearTimeout(id: number) {
    globalThis.clearTimeout(id);
  }
}

test("page and isolated-world bridge correlate concurrent responses", async () => {
  const target = new FakeWindow();
  const pending = new Map<string, (value: unknown) => void>();
  const disposeBridge = installHackerNewsBridge(target as unknown as Window, {
    sendMessage(message) {
      const typed = message as HackerNewsBackgroundRequest;
      if (typed.operation === "probe") return Promise.resolve({ ok: true, value: null });
      return new Promise(resolve => pending.set(typed.requestId, resolve));
    }
  });
  const transport = createHackerNewsExtensionTransport(target as unknown as Window);

  const first = transport.request({ operation: "algoliaItem", parameters: { id: 1 } });
  const second = transport.request({ operation: "firebaseItem", parameters: { id: 2 } });
  while (pending.size < 2) await new Promise(resolve => setTimeout(resolve, 0));
  const ids = [...pending.keys()];
  pending.get(ids[1])?.({ ok: true, value: { id: 2 } });
  pending.get(ids[0])?.({ ok: true, value: { id: 1 } });

  assert.deepEqual(await first, { id: 1 });
  assert.deepEqual(await second, { id: 2 });
  transport.dispose();
  disposeBridge();
});

test("isolated bridge rejects an arbitrary-URL request without contacting the background", async () => {
  const target = new FakeWindow();
  let runtimeCalls = 0;
  const dispose = installHackerNewsBridge(target as unknown as Window, {
    async sendMessage() {
      runtimeCalls += 1;
      return { ok: true, value: null };
    }
  });
  const response = new Promise<unknown>(resolve => {
    target.addEventListener("message", ((event: MessageEvent) => {
      if ((event.data as { type?: unknown }).type !== HACKER_NEWS_PAGE_REQUEST) resolve(event.data);
    }) as EventListener);
  });
  target.postMessage({
    type: HACKER_NEWS_PAGE_REQUEST,
    requestId: "arbitrary_url",
    operation: "fetch",
    parameters: { url: "https://example.com/private" }
  }, HACKER_NEWS_ORIGIN);

  assert.deepEqual(await response, {
    type: "anywebmcp:hackernews:page-response",
    requestId: "arbitrary_url",
    ok: false,
    code: "invalid_request"
  });
  assert.equal(runtimeCalls, 0);
  dispose();
});
