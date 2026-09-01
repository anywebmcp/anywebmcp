import { detailFromDocument } from "../dom/product-detail";
import { failure, unexpectedFailure } from "./failures";
import { fetchDocument } from "./fetch-document";
import { isAuthenticationRequired, isSecurityVerification, productIdFromUrl } from "./parsing";
import { emptyProductSummary, resolveProduct } from "./registry";
import type { ProductDetail, ReadProductInput } from "./types";

function snapshotDetail(snapshot: ReturnType<typeof resolveProduct>["snapshot"], warning: string): ProductDetail {
  return {
    ...snapshot!,
    variants: [],
    selectedAttributes: {},
    sellerName: null,
    description: null,
    source: "search-snapshot",
    completeness: "summary",
    warnings: [warning]
  };
}

export async function readProduct(input: ReadProductInput, signal?: AbortSignal) {
  try {
    signal?.throwIfAborted();
    const reference = resolveProduct(input.product);
    if (!reference.productId || !reference.url) {
      return failure("UNKNOWN_PRODUCT", "The product must be a Temu product URL or a productId returned by temu_search_products.", {
        diagnostics: { product: reference.value },
        suggestedAction: "Call temu_search_products first or pass a canonical Temu product URL."
      });
    }

    const currentId = productIdFromUrl(window.location.href);
    if (currentId === reference.productId &&
      !isSecurityVerification(document.body?.innerText, window.location.href) &&
      !isAuthenticationRequired(document.body?.innerText, window.location.href)) {
      const fallback = reference.snapshot || emptyProductSummary(reference.productId, reference.url, "live-page");
      return { ok: true as const, product: detailFromDocument(document, fallback, "live-page") };
    }

    const fetched = await fetchDocument(reference.url, signal);
    if (fetched.verification) {
      if (reference.snapshot) {
        return {
          ok: true as const,
          product: snapshotDetail(
            reference.snapshot,
            "Temu required security verification for the detail page; returning the known search snapshot."
          )
        };
      }
      return failure("SECURITY_VERIFICATION_REQUIRED", "Temu requires an interactive security verification before this product can be read.", {
        retryable: true,
        diagnostics: { productId: reference.productId, url: reference.url },
        suggestedAction: "Open the product page, complete the verification manually, and retry."
      });
    }
    if (fetched.authenticationRequired) {
      if (reference.snapshot) {
        return {
          ok: true as const,
          product: snapshotDetail(
            reference.snapshot,
            "Temu redirected the detail request to sign in; returning the known search snapshot."
          )
        };
      }
      return failure("AUTHENTICATION_REQUIRED", "Temu requires this browser session to sign in before showing the product.", {
        retryable: true,
        diagnostics: { productId: reference.productId, url: fetched.url },
        suggestedAction: "Sign in to Temu in this browser session, open the product page, and retry."
      });
    }
    const fallback = reference.snapshot || emptyProductSummary(reference.productId, reference.url, "fetched-page");
    return { ok: true as const, product: detailFromDocument(fetched.doc, fallback, "fetched-page") };
  } catch (error) {
    return unexpectedFailure(error);
  }
}
