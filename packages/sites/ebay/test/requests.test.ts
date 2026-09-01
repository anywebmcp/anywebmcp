import assert from "node:assert/strict";
import test from "node:test";
import { readItem, readItems } from "../src/api/item";
import { searchItems, searchUrl } from "../src/api/search";
import { getWatchlist } from "../src/api/watchlist";
import { fixture, fixtureDocument, htmlResponse, installDom, origin } from "./support";

installDom();

test("builds bounded regional search requests with the documented filters", () => {
  const url = searchUrl({
    query: " thinkpad ",
    page: 2,
    minPrice: 100,
    maxPrice: 800,
    condition: ["refurbished", "used", "refurbished"],
    buyingFormat: "buy_it_now",
    freeShipping: true,
    sort: "price_lowest"
  });

  assert.equal(url.origin, origin);
  assert.equal(url.pathname, "/sch/i.html");
  assert.equal(url.searchParams.get("_nkw"), "thinkpad");
  assert.equal(url.searchParams.get("_pgn"), "2");
  assert.equal(url.searchParams.get("_udlo"), "100");
  assert.equal(url.searchParams.get("_udhi"), "800");
  assert.equal(url.searchParams.get("LH_ItemCondition"), "2000|2500|3000");
  assert.equal(url.searchParams.get("LH_BIN"), "1");
  assert.equal(url.searchParams.get("LH_FS"), "1");
  assert.equal(url.searchParams.get("_sop"), "15");
});

test("reports eBay security challenges instead of returning an empty search", async t => {
  const previousFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = previousFetch; });
  globalThis.fetch = async () => htmlResponse(
    fixture("challenge.html"),
    `${origin}/splashui/challenge?ap=fixture`
  );

  await assert.rejects(() => searchItems({ query: "thinkpad", limit: 5 }), /security challenge/i);
});

test("rejects signed-out watchlist reads before fetching", async t => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const previousFetch = globalThis.fetch;
  let fetchCalls = 0;
  t.after(() => {
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
    else delete (globalThis as { document?: unknown }).document;
    globalThis.fetch = previousFetch;
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: fixtureDocument("watchlist-signed-out.html")
  });
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("signed-out watchlist reads must stay offline");
  };

  await assert.rejects(() => getWatchlist({ limit: 5 }), /signed-in eBay session/i);
  assert.equal(fetchCalls, 0);
});

test("rejects a watchlist request redirected to eBay sign-in", async t => {
  const previousFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = previousFetch; });
  globalThis.fetch = async () => htmlResponse(
    fixture("watchlist-signed-out.html"),
    "https://signin.ebay.com/ws/eBayISAPI.dll?SignIn"
  );

  await assert.rejects(() => getWatchlist({ limit: 5 }), /signed-in eBay session/i);
});

test("refuses cross-region item requests before fetching", async t => {
  const previousFetch = globalThis.fetch;
  let fetchCalls = 0;
  t.after(() => { globalThis.fetch = previousFetch; });
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("cross-region requests must stay offline");
  };

  await assert.rejects(
    () => readItem({ item: "https://www.ebay.de/itm/318568379111" }),
    /can only read https:\/\/www\.ebay\.com/i
  );
  assert.equal(fetchCalls, 0);
});

test("reads item batches with concurrency capped at three", async t => {
  const previousFetch = globalThis.fetch;
  let active = 0;
  let maximumActive = 0;
  let fetchCalls = 0;
  t.after(() => { globalThis.fetch = previousFetch; });
  globalThis.fetch = async input => {
    fetchCalls += 1;
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise(resolve => setTimeout(resolve, 0));
    active -= 1;
    return htmlResponse(fixture("item-json-ld.html"), String(input));
  };

  const result = await readItems({
    items: ["318568379111", "318568379112", "318568379113", "318568379114"]
  });
  assert.equal(fetchCalls, 4);
  assert.equal(maximumActive, 3);
  assert.deepEqual(
    { requested: result.requested, succeeded: result.succeeded, failed: result.failed },
    { requested: 4, succeeded: 4, failed: 0 }
  );
});
