import {
  canonicalItemUrl,
  cleanText,
  defaultCurrency,
  EbayError,
  fetchDocument,
  MAX_SEARCH_RESULTS,
  parseMoney,
  textOf,
  titleWithoutAccessibilitySuffix
} from "./shared";
import type { SearchItem, SearchItemsInput } from "./types";
import { watchState } from "./watch-control";

const CONDITION_IDS = {
  new: "1000",
  open_box: "1500",
  refurbished: "2000|2500",
  used: "3000",
  parts: "7000"
} as const;

const SORT_IDS = {
  best_match: "12",
  ending_soonest: "1",
  newly_listed: "10",
  price_lowest: "15",
  price_highest: "16"
} as const;

function parseSearchCard(root: Element): SearchItem | null {
  const itemId = root.getAttribute("data-listingid")
    ?? root.getAttribute("data-itemid")
    ?? [...root.querySelectorAll<HTMLAnchorElement>("a[href*='/itm/']")]
      .map(link => link.href.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/)?.[1])
      .find(Boolean)
    ?? "";
  if (!/^\d{9,15}$/.test(itemId) || itemId === "123456") return null;

  const link = [...root.querySelectorAll<HTMLAnchorElement>("a[href*='/itm/']")]
    .find(candidate => candidate.href.includes(`/itm/${itemId}`)) ?? null;
  const title = titleWithoutAccessibilitySuffix(
    root.querySelector(".s-card__title, .s-item__title, h3")?.textContent
      ?? root.querySelector<HTMLImageElement>("img[alt]")?.alt
  );
  if (!title || /^shop on ebay$/i.test(title)) return null;

  const rows = [...root.querySelectorAll<HTMLElement>(
    ".s-card__attribute-row, .s-item__details, .s-item__detail"
  )].map(element => cleanText(element.innerText || element.textContent, 500)).filter(Boolean);
  const subtitles = [...root.querySelectorAll<HTMLElement>(
    ".s-card__subtitle, .s-item__subtitle"
  )].map(element => cleanText(element.innerText || element.textContent, 500)).filter(Boolean);
  const allText = cleanText(root.textContent, 4_000);
  const priceText = textOf(root, ".s-card__price, .s-item__price", 200)
    || rows.find(row => /[$€£]\s*\d|\b(?:USD|EUR|GBP|CAD|AUD)\b/i.test(row))
    || "";
  const shippingText = rows.find(row => /delivery|shipping|postage|pickup/i.test(row)) ?? null;
  const price = parseMoney(priceText);
  const shipping = /\bfree\b/i.test(shippingText ?? "") ? {
    amount: 0,
    currency: price?.currency ?? defaultCurrency(),
    display: shippingText ?? "Free shipping"
  } : parseMoney(shippingText, price?.currency);
  const total = price && shipping && price.currency === shipping.currency ? {
    amount: Math.round((price.amount + shipping.amount) * 100) / 100,
    currency: price.currency,
    display: `${price.currency} ${Math.round((price.amount + shipping.amount) * 100) / 100}`
  } : price && !shippingText ? price : null;
  const bidMatch = allText.match(/(\d[\d,]*)\s+bids?\b/i);
  const sellerRow = rows.find(row => /\d+(?:\.\d+)?%\s+positive/i.test(row)) ?? null;
  const watchControl = root.querySelector<HTMLElement>(
    ".s-card__watchheart-click, .s-item__watchheart a, [aria-label*='watch' i]"
  );

  let buyingFormat: SearchItem["buyingFormat"] = "unknown";
  if (bidMatch || rows.some(row => /\bauction\b/i.test(row))) buyingFormat = "auction";
  else if (rows.some(row => /buy it now/i.test(row))) buyingFormat = "buy_it_now";
  else if (rows.some(row => /classified ad/i.test(row))) buyingFormat = "classified";

  return {
    itemId,
    url: canonicalItemUrl(link, itemId),
    title,
    image: root.querySelector<HTMLImageElement>("img[src]")?.src ?? null,
    condition: subtitles.at(-1) ?? null,
    price,
    shipping,
    shippingText,
    total,
    buyingFormat,
    bids: bidMatch ? Number(bidMatch[1].replace(/,/g, "")) : null,
    timeLeft: rows.find(row => /ends? in|time left/i.test(row)) ?? null,
    seller: sellerRow?.replace(/\s+\d+(?:\.\d+)?%\s+positive.*$/i, "").trim() ?? null,
    sellerFeedback: sellerRow?.match(/\d+(?:\.\d+)?%\s+positive(?:\s*\([^)]*\))?/i)?.[0] ?? null,
    location: rows.find(row => /^located in\b/i.test(row))?.replace(/^located in\s*/i, "") ?? null,
    watching: watchControl ? watchState(watchControl) : null,
    sponsored: /derosnopS|\bSponsored\b/i.test(allText)
  };
}

export function searchUrl(input: SearchItemsInput) {
  const url = new URL("/sch/i.html", window.location.origin);
  url.searchParams.set("_nkw", cleanText(input.query, 300));
  url.searchParams.set("_sop", SORT_IDS[input.sort ?? "best_match"]);
  if (input.page && input.page > 1) url.searchParams.set("_pgn", String(input.page));
  if (input.minPrice != null) url.searchParams.set("_udlo", String(input.minPrice));
  if (input.maxPrice != null) url.searchParams.set("_udhi", String(input.maxPrice));
  if (input.freeShipping) url.searchParams.set("LH_FS", "1");
  if (input.buyingFormat === "auction") url.searchParams.set("LH_Auction", "1");
  if (input.buyingFormat === "buy_it_now") url.searchParams.set("LH_BIN", "1");
  if (input.condition?.length) {
    const conditions = [...new Set(input.condition.flatMap(condition => CONDITION_IDS[condition].split("|")))];
    url.searchParams.set("LH_ItemCondition", conditions.join("|"));
  }
  return url;
}

export function parseSearchDocument(documentRoot: Document, limit: number) {
  const roots = [...documentRoot.querySelectorAll(
    "li[data-listingid], li.s-item, article[data-listingid]"
  )];
  const byId = new Map<string, SearchItem>();
  for (const root of roots) {
    const item = parseSearchCard(root);
    if (!item || byId.has(item.itemId)) continue;
    byId.set(item.itemId, item);
    if (byId.size >= limit) break;
  }
  return [...byId.values()];
}

export async function searchItems(input: SearchItemsInput) {
  const query = cleanText(input.query, 300);
  if (!query) throw new EbayError("Search query cannot be empty.");
  const limit = Math.max(1, Math.min(input.limit ?? 20, MAX_SEARCH_RESULTS));
  const url = searchUrl({ ...input, query });
  const { documentRoot } = await fetchDocument(url);
  const items = parseSearchDocument(documentRoot, limit);
  return {
    query,
    url: url.href,
    count: items.length,
    items
  };
}
