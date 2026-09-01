import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeAsin,
  normalizedInteger,
  parseCount,
  parsePrice,
  parseRating
} from "../src/api/shared";

function setMarketplace(hostname: string) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: new URL(`https://${hostname}/`) }
  });
}

setMarketplace("www.amazon.de");

test("validates and normalizes Amazon ASINs", () => {
  assert.equal(normalizeAsin(" b0product1 "), "B0PRODUCT1");
  assert.equal(normalizeAsin("B0-SHORT"), null);
  assert.equal(normalizeAsin("ABCDEFGHIJK"), null);
});

test("bounds integer inputs without accepting fractions", () => {
  assert.equal(normalizedInteger(25, 10, 1, 20), 20);
  assert.equal(normalizedInteger("3", 10, 1, 20), 3);
  assert.equal(normalizedInteger(2.5, 10, 1, 20), 10);
});

test("parses localized ratings and counts", () => {
  assert.equal(parseRating("4,7 von 5 Sternen"), 4.7);
  assert.equal(parseCount("1,2K ratings"), 1200);
  assert.equal(parseCount("1.234 Bewertungen"), 1234);
  assert.equal(parseCount("2 345 global ratings"), 2345);
});

test("parses localized Amazon prices and currencies", () => {
  assert.deepEqual(parsePrice("€1.299,95"), { display: "€1.299,95", amount: 1299.95, currency: "EUR" });
  setMarketplace("www.amazon.se");
  assert.deepEqual(parsePrice("1 299,00 kr"), { display: "1 299,00 kr", amount: 1299, currency: "SEK" });
  setMarketplace("www.amazon.ca");
  assert.deepEqual(parsePrice("$1,299.00"), { display: "$1,299.00", amount: 1299, currency: "CAD" });
  assert.deepEqual(parsePrice("FREE"), { display: "FREE", amount: 0, currency: null });
});
