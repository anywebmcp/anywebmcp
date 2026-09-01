import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertSiteContract, importAndMountSite } from "@anywebmcp/common/test";
import { DOMParser, parseHTML } from "linkedom";

async function fixture(name: string) {
  return readFile(`${process.cwd()}/test/fixtures/${name}`, "utf8");
}

test("registers and executes all three Temu read-only tool contracts", async t => {
  const searchHtml = await fixture("search-results.html");
  const productHtml = await fixture("product-detail.html");
  const { document } = parseHTML(searchHtml);
  const previousDomParser = Object.getOwnPropertyDescriptor(globalThis, "DOMParser");
  const previousFetch = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  Object.defineProperty(globalThis, "DOMParser", { configurable: true, value: DOMParser });
  const fixtureFetch = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("search_result.html")) {
      return {
        ok: true,
        status: 200,
        url,
        async text() { return "<!doctype html><html><body><main></main></body></html>"; }
      };
    }
    const second = url.includes("601099500000002");
    const html = second
      ? productHtml
        .replaceAll("601099500000001", "601099500000002")
        .replaceAll("Aluminum USB-C Hub", "Compact USB-C Hub")
        .replaceAll("19.48", "24.00")
        .replaceAll("4.8", "4.6")
      : productHtml;
    return {
      ok: true,
      status: 200,
      url,
      async text() { return html; }
    };
  };
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: fixtureFetch });
  t.after(() => {
    if (previousDomParser) Object.defineProperty(globalThis, "DOMParser", previousDomParser);
    else delete (globalThis as { DOMParser?: typeof DOMParser }).DOMParser;
    if (previousFetch) Object.defineProperty(globalThis, "fetch", previousFetch);
    else delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  let scrollY = 0;
  const location = {
    href: "https://www.temu.com/search_result.html?search_key=usb+c+hub",
    origin: "https://www.temu.com",
    protocol: "https:",
    host: "www.temu.com"
  };
  const harness = await importAndMountSite(
    () => import("../src/index"),
    {
      document,
      window: {
        location,
        innerHeight: 900,
        get scrollY() { return scrollY; },
        scrollBy({ top }: { top: number }) { scrollY += top; },
        scrollTo({ top }: { top: number }) { scrollY = top; },
        fetch: fixtureFetch
      }
    }
  );
  t.after(() => harness.dispose());

  assertSiteContract(harness, [
    "temu_search_products",
    "temu_read_product",
    "temu_compare_products"
  ]);
  for (const { tool } of harness.registrations) {
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.untrustedContentHint, true);
  }

  const search = await harness.execute<{
    count: number;
    products: Array<{ productId: string }>;
  }>("temu_search_products", { limit: 2, maxScrolls: 0 });
  assert.equal(search.status, "completed");
  assert.equal(search.status === "completed" && search.data.count, 2);

  const read = await harness.execute<{
    product: { productId: string; completeness: string; variants: unknown[] };
  }>("temu_read_product", { product: "601099500000001" });
  assert.equal(read.status, "completed");
  if (read.status === "completed") {
    assert.equal(read.data.product.productId, "601099500000001");
    assert.equal(read.data.product.completeness, "detail");
    assert.equal(read.data.product.variants.length, 2);
  }

  const comparison = await harness.execute<{
    products: Array<{ productId: string }>;
    highlights: { lowestDisplayedPriceProductId: string | null; priceComparisonAvailable: boolean };
  }>("temu_compare_products", {
    products: ["601099500000001", "601099500000002"]
  });
  assert.equal(comparison.status, "completed");
  if (comparison.status === "completed") {
    assert.deepEqual(comparison.data.products.map(product => product.productId), [
      "601099500000001",
      "601099500000002"
    ]);
    assert.equal(comparison.data.highlights.lowestDisplayedPriceProductId, "601099500000001");
    assert.equal(comparison.data.highlights.priceComparisonAvailable, true);
  }

  assert.deepEqual(await harness.execute("temu_search_products", { query: "mechanical keyboard" }), {
    status: "navigation_required",
    url: "https://www.temu.com/search_result.html?search_key=mechanical+keyboard",
    instruction: "Open the Temu search-results page, wait for product cards to render, then call temu_search_products again without query."
  });

  const controller = new AbortController();
  const reason = new Error("Temu contract test cancelled");
  controller.abort(reason);
  await assert.rejects(
    () => harness.execute("temu_compare_products", {
      products: ["601099500000001", "601099500000002"]
    }, { signal: controller.signal }),
    error => error === reason
  );
});
