import assert from "node:assert/strict";
import test from "node:test";
import { parseItemPage } from "../src/api/item";
import { parseSearchDocument } from "../src/api/search";
import { fixtureDocument, installDom } from "./support";

installDom();

test("parses a sanitized eBay search card into a bounded listing summary", () => {
  const items = parseSearchDocument(fixtureDocument("search.html"), 10);
  assert.equal(items.length, 1, "duplicate and placeholder cards must be discarded");

  const [item] = items;
  assert.equal(item.itemId, "406995727358");
  assert.equal(item.url, "https://www.ebay.com/itm/406995727358");
  assert.equal(item.title, "ThinkPad X1 Carbon");
  assert.deepEqual(item.price, { amount: 346.39, currency: "USD", display: "$346.39" });
  assert.equal(item.shipping?.amount, 27.79);
  assert.equal(item.total?.amount, 374.18);
  assert.equal(item.buyingFormat, "buy_it_now");
  assert.equal(item.seller, "fixture-seller");
  assert.equal(item.location, "Germany");
  assert.equal(item.watching, false);
});

test("prefers schema.org product data and supplements it with visible item details", () => {
  const item = parseItemPage(fixtureDocument("item-json-ld.html"), {
    itemId: "318568379111",
    url: "https://www.ebay.com/itm/318568379111"
  });

  assert.equal(item.title, 'ThinkPad X1 Carbon Gen 10 "Executive"');
  assert.equal(item.price?.amount, 599);
  assert.equal(item.availability, "InStock");
  assert.equal(item.condition, "Used");
  assert.deepEqual(item.seller, { name: "fixture-seller", feedback: "98.3% positive" });
  assert.equal(item.itemSpecifics.Processor, "Intel Core i7-1260P");
  assert.equal(item.itemSpecifics["RAM Size"], "16 GB");
  assert.match(item.shipping ?? "", /Free shipping/);
  assert.match(item.returns ?? "", /30-day returns/);
  assert.equal(item.watching, false);
});
