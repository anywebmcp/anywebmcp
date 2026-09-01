import type { ProductSummary } from "./types";
import { domProducts } from "../dom/product-cards";
import { allProducts } from "../dom/products";

function delay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted();
    const timeout = window.setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    const abort = () => {
      window.clearTimeout(timeout);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function collectLiveSearchProducts(
  limit: number,
  maxScrolls: number,
  restorePosition: boolean,
  signal?: AbortSignal
) {
  const originalY = window.scrollY;
  let shouldRestore = restorePosition;
  try {
    const products = new Map<string, ProductSummary>();
    const collect = (includeStructured = false) => {
      const found = includeStructured
        ? allProducts(document, "live-page")
        : domProducts(document, "live-page");
      for (const product of found) {
        if (!products.has(product.productId)) products.set(product.productId, product);
      }
    };

    collect(true);
    let scrolls = 0;
    while (products.size < limit && scrolls < maxScrolls) {
      const before = window.scrollY;
      window.scrollBy({ top: Math.max(500, Math.round(window.innerHeight * 0.85)), behavior: "auto" });
      await delay(700, signal);
      collect();
      scrolls += 1;
      if (window.scrollY === before) break;
    }
    if (restorePosition && window.scrollY !== originalY) {
      window.scrollTo({ top: originalY, behavior: "auto" });
      await delay(100, signal);
    }
    shouldRestore = false;
    return { products: [...products.values()].slice(0, limit), scrolls };
  } finally {
    if (shouldRestore && window.scrollY !== originalY) {
      window.scrollTo({ top: originalY, behavior: "auto" });
    }
  }
}
