const MAX_SEARCH_RESULTS = 50;
const MAX_BATCH_ITEMS = 10;
const MAX_ITEM_SPECIFICS = 100;
const MAX_TEXT = 12_000;

export class EbayError extends Error {}

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

export type SearchItemsInput = {
  query: string;
  limit?: number;
  page?: number;
  minPrice?: number;
  maxPrice?: number;
  condition?: Array<keyof typeof CONDITION_IDS>;
  buyingFormat?: "all" | "auction" | "buy_it_now";
  freeShipping?: boolean;
  sort?: keyof typeof SORT_IDS;
};

export type ReadItemInput = { item: string };
export type ReadItemsInput = { items: string[] };
export type GetWatchlistInput = { limit?: number };
export type SetWatchStateInput = { itemId: string; watched: boolean };

type Money = {
  amount: number;
  currency: string;
  display: string;
};

type SearchItem = {
  itemId: string;
  url: string;
  title: string;
  image: string | null;
  condition: string | null;
  price: Money | null;
  shipping: Money | null;
  shippingText: string | null;
  total: Money | null;
  buyingFormat: "auction" | "buy_it_now" | "classified" | "unknown";
  bids: number | null;
  timeLeft: string | null;
  seller: string | null;
  sellerFeedback: string | null;
  location: string | null;
  watching: boolean | null;
  sponsored: boolean;
};

type JsonRecord = Record<string, any>;

function cleanText(value: unknown, maxLength = MAX_TEXT) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanEncodedText(value: unknown, maxLength = MAX_TEXT) {
  const raw = String(value ?? "");
  if (!/&(?:#\d+|#x[\da-f]+|[a-z]+);/i.test(raw)) return cleanText(raw, maxLength);
  const parsed = new DOMParser().parseFromString(`<!doctype html><html><body>${raw}</body></html>`, "text/html");
  return cleanText(parsed.body?.textContent, maxLength);
}

function textOf(root: ParentNode, selector: string, maxLength = 1_000) {
  const element = root.querySelector<HTMLElement>(selector);
  return cleanText(element?.innerText || element?.textContent, maxLength);
}

function ebayHost(hostname = window.location.hostname) {
  return /(^|\.)ebay\.(com|co\.uk|de|fr|it|es|ca|com\.au)$/i.test(hostname);
}

function cleanItemUrl(value: string) {
  const url = new URL(value, window.location.href);
  if (!ebayHost(url.hostname)) throw new EbayError("The item URL must belong to a supported eBay site.");
  const itemId = url.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})(?:[/?]|$)/)?.[1];
  if (!itemId) throw new EbayError("The eBay item URL does not contain a valid item ID.");
  return { itemId, url: `${url.origin}/itm/${itemId}` };
}

function itemReference(value: string) {
  const trimmed = cleanText(value, 2_000);
  if (/^\d{9,15}$/.test(trimmed)) {
    return { itemId: trimmed, url: `${window.location.origin}/itm/${trimmed}` };
  }
  return cleanItemUrl(trimmed);
}

function defaultCurrency() {
  const host = window.location.hostname;
  if (/ebay\.co\.uk$/i.test(host)) return "GBP";
  if (/ebay\.(de|fr|it|es)$/i.test(host)) return "EUR";
  if (/ebay\.ca$/i.test(host)) return "CAD";
  if (/ebay\.com\.au$/i.test(host)) return "AUD";
  return "USD";
}

function parseMoney(value: unknown, currencyHint = defaultCurrency()): Money | null {
  const display = cleanText(value, 200);
  if (!display || /\bfree\b/i.test(display)) return null;

  const number = display.match(/(?:^|\s)(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s|$)/)?.[1]
    ?? display.match(/(\d+(?:[.,]\d{1,2})?)/)?.[1];
  if (!number) return null;

  const lastComma = number.lastIndexOf(",");
  const lastDot = number.lastIndexOf(".");
  let normalized = number;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? number.replace(/\./g, "").replace(",", ".")
      : number.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = number.length - lastComma - 1 === 3 ? number.replace(/,/g, "") : number.replace(",", ".");
  } else if (lastDot >= 0 && number.length - lastDot - 1 === 3) {
    normalized = number.replace(/\./g, "");
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;

  let currency = currencyHint;
  if (/\bEUR\b|€/i.test(display)) currency = "EUR";
  else if (/\bGBP\b|£/i.test(display)) currency = "GBP";
  else if (/\bCAD\b|C\s*\$/i.test(display)) currency = "CAD";
  else if (/\bAUD\b|AU\s*\$/i.test(display)) currency = "AUD";
  else if (/\bUSD\b|US\s*\$/i.test(display)) currency = "USD";

  return { amount, currency, display };
}

function canonicalItemUrl(link: HTMLAnchorElement | null, itemId: string) {
  if (!link) return `${window.location.origin}/itm/${itemId}`;
  try {
    const url = new URL(link.href, window.location.href);
    return `${url.origin}/itm/${itemId}`;
  } catch {
    return `${window.location.origin}/itm/${itemId}`;
  }
}

function titleWithoutAccessibilitySuffix(value: unknown) {
  return cleanText(value, 1_000).replace(/\s*Opens in a new window or tab\s*$/i, "").trim();
}

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

function parseJsonLd(documentRoot: Document) {
  const values: unknown[] = [];
  for (const script of documentRoot.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')) {
    try {
      values.push(JSON.parse(script.textContent || "null"));
    } catch {}
  }
  return values;
}

function findTypedJson(value: unknown, type: string): JsonRecord | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTypedJson(item, type);
      if (found) return found;
    }
    return null;
  }
  const record = value as JsonRecord;
  const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
  if (types.includes(type)) return record;
  for (const child of Object.values(record)) {
    const found = findTypedJson(child, type);
    if (found) return found;
  }
  return null;
}

function itemSpecifics(documentRoot: Document) {
  const result: Record<string, string> = {};
  const terms = [...documentRoot.querySelectorAll<HTMLElement>("dt")];
  for (const term of terms) {
    if (Object.keys(result).length >= MAX_ITEM_SPECIFICS) break;
    const definition = term.nextElementSibling;
    if (!definition || definition.tagName !== "DD") continue;
    const key = cleanText(term.innerText || term.textContent, 200);
    const value = cleanText((definition as HTMLElement).innerText || definition.textContent, 2_000);
    if (key && value && !result[key]) result[key] = value;
  }
  return result;
}

function sectionText(documentRoot: Document, label: RegExp, maxLength = 2_000) {
  const candidates = [...documentRoot.querySelectorAll<HTMLElement>("main *")]
    .filter(element => label.test(cleanText(element.innerText || element.textContent, 120)));
  for (const element of candidates) {
    const container = element.closest<HTMLElement>("section, li, div");
    const text = cleanText(container?.innerText || container?.textContent, maxLength);
    if (text && text.length > cleanText(element.textContent).length) return text;
  }
  return null;
}

function offerFromProduct(product: JsonRecord | null) {
  const raw = Array.isArray(product?.offers) ? product?.offers[0] : product?.offers;
  return raw && typeof raw === "object" ? raw as JsonRecord : null;
}

function imageUrls(product: JsonRecord | null) {
  const images = Array.isArray(product?.image) ? product.image : product?.image ? [product.image] : [];
  return images.map((image: unknown) => typeof image === "string" ? image : (image as JsonRecord)?.url)
    .filter((value: unknown): value is string => typeof value === "string")
    .slice(0, 20);
}

function schemaCondition(value: unknown) {
  const condition = cleanText(value, 300).split("/").pop() ?? "";
  const names: Record<string, string> = {
    DamagedCondition: "Damaged",
    NewCondition: "New",
    RefurbishedCondition: "Refurbished",
    UsedCondition: "Used"
  };
  return names[condition] ?? (condition.replace(/Condition$/, "") || null);
}

export function parseItemPage(documentRoot: Document, reference: { itemId: string; url: string }) {
  const jsonLd = parseJsonLd(documentRoot);
  const product = jsonLd.map(value => findTypedJson(value, "Product")).find(Boolean) ?? null;
  const offer = offerFromProduct(product);
  const title = cleanEncodedText(
    product?.name
      ?? documentRoot.querySelector("main h1")?.textContent
      ?? documentRoot.querySelector('meta[property="og:title"]')?.getAttribute("content")?.replace(/\s*\|\s*eBay\s*$/i, ""),
    1_000
  );
  if (!title) throw new EbayError(`eBay item ${reference.itemId} could not be parsed. It may have ended or be unavailable in this region.`);

  const priceValue = offer?.price ?? offer?.lowPrice ?? textOf(documentRoot, "[itemprop='price'], .x-price-primary", 200);
  const currency = cleanText(offer?.priceCurrency, 10) || defaultCurrency();
  const sellerLinks = [...documentRoot.querySelectorAll<HTMLAnchorElement>("main a[href]")]
    .filter(link => /\/sch\/[^/?#]+\/m\.html(?:[?#]|$)/i.test(link.href));
  const sellerLink = sellerLinks.find(link => {
    const text = cleanText(link.innerText || link.textContent, 300);
    return Boolean(text && !/seller(?:'s)? other items/i.test(text));
  }) ?? sellerLinks[0];
  const sellerFromPath = sellerLink?.href.match(/\/sch\/([^/?#]+)\/m\.html/i)?.[1];
  const sellerText = cleanText(sellerLink?.innerText || sellerLink?.textContent, 300);
  const sellerName = sellerText && !/seller(?:'s)? other items/i.test(sellerText)
    ? sellerText
    : sellerFromPath ? decodeURIComponent(sellerFromPath) : null;
  const positive = [...documentRoot.querySelectorAll<HTMLElement>("main button, main a, main span")]
    .map(element => cleanText(element.innerText || element.textContent, 200))
    .find(text => /^\d+(?:\.\d+)?%\s+positive$/i.test(text)) ?? null;
  const description = cleanEncodedText(
    documentRoot.querySelector('meta[name="description"]')?.getAttribute("content")
      ?? documentRoot.querySelector('meta[property="og:description"]')?.getAttribute("content"),
    4_000
  ) || null;
  const specifics = itemSpecifics(documentRoot);
  const condition = schemaCondition(product?.itemCondition) ?? (cleanText(specifics.Condition, 500) || null);
  const price = priceValue == null ? null : parseMoney(`${currency} ${priceValue}`, currency);
  const bodyText = cleanText(documentRoot.body?.textContent, MAX_TEXT);
  const bids = bodyText.match(/(\d[\d,]*)\s+bids?\b/i);
  const watchControl = findWatchControl(reference.itemId, documentRoot, true);

  return {
    itemId: reference.itemId,
    url: reference.url,
    title,
    description,
    images: imageUrls(product),
    condition,
    availability: cleanText(offer?.availability?.split("/").pop(), 100) || null,
    price,
    buyingFormat: bids ? "auction" : /buy it now/i.test(bodyText) ? "buy_it_now" : "unknown",
    bids: bids ? Number(bids[1].replace(/,/g, "")) : null,
    seller: sellerName ? { name: sellerName, feedback: positive } : null,
    shipping: sectionText(documentRoot, /^Shipping:?$/i),
    delivery: sectionText(documentRoot, /^Delivery:?$/i),
    returns: sectionText(documentRoot, /^Returns:?$/i),
    itemSpecifics: specifics,
    watching: watchControl ? watchState(watchControl) : null
  };
}

function isSignInDocument(documentRoot: Document, responseUrl: string) {
  return /signin\.ebay\./i.test(responseUrl)
    || /sign in or register/i.test(cleanText(documentRoot.title, 200))
    || Boolean(documentRoot.querySelector("form[action*='SignIn'], input[name='userid']"));
}

function isChallengeDocument(documentRoot: Document, responseUrl: string) {
  const title = cleanText(documentRoot.title, 300);
  const body = cleanText(documentRoot.body?.textContent, 2_000);
  return /\/splashui\/challenge|captcha|challenge/i.test(responseUrl)
    || /^(?:Error Page|Security Measure)\s*\|\s*eBay$/i.test(title)
    || /pardon our interruption|verify (?:that )?you are human|security measure/i.test(body);
}

async function fetchDocument(url: URL) {
  if (url.origin !== window.location.origin) {
    throw new EbayError(`This eBay tab can only read ${window.location.origin}. Open the matching regional eBay site and try again.`);
  }
  const response = await fetch(url.href, {
    method: "GET",
    credentials: "include",
    headers: { accept: "text/html,application/xhtml+xml" }
  });
  if (!response.ok) throw new EbayError(`eBay returned HTTP ${response.status} for ${url.pathname}.`);
  const documentRoot = new DOMParser().parseFromString(await response.text(), "text/html");
  if (isChallengeDocument(documentRoot, response.url)) {
    throw new EbayError("eBay presented a security challenge. Open eBay in the tab, complete the challenge manually if requested, and try again.");
  }
  return { documentRoot, responseUrl: response.url };
}

function searchUrl(input: SearchItemsInput) {
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

export async function readItem({ item }: ReadItemInput) {
  const reference = itemReference(item);
  const current = cleanItemUrlIfPresent(window.location.href);
  const documentRoot = current?.itemId === reference.itemId ? document : (await fetchDocument(new URL(reference.url))).documentRoot;
  return parseItemPage(documentRoot, reference);
}

export async function readItems({ items }: ReadItemsInput) {
  if (!items.length) throw new EbayError("At least one eBay item is required.");
  if (items.length > MAX_BATCH_ITEMS) throw new EbayError(`At most ${MAX_BATCH_ITEMS} items can be read at once.`);
  const results: Array<{ item: string; result?: unknown; error?: string }> = [];
  for (let index = 0; index < items.length; index += 3) {
    const chunk = items.slice(index, index + 3);
    results.push(...await Promise.all(chunk.map(async item => {
      try {
        return { item, result: await readItem({ item }) };
      } catch (error) {
        return { item, error: error instanceof Error ? error.message : String(error) };
      }
    })));
  }
  return {
    requested: items.length,
    succeeded: results.filter(result => result.result).length,
    failed: results.filter(result => result.error).length,
    results
  };
}

function cleanItemUrlIfPresent(value: string) {
  try {
    return cleanItemUrl(value);
  } catch {
    return null;
  }
}

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

function watchState(control: Element): boolean | null {
  const value = cleanText([
    control.getAttribute("aria-label"),
    control.getAttribute("title"),
    control.getAttribute("href"),
    control.className,
    control.parentElement?.className,
    control.textContent
  ].join(" "), 2_000);
  if (/unwatch|remove.{0,20}watch|WatchListRemove|watchheart--unwatch/i.test(value)) return true;
  if (/add.{0,20}watch|WatchListAdd|(?:^|\s)watch(?:\s|$)|watchheart--watch/i.test(value)) return false;
  return null;
}

function findWatchControl(itemId: string, documentRoot: Document = document, assumeItemPage = false) {
  const current = cleanItemUrlIfPresent(documentRoot.location?.href ?? window.location.href);
  const searchRoot = documentRoot.querySelector(`[data-listingid="${CSS.escape(itemId)}"], [data-itemid="${CSS.escape(itemId)}"]`);
  const scope = searchRoot ?? (assumeItemPage || current?.itemId === itemId ? documentRoot.querySelector("main") : null);
  if (!scope) return null;
  return [...scope.querySelectorAll<HTMLElement>(
    ".s-card__watchheart-click, .s-item__watchheart a, button[aria-label], a[aria-label], a[href*='WatchList']"
  )].find(element => {
    const label = cleanText(`${element.getAttribute("aria-label")} ${element.getAttribute("href")} ${element.textContent}`, 2_000);
    return /watch/i.test(label);
  }) ?? null;
}

function signedIn() {
  return !document.querySelector("header a[href*='SignIn'][href*='sgfl=gh'], [role='banner'] a[href*='SignIn'][href*='sgfl=gh']");
}

const delay = (milliseconds: number) => new Promise<void>(resolve => window.setTimeout(resolve, milliseconds));

export async function setWatchState({ itemId, watched }: SetWatchStateInput) {
  if (!/^\d{9,15}$/.test(itemId)) throw new EbayError("itemId must be a 9-15 digit eBay item ID.");
  if (!signedIn()) throw new EbayError("Sign in to eBay in this tab before changing the watchlist.");

  let control = findWatchControl(itemId);
  if (!control) {
    throw new EbayError(`Item ${itemId} is not present in the current eBay page. Open its item page or a search page containing it and try again.`);
  }
  const before = watchState(control);
  if (before === watched) return { itemId, watched, changed: false, verified: true };
  if (before == null) throw new EbayError("The item's watchlist control has an unknown state; no click was performed.");

  control.click();
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    await delay(250);
    control = findWatchControl(itemId) ?? control;
    if (watchState(control) === watched) {
      return { itemId, watched, changed: true, verified: true };
    }
  }
  throw new EbayError("eBay did not expose the requested watchlist state after the click. Check the visible page for a sign-in prompt or error.");
}
