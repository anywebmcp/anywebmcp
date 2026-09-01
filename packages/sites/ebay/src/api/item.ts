import {
  cleanEncodedText,
  cleanItemUrlIfPresent,
  cleanText,
  defaultCurrency,
  EbayError,
  fetchDocument,
  itemReference,
  MAX_BATCH_ITEMS,
  MAX_ITEM_SPECIFICS,
  MAX_TEXT,
  parseMoney,
  textOf
} from "./shared";
import type { ItemReference, JsonRecord, ReadItemInput, ReadItemsInput } from "./types";
import { findWatchControl, watchState } from "./watch-control";

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

export function parseItemPage(documentRoot: Document, reference: ItemReference) {
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

export async function readItem({ item }: ReadItemInput) {
  const reference = itemReference(item);
  const current = cleanItemUrlIfPresent(window.location.href);
  const documentRoot = current?.itemId === reference.itemId
    ? document
    : (await fetchDocument(new URL(reference.url))).documentRoot;
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
