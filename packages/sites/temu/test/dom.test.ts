import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseHTML } from "linkedom";
import { collectLiveSearchProducts } from "../src/api/live-search";
import { detailFromDocument } from "../src/dom/product-detail";
import { allProducts } from "../src/dom/products";

async function fixture(name: string) {
  return readFile(`${process.cwd()}/test/fixtures/${name}`, "utf8");
}

function installPage(window: Window & typeof globalThis, document: Document, href: string) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(href)
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: window });
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  return () => {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete (globalThis as { window?: Window }).window;
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
    else delete (globalThis as { document?: Document }).document;
  };
}

test("extracts and merges representative search card and structured product data", async t => {
  const { document, window } = parseHTML(await fixture("search-results.html"));
  t.after(installPage(window, document, "https://www.temu.com/search_result.html?search_key=usb+c+hub"));

  const products = allProducts(document, "live-page");
  assert.equal(products.length, 2);

  const card = products.find(product => product.productId === "601099500000001");
  assert.equal(card?.title, "Aluminum USB-C Hub");
  assert.deepEqual(card?.displayedPrice, { amount: 19.48, currency: "USD", formatted: "$19.48" });
  assert.deepEqual(card?.referencePrice, { amount: 29.99, currency: "USD", formatted: "$29.99" });
  assert.equal(card?.rating, 4.8);
  assert.equal(card?.reviewCount, 1200);
  assert.equal(card?.soldText, "2.3K+ sold");
  assert.equal(card?.deliveryText, "Delivery in 5 days");

  const structured = products.find(product => product.productId === "601099500000002");
  assert.equal(structured?.source, "structured-data");
  assert.equal(structured?.displayedPrice?.amount, 24);
});

test("extracts detail fields, SKU variants, and live selection from a product fixture", async t => {
  const { document, window } = parseHTML(await fixture("product-detail.html"));
  t.after(installPage(window, document, "https://www.temu.com/aluminum-hub-g-601099500000001.html"));

  const reference = allProducts(document, "live-page")[0];
  assert.ok(reference);
  const product = detailFromDocument(document, reference, "live-page");

  assert.equal(product.productId, "601099500000001");
  assert.equal(product.completeness, "detail");
  assert.equal(product.sellerName, "Example Accessories Store");
  assert.equal(product.description, "Seven-port hub with HDMI, USB, and card-reader ports.");
  assert.equal(product.deliveryText, "Delivery in 5 days");
  assert.deepEqual(product.selectedAttributes, { Color: "Silver" });
  assert.deepEqual(product.variants, [
    {
      skuId: "700000000001",
      attributes: { Color: "Silver" },
      price: { amount: 19.48, currency: "USD", formatted: "19.48 USD" },
      inStock: true
    },
    {
      skuId: "700000000002",
      attributes: { Color: "Gray" },
      price: { amount: 21, currency: "USD", formatted: "21 USD" },
      inStock: false
    }
  ]);
  assert.deepEqual(product.warnings, []);
});

test("restores the live search position when collection is cancelled during a bounded scroll", async t => {
  const { document, window } = parseHTML(await fixture("search-results.html"));
  t.after(installPage(window, document, "https://www.temu.com/search_result.html?search_key=usb+c+hub"));

  let scrollY = 120;
  let timeoutId = 0;
  Object.defineProperties(window, {
    innerHeight: { configurable: true, value: 900 },
    scrollY: { configurable: true, get: () => scrollY },
    scrollBy: {
      configurable: true,
      value: ({ top }: { top: number }) => { scrollY += top; }
    },
    scrollTo: {
      configurable: true,
      value: ({ top }: { top: number }) => { scrollY = top; }
    },
    setTimeout: {
      configurable: true,
      value: () => ++timeoutId
    },
    clearTimeout: {
      configurable: true,
      value: () => {}
    }
  });

  const controller = new AbortController();
  const reason = new Error("cancelled while scrolling");
  const collection = collectLiveSearchProducts(3, 1, true, controller.signal);
  controller.abort(reason);

  await assert.rejects(() => collection, error => error === reason);
  assert.equal(scrollY, 120);
});
