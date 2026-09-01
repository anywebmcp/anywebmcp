import { cleanText } from "./parsing";
import { failure, unexpectedFailure } from "./failures";
import { readProduct } from "./read-product";
import type { CompareProductsInput, ProductDetail } from "./types";

export async function compareProducts(input: CompareProductsInput, signal?: AbortSignal) {
  try {
    signal?.throwIfAborted();
    const references = [...new Set((input.products || []).map(product => cleanText(product, 2_000)).filter(Boolean))].slice(0, 8);
    if (references.length < 2) {
      return failure("NOT_ENOUGH_PRODUCTS", "At least two distinct Temu product URLs or known productIds are required.");
    }
    const results: Awaited<ReturnType<typeof readProduct>>[] = [];
    for (let offset = 0; offset < references.length; offset += 2) {
      results.push(...await Promise.all(
        references.slice(offset, offset + 2).map(product => readProduct({ product }, signal))
      ));
      signal?.throwIfAborted();
    }
    const indexedResults = results.map((result, index) => ({ result, reference: references[index] }));
    const products = indexedResults
      .filter((entry): entry is { result: { ok: true; product: ProductDetail }; reference: string } => entry.result.ok)
      .map(entry => entry.result.product);
    const errors = indexedResults
      .filter(entry => !entry.result.ok)
      .map(entry => ({ product: entry.reference, error: "error" in entry.result ? entry.result.error : null }));

    if (products.length < 2) {
      return failure("COMPARISON_INCOMPLETE", "Fewer than two products could be read for comparison.", {
        retryable: true,
        diagnostics: { errors }
      });
    }

    const comparablePrices = products.filter(product => product.displayedPrice?.currency);
    const currencies = new Set(comparablePrices.map(product => product.displayedPrice!.currency));
    const lowestPrice = currencies.size === 1
      ? [...comparablePrices].sort((a, b) => a.displayedPrice!.amount - b.displayedPrice!.amount)[0]
      : null;
    const rated = products.filter(product => product.rating !== null);
    const highestRating = [...rated].sort((a, b) =>
      (b.rating! - a.rating!) || ((b.reviewCount || 0) - (a.reviewCount || 0))
    )[0] || null;

    return {
      ok: true as const,
      products: products.map(product => ({
        productId: product.productId,
        title: product.title,
        url: product.url,
        displayedPrice: product.displayedPrice,
        rating: product.rating,
        reviewCount: product.reviewCount,
        soldText: product.soldText,
        deliveryText: product.deliveryText,
        variantCount: product.variants.length,
        selectedAttributes: product.selectedAttributes,
        completeness: product.completeness,
        warnings: product.warnings
      })),
      highlights: {
        lowestDisplayedPriceProductId: lowestPrice?.productId || null,
        highestRatingProductId: highestRating?.productId || null,
        priceComparisonAvailable: currencies.size === 1 && comparablePrices.length === products.length
      },
      errors
    };
  } catch (error) {
    return unexpectedFailure(error);
  }
}
