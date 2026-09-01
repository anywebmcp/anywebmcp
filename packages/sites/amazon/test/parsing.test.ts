import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { DOMParser } from "linkedom";
import { parseBuyingOptionsDocument } from "../src/api/buying-options";
import { parseProductDocument } from "../src/api/product";
import { parseReviewSummaryDocument } from "../src/api/review-summary";
import { parseEmbeddedReviews, readReviews } from "../src/api/reviews";
import { parseSearchDocument, searchProducts } from "../src/api/search";
import { fetchAmazonDocument } from "../src/api/shared";

const location = new URL("https://www.amazon.de/dp/B0PRODUCT1");
Object.defineProperty(globalThis, "window", { configurable: true, value: { location } });
Object.defineProperty(globalThis, "DOMParser", { configurable: true, value: DOMParser });

async function fixture(name: string) {
  return readFile(path.join(process.cwd(), "test", "fixtures", name), "utf8");
}

async function fixtureDocument(name: string) {
  return new DOMParser().parseFromString(await fixture(name), "text/html") as unknown as Document;
}

async function withFetchResponse<T>(
  html: string,
  url: string,
  callback: () => Promise<T>,
  onRequest?: (input: unknown, init?: RequestInit) => void
) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (input: unknown, init?: RequestInit) => {
      onRequest?.(input, init);
      return {
        ok: true,
        status: 200,
        url,
        async text() { return html; }
      };
    }
  });
  try {
    return await callback();
  } finally {
    if (previous) Object.defineProperty(globalThis, "fetch", previous);
    else delete (globalThis as { fetch?: unknown }).fetch;
  }
}

test("parses and deduplicates representative search cards", async () => {
  const result = parseSearchDocument(await fixtureDocument("search.html"), 10);
  assert.equal(result.observedProductCards, 4);
  assert.equal(result.products.length, 2);
  assert.deepEqual(result.products[0], {
    asin: "B0SEARCH01",
    title: "Compact USB-C Hub",
    url: "https://www.amazon.de/dp/B0SEARCH01",
    imageUrl: "https://images.example.test/hub.jpg",
    price: { display: "19,99 €", amount: 19.99, currency: "EUR" },
    rating: 4.6,
    reviewCount: 1200,
    sponsored: false,
    badge: null,
    delivery: "FREE delivery Tomorrow"
  });
  assert.equal(result.products[1].sponsored, true);
  assert.equal(result.products[1].price?.amount, 1299);
});

test("returns a successful empty search result", async () => {
  const html = "<!doctype html><html><head><title>No matches</title></head><body></body></html>";
  let requestedUrl = "";
  let credentials: RequestCredentials | undefined;
  const result = await withFetchResponse(
    html,
    "https://www.amazon.de/s?k=no+matches",
    () => searchProducts({ query: "no matches", limit: 5 }),
    (input, init) => {
      requestedUrl = String(input);
      credentials = init?.credentials;
    }
  );
  assert.equal(result.ok, true);
  assert.equal(requestedUrl, "https://www.amazon.de/s?k=no+matches");
  assert.equal(credentials, "include");
  if (result.ok) {
    assert.equal(result.observedProductCards, 0);
    assert.deepEqual(result.products, []);
  }
});

test("parses product details, terms, specifications, and variants", async () => {
  const product = parseProductDocument(await fixtureDocument("product.html"), "B0PRODUCT1");
  assert.ok(product);
  assert.equal(product.title, "OpenWeb USB-C Hub");
  assert.equal(product.brand, "OpenWeb");
  assert.deepEqual(product.price, { display: "€49,95", amount: 49.95, currency: "EUR" });
  assert.equal(product.reviewCount, 1234);
  assert.deepEqual(product.features, ["Seven useful ports", "Aluminum enclosure"]);
  assert.equal(product.specifications["Number of Ports"], "7");
  assert.equal(product.specifications["Model number"], "OW-HUB-7");
  assert.deepEqual(product.variants.map(variant => variant.asin), ["B0PRODUCT1", "B0PRODUCT2"]);
  assert.equal(product.variants[0].selected, true);
});

test("parses and sorts buying options by displayed item-plus-shipping total", async () => {
  const options = parseBuyingOptionsDocument(await fixtureDocument("offers.html"));
  assert.equal(options.length, 2);
  assert.equal(options[0].condition, "Used - Very Good");
  assert.deepEqual(options[0].estimatedTotal, { display: "EUR 21.00", amount: 21, currency: "EUR" });
  assert.equal(options[0].sellerType, "third_party");
  assert.equal(options[0].sellerRatingCount, 2345);
  assert.equal(options[1].sellerType, "amazon");
  assert.equal(options[1].fulfilledByAmazon, true);
});

test("parses embedded reviews and applies filters and bounded sorting", async () => {
  const html = await fixture("reviews.html");
  const reviews = parseEmbeddedReviews(new DOMParser().parseFromString(html, "text/html") as unknown as Document);
  assert.equal(reviews.length, 3);
  assert.equal(reviews[0].helpfulVotes, 1200);
  assert.equal(reviews[1].verifiedPurchase, false);

  const result = await withFetchResponse(html, "https://www.amazon.de/dp/B0PRODUCT1", () =>
    readReviews({ asin: "B0PRODUCT1", query: "working", sort: "recent", limit: 2 })
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.matchingReviews, 1);
    assert.equal(result.reviews[0].id, "R2");
  }
});

test("parses Amazon review insights, defects, histogram, and variant evidence", async () => {
  const summary = parseReviewSummaryDocument(await fixtureDocument("review-summary.html"));
  assert.equal(summary.rating, 4.3);
  assert.equal(summary.reviewCount, 2345);
  assert.equal(summary.ratingHistogramPercent["5"], 70);
  assert.equal(summary.frequentPros[0].name, "charging-speed");
  assert.equal(summary.recurringDefects[0].name, "durability");
  assert.equal(summary.variantDifferences.length, 2);
  assert.equal(summary.amazonGeneratedSummaryAvailable, true);
});

test("reports CAPTCHA and sign-in responses as explicit failures", async () => {
  const captcha = await withFetchResponse(
    await fixture("captcha.html"),
    "https://www.amazon.de/errors/validateCaptcha",
    () => fetchAmazonDocument("/dp/B0PRODUCT1")
  );
  assert.equal(captcha.ok, false);
  if (!captcha.ok) assert.equal(captcha.error, "bot_check");

  const signIn = await withFetchResponse(
    await fixture("sign-in.html"),
    "https://www.amazon.de/ap/signin?openid.return_to=%2Fdp%2FB0PRODUCT1",
    () => fetchAmazonDocument("/dp/B0PRODUCT1")
  );
  assert.equal(signIn.ok, false);
  if (!signIn.ok) assert.equal(signIn.error, "sign_in_required");
});
