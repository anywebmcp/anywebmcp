import { cleanText, normalizeTemuUrl, productIdFromUrl } from "./parsing";
import type { ProductSource, ProductSummary } from "./types";

const MAX_REGISTRY_SIZE = 300;
const products = new Map<string, ProductSummary>();

export function rememberProduct(product: ProductSummary) {
  products.delete(product.productId);
  products.set(product.productId, product);
  while (products.size > MAX_REGISTRY_SIZE) {
    const oldest = products.keys().next().value;
    if (!oldest) break;
    products.delete(oldest);
  }
  return product;
}

export function resolveProduct(product: string) {
  const value = cleanText(product, 2_000);
  const directUrl = normalizeTemuUrl(value);
  const productId = productIdFromUrl(directUrl) || value.match(/^\d{6,}$/)?.[0] || "";
  const snapshot = products.get(productId);
  const url = directUrl || snapshot?.url || "";
  return { value, productId, url, snapshot };
}

export function emptyProductSummary(productId: string, url: string, source: ProductSource): ProductSummary {
  return {
    productId,
    url,
    title: "Untitled Temu product",
    imageUrl: null,
    displayedPrice: null,
    referencePrice: null,
    rating: null,
    reviewCount: null,
    soldText: null,
    deliveryText: null,
    sponsored: false,
    source,
    observedAt: new Date().toISOString()
  };
}
