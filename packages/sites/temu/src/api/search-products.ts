import { allProducts } from "../dom/products";
import { failure, unexpectedFailure } from "./failures";
import { fetchDocument } from "./fetch-document";
import { collectLiveSearchProducts } from "./live-search";
import {
  cleanText,
  currentSearchQuery,
  isAuthenticationRequired,
  isSecurityVerification,
  searchUrl
} from "./parsing";
import type { SearchProductsInput } from "./types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_SCROLLS = 8;

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

export async function searchProducts(input: SearchProductsInput = {}, signal?: AbortSignal) {
  try {
    signal?.throwIfAborted();
    const query = cleanText(input.query, 300);
    const limit = boundedInteger(input.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
    const maxScrolls = boundedInteger(input.maxScrolls, 4, 0, MAX_SCROLLS);
    const restorePosition = input.restorePosition !== false;
    const loadedQuery = currentSearchQuery();

    if (isSecurityVerification(document.body?.innerText, window.location.href)) {
      return failure("SECURITY_VERIFICATION_REQUIRED", "The current Temu page is showing an interactive security verification.", {
        retryable: true,
        diagnostics: { url: window.location.href },
        suggestedAction: "Complete the verification manually and retry the tool."
      });
    }
    if (isAuthenticationRequired(document.body?.innerText, window.location.href)) {
      return failure("AUTHENTICATION_REQUIRED", "Temu redirected this browser session to sign in before showing search results.", {
        retryable: true,
        diagnostics: { url: window.location.href },
        suggestedAction: "Sign in to Temu in this browser session, reopen the search-results page, and retry."
      });
    }

    if (query && query.toLocaleLowerCase() !== loadedQuery.toLocaleLowerCase()) {
      const fetched = await fetchDocument(searchUrl(query), signal);
      if (fetched.verification) {
        return failure("SECURITY_VERIFICATION_REQUIRED", "Temu requires an interactive security verification before search results can be read.", {
          retryable: true,
          diagnostics: { query, url: fetched.url },
          suggestedAction: "Open the Temu search page, complete the verification manually, and retry the tool."
        });
      }
      if (fetched.authenticationRequired) {
        return failure("AUTHENTICATION_REQUIRED", "Temu requires this browser session to sign in before showing search results.", {
          retryable: true,
          diagnostics: { query, url: fetched.url },
          suggestedAction: "Sign in to Temu in this browser session and retry the tool."
        });
      }
      const products = allProducts(fetched.doc, "fetched-page").slice(0, limit);
      if (!products.length) {
        return failure("NO_SERVER_RENDERED_RESULTS", "The fetched Temu search page did not contain readable product results.", {
          retryable: true,
          diagnostics: { query, url: fetched.url },
          suggestedAction: "Open this Temu search in the browser, wait for results to render, and call the tool without query."
        });
      }
      return { ok: true as const, query, collection: "fetched-page", products, count: products.length };
    }

    const result = await collectLiveSearchProducts(limit, maxScrolls, restorePosition, signal);
    if (!result.products.length) {
      return failure("NO_PRODUCTS_FOUND", "No readable Temu product cards were found on the current page.", {
        retryable: true,
        diagnostics: { url: window.location.href, loadedQuery },
        suggestedAction: "Open a Temu search-results page, wait for product cards to appear, and retry."
      });
    }
    return {
      ok: true as const,
      query: query || loadedQuery || null,
      collection: "live-page",
      products: result.products,
      count: result.products.length,
      scrolls: result.scrolls,
      restoredPosition: restorePosition
    };
  } catch (error) {
    return unexpectedFailure(error);
  }
}
