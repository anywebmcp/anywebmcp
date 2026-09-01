import assert from "node:assert/strict";
import test from "node:test";
import { assertSiteContract, importAndMountSite } from "@anywebmcp/common/test";
import { DOMParser } from "linkedom";
import { fixture, fixtureDocument, htmlResponse, origin } from "./support";

test("registers and executes all five eBay tools through workflow result envelopes", async t => {
  const previousDOMParser = Object.getOwnPropertyDescriptor(globalThis, "DOMParser");
  const previousCSS = Object.getOwnPropertyDescriptor(globalThis, "CSS");
  const previousFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "DOMParser", { configurable: true, value: DOMParser });
  Object.defineProperty(globalThis, "CSS", {
    configurable: true,
    value: { escape: (value: unknown) => String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&") }
  });

  const documentRoot = fixtureDocument("search.html");
  const control = documentRoot.querySelector<HTMLElement>("[data-listingid='406995727358'] .s-card__watchheart-click");
  assert.ok(control);
  control.addEventListener("click", event => {
    event.preventDefault();
    control.setAttribute("aria-label", "Remove from watchlist");
    control.setAttribute("href", "/myb/WatchListRemove?item=406995727358");
  });

  const fixtureFetch = async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/sch/i.html" || url.pathname === "/mye/myebay/watchlist") {
      return htmlResponse(fixture("search.html"), url.href);
    }
    if (url.pathname.startsWith("/itm/")) {
      return htmlResponse(fixture("item-json-ld.html"), url.href);
    }
    throw new Error(`Unexpected eBay fixture URL: ${url.href}`);
  };
  globalThis.fetch = fixtureFetch;

  const harness = await importAndMountSite(
    () => import("../src/index"),
    {
      document: documentRoot,
      window: {
        location: {
          hostname: "www.ebay.com",
          origin,
          href: `${origin}/sch/i.html?_nkw=thinkpad`
        },
        fetch: fixtureFetch
      }
    }
  );
  t.after(() => {
    harness.dispose();
    globalThis.fetch = previousFetch;
    if (previousDOMParser) Object.defineProperty(globalThis, "DOMParser", previousDOMParser);
    else delete (globalThis as { DOMParser?: unknown }).DOMParser;
    if (previousCSS) Object.defineProperty(globalThis, "CSS", previousCSS);
    else delete (globalThis as { CSS?: unknown }).CSS;
  });

  const names = [
    "ebay_search_items",
    "ebay_read_item",
    "ebay_read_items",
    "ebay_get_watchlist",
    "ebay_set_watch_state"
  ];
  assertSiteContract(harness, names);

  for (const name of names.slice(0, 4)) {
    assert.equal(harness.tool(name).annotations?.readOnlyHint, true);
    assert.equal(harness.tool(name).annotations?.untrustedContentHint, true);
  }
  assert.equal(harness.tool("ebay_set_watch_state").annotations?.readOnlyHint, false);
  assert.equal(harness.tool("ebay_set_watch_state").annotations?.untrustedContentHint, false);

  const search = await harness.execute("ebay_search_items", { query: "thinkpad", limit: 1 });
  assert.equal(search.status, "completed");
  if (search.status === "completed") assert.equal((search.data as { count: number }).count, 1);

  const item = await harness.execute("ebay_read_item", { item: "318568379111" });
  assert.equal(item.status, "completed");
  if (item.status === "completed") assert.equal((item.data as { itemId: string }).itemId, "318568379111");

  const items = await harness.execute("ebay_read_items", { items: ["318568379111"] });
  assert.equal(items.status, "completed");
  if (items.status === "completed") assert.equal((items.data as { succeeded: number }).succeeded, 1);

  const watchlist = await harness.execute("ebay_get_watchlist", { limit: 1 });
  assert.equal(watchlist.status, "completed");
  if (watchlist.status === "completed") assert.equal((watchlist.data as { count: number }).count, 1);

  assert.deepEqual(await harness.execute("ebay_set_watch_state", {
    itemId: "406995727358",
    watched: true
  }), {
    status: "completed",
    data: {
      itemId: "406995727358",
      watched: true,
      changed: true,
      verified: true
    }
  });
});
