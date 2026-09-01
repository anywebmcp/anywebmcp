import type { ProductSource, ProductSummary } from "../api/types";
import { domProducts } from "./product-cards";
import { structuredProducts } from "./structured-data";

export function allProducts(doc: Document, source: ProductSource) {
  const products = new Map<string, ProductSummary>();
  for (const product of [...domProducts(doc, source), ...structuredProducts(doc)]) {
    const previous = products.get(product.productId);
    if (!previous || (!previous.displayedPrice && product.displayedPrice)) products.set(product.productId, product);
  }
  return [...products.values()];
}
