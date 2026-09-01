import {
  cleanItemUrlIfPresent,
  cleanText,
  EbayError,
  fetchDocument,
  isSignInDocument,
  MAX_SEARCH_RESULTS,
  parseMoney,
  titleWithoutAccessibilitySuffix
} from "./shared";
import { parseSearchDocument } from "./search";
import type { GetWatchlistInput, SearchItem } from "./types";
import { signedIn } from "./watch-control";

function genericWatchlistItems(documentRoot: Document, limit: number) {
  const parsed = parseSearchDocument(documentRoot, limit);
  if (parsed.length) return parsed;

  const byId = new Map<string, SearchItem>();
  for (const link of documentRoot.querySelectorAll<HTMLAnchorElement>("a[href*='/itm/']")) {
    const reference = cleanItemUrlIfPresent(link.href);
    if (!reference || byId.has(reference.itemId)) continue;
    const root = link.closest("li, article, [data-listingid], [data-itemid], [class*='item']") ?? link.parentElement;
    if (!root) continue;
    const title = titleWithoutAccessibilitySuffix(
      root.querySelector("h2, h3, [class*='title']")?.textContent
        ?? root.querySelector<HTMLImageElement>("img[alt]")?.alt
        ?? link.textContent
    );
    if (!title || title.length < 3) continue;
    const rootText = cleanText(root.textContent, 3_000);
    const priceDisplay = rootText.match(/(?:US\s*\$|AU\s*\$|C\s*\$|[$€£]|USD\s*|EUR\s*|GBP\s*)\s*\d[\d.,]*/i)?.[0] ?? "";
    byId.set(reference.itemId, {
      itemId: reference.itemId,
      url: reference.url,
      title,
      image: root.querySelector<HTMLImageElement>("img[src]")?.src ?? null,
      condition: null,
      price: parseMoney(priceDisplay),
      shipping: null,
      shippingText: null,
      total: null,
      buyingFormat: /\d+\s+bids?\b/i.test(rootText) ? "auction" : /buy it now/i.test(rootText) ? "buy_it_now" : "unknown",
      bids: Number(rootText.match(/(\d+)\s+bids?\b/i)?.[1] ?? "") || null,
      timeLeft: rootText.match(/ends? in\s+[^|]+/i)?.[0] ?? null,
      seller: null,
      sellerFeedback: rootText.match(/\d+(?:\.\d+)?%\s+positive/i)?.[0] ?? null,
      location: null,
      watching: true,
      sponsored: false
    });
    if (byId.size >= limit) break;
  }
  return [...byId.values()];
}

export async function getWatchlist({ limit = 50 }: GetWatchlistInput) {
  if (!signedIn()) throw new EbayError("A signed-in eBay session is required to read the watchlist.");
  const boundedLimit = Math.max(1, Math.min(limit, MAX_SEARCH_RESULTS));
  const url = new URL("/mye/myebay/watchlist", window.location.origin);
  const { documentRoot, responseUrl } = await fetchDocument(url);
  if (isSignInDocument(documentRoot, responseUrl)) {
    throw new EbayError("A signed-in eBay session is required to read the watchlist.");
  }
  const items = genericWatchlistItems(documentRoot, boundedLimit);
  return { url: responseUrl, count: items.length, items };
}
