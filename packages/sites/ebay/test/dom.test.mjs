import assert from "node:assert/strict";
import test from "node:test";
import { DOMParser } from "linkedom";
import { getWatchlist, parseItemPage, parseSearchDocument, searchItems } from "../src/api/dom.ts";

globalThis.window = {
  location: {
    hostname: "www.ebay.com",
    origin: "https://www.ebay.com",
    href: "https://www.ebay.com/sch/i.html?_nkw=thinkpad"
  }
};
globalThis.DOMParser = DOMParser;
globalThis.document = new DOMParser().parseFromString("<html></html>", "text/html");
globalThis.CSS = { escape: value => String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&") };

test("parses a current eBay search card into a bounded listing summary", () => {
  const documentRoot = new DOMParser().parseFromString(`
    <html><body><ul>
      <li class="s-card" data-listingid="406995727358">
        <a class="s-card__link" href="https://www.ebay.com/itm/406995727358?tracking=1">
          <h3 class="s-card__title">ThinkPad X1 Carbon Opens in a new window or tab</h3>
        </a>
        <img src="https://i.ebayimg.com/item.webp" alt="ThinkPad X1 Carbon">
        <span class="s-card__subtitle">Very Good - Refurbished · Lenovo</span>
        <div class="s-card__attribute-row s-card__price">$346.39</div>
        <div class="s-card__attribute-row">Buy It Now</div>
        <div class="s-card__attribute-row">+$27.79 delivery</div>
        <div class="s-card__attribute-row">Located in Germany</div>
        <div class="s-card__attribute-row">udoshop 100% positive (3K)</div>
        <span class="s-card__watchheart s-card__watchheart--watch">
          <a class="s-card__watchheart-click" aria-label="watch ThinkPad X1 Carbon" href="/myb/WatchListAdd?item=406995727358"></a>
        </span>
      </li>
    </ul></body></html>
  `, "text/html");

  const [item] = parseSearchDocument(documentRoot, 10);
  assert.equal(item.itemId, "406995727358");
  assert.equal(item.url, "https://www.ebay.com/itm/406995727358");
  assert.equal(item.title, "ThinkPad X1 Carbon");
  assert.deepEqual(item.price, { amount: 346.39, currency: "USD", display: "$346.39" });
  assert.equal(item.shipping.amount, 27.79);
  assert.equal(item.total.amount, 374.18);
  assert.equal(item.buyingFormat, "buy_it_now");
  assert.equal(item.seller, "udoshop");
  assert.equal(item.location, "Germany");
  assert.equal(item.watching, false);
});

test("prefers schema.org product data and supplements it with visible item details", () => {
  const documentRoot = new DOMParser().parseFromString(`
    <html><head>
      <meta name="description" content="A compact business laptop.">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"ThinkPad X1 Carbon Gen 10 &#034;Executive&#034;",
        "image":[{"url":"https://i.ebayimg.com/item.jpg"}],
        "offers":{"@type":"Offer","price":"599.0","priceCurrency":"USD","availability":"https://schema.org/InStock"},
        "itemCondition":"https://schema.org/UsedCondition"
      }</script>
    </head><body><main>
      <h1>Fallback title</h1>
      <a href="https://www.ebay.com/help/selling/seller-levels-performance-standards/top-rated-program?id=4164">Learn more- Top Rated Plus</a>
      <a href="https://www.ebay.com/sch/xgeni0/m.html">xgeni0</a>
      <button>98.3% positive</button>
      <button>Buy It Now</button>
      <dl>
        <dt>Processor</dt><dd>Intel Core i7-1260P</dd>
        <dt>RAM Size</dt><dd>16 GB</dd>
      </dl>
      <section><span>Shipping:</span><p>Free shipping</p></section>
      <button aria-label="Add to watchlist">Add to watchlist</button>
    </main></body></html>
  `, "text/html");

  const item = parseItemPage(documentRoot, {
    itemId: "318568379111",
    url: "https://www.ebay.com/itm/318568379111"
  });
  assert.equal(item.title, 'ThinkPad X1 Carbon Gen 10 "Executive"');
  assert.equal(item.price.amount, 599);
  assert.equal(item.availability, "InStock");
  assert.equal(item.condition, "Used");
  assert.deepEqual(item.seller, { name: "xgeni0", feedback: "98.3% positive" });
  assert.equal(item.itemSpecifics.Processor, "Intel Core i7-1260P");
  assert.equal(item.itemSpecifics["RAM Size"], "16 GB");
  assert.match(item.shipping, /Free shipping/);
  assert.equal(item.watching, false);
});

test("reports eBay security challenges instead of returning an empty search", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    url: "https://www.ebay.com/splashui/challenge?ap=1",
    async text() {
      return "<!doctype html><html><head><title>Security Measure | eBay</title></head><body>Verify you are human</body></html>";
    }
  });
  await assert.rejects(
    () => searchItems({ query: "thinkpad", limit: 5 }),
    /security challenge/i
  );
  globalThis.fetch = previousFetch;
});

test("rejects watchlist reads before fetching when the page is signed out", async () => {
  const previousDocument = globalThis.document;
  globalThis.document = new DOMParser().parseFromString(`
    <!doctype html><html><body><header role="banner">
      <a href="https://signin.ebay.com/ws/eBayISAPI.dll?SignIn&sgfl=gh">Sign in</a>
    </header></body></html>
  `, "text/html");
  await assert.rejects(
    () => getWatchlist({ limit: 5 }),
    /signed-in eBay session/i
  );
  globalThis.document = previousDocument;
});
