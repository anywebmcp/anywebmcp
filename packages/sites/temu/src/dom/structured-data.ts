import { cleanText, moneyFromOffer, normalizeTemuUrl, productIdFromUrl } from "../api/parsing";
import { rememberProduct } from "../api/registry";
import type { ProductSummary, ProductVariant } from "../api/types";
import { objectValue, scalarText } from "./text";

const MAX_SCRIPT_BYTES = 5_000_000;
const MAX_VISITED_VALUES = 80_000;
const MAX_TRAVERSAL_DEPTH = 12;

function parsedScripts(doc: Document) {
  const values: unknown[] = [];
  let totalBytes = 0;
  for (const script of doc.querySelectorAll<HTMLScriptElement>("script")) {
    const text = script.textContent?.trim() || "";
    if (!text || text.length > MAX_SCRIPT_BYTES) continue;
    if (script.type !== "application/ld+json" && script.type !== "application/json" && !/^[\[{]/.test(text)) continue;
    totalBytes += text.length;
    if (totalBytes > MAX_SCRIPT_BYTES * 2) break;
    try { values.push(JSON.parse(text)); } catch {}
  }
  return values;
}

function* structuredRecords(doc: Document) {
  const queue: Array<{ value: unknown; depth: number }> = parsedScripts(doc).map(value => ({ value, depth: 0 }));
  let cursor = 0;
  let visited = 0;
  while (cursor < queue.length && visited < MAX_VISITED_VALUES) {
    const item = queue[cursor++];
    visited += 1;
    if (!item.value || typeof item.value !== "object" || item.depth > MAX_TRAVERSAL_DEPTH) continue;
    if (Array.isArray(item.value)) {
      for (const value of item.value.slice(0, 2_000)) queue.push({ value, depth: item.depth + 1 });
      continue;
    }
    const record = item.value as Record<string, unknown>;
    yield record;
    for (const value of Object.values(record).slice(0, 500)) {
      if (value && typeof value === "object") queue.push({ value, depth: item.depth + 1 });
    }
  }
}

function structuredSummary(record: Record<string, unknown>): ProductSummary | null {
  const typeValue = objectValue(record, ["@type", "type"]);
  const type = Array.isArray(typeValue) ? typeValue.join(" ") : scalarText(typeValue, 100);
  const urlValue = scalarText(objectValue(record, ["url", "goodsUrl", "goods_url", "jumpUrl", "link"]), 2_000);
  const idValue = scalarText(objectValue(record, ["productID", "productId", "product_id", "goodsId", "goods_id", "itemId", "item_id"]), 100);
  const title = scalarText(objectValue(record, ["name", "title", "goodsName", "goods_name", "productName", "product_name"]), 500);
  const url = normalizeTemuUrl(urlValue);
  const productId = productIdFromUrl(url) || idValue.match(/\d{6,}/)?.[0] || "";
  if (!productId || !title || (!url && !/product/i.test(type))) return null;

  const offerValue = Array.isArray(record.offers) ? record.offers[0] : record.offers;
  const offers = offerValue && typeof offerValue === "object"
    ? offerValue as Record<string, unknown>
    : record;
  const price = moneyFromOffer(
    objectValue(offers, ["price", "lowPrice", "salePrice", "sale_price"]),
    objectValue(offers, ["priceCurrency", "currency", "currencyCode"])
  );
  const ratingRecord = record.aggregateRating && typeof record.aggregateRating === "object"
    ? record.aggregateRating as Record<string, unknown>
    : record;
  const ratingValue = Number(objectValue(ratingRecord, ["ratingValue", "rating", "score"]));
  const reviewValue = Number(objectValue(ratingRecord, ["reviewCount", "ratingCount", "reviews"]));
  const imageValue = objectValue(record, ["image", "imageUrl", "image_url", "thumbUrl"]);
  const firstImage = Array.isArray(imageValue) ? imageValue[0] : imageValue;

  return rememberProduct({
    productId,
    url: url || new URL(`/goods.html?goods_id=${encodeURIComponent(productId)}`, window.location.origin).href,
    title,
    imageUrl: scalarText(firstImage, 2_000) || null,
    displayedPrice: price,
    referencePrice: null,
    rating: Number.isFinite(ratingValue) && ratingValue >= 0 && ratingValue <= 5 ? ratingValue : null,
    reviewCount: Number.isFinite(reviewValue) && reviewValue >= 0 ? Math.round(reviewValue) : null,
    soldText: null,
    deliveryText: null,
    sponsored: false,
    source: "structured-data",
    observedAt: new Date().toISOString()
  });
}

export function structuredProducts(doc: Document) {
  const products = new Map<string, ProductSummary>();
  for (const record of structuredRecords(doc)) {
    const product = structuredSummary(record);
    if (product && !products.has(product.productId)) products.set(product.productId, product);
  }
  return [...products.values()];
}

function attributesFrom(value: unknown) {
  const result: Record<string, string> = {};
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 50)) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const name = scalarText(objectValue(record, ["name", "key", "specName", "attributeName"]), 100);
      const option = scalarText(objectValue(record, ["value", "label", "specValue", "attributeValue"]), 200);
      if (name && option) result[name] = option;
    }
  } else if (value && typeof value === "object") {
    for (const [name, option] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
      const text = scalarText(option, 200);
      if (text) result[cleanText(name, 100)] = text;
    }
  }
  return result;
}

export function structuredVariants(doc: Document) {
  const variants = new Map<string, ProductVariant>();
  for (const record of structuredRecords(doc)) {
    const skuId = scalarText(objectValue(record, ["sku", "skuId", "sku_id", "productSkuId", "product_sku_id"]), 100);
    if (!skuId || !/\d{4,}/.test(skuId)) continue;
    const attributeValue = objectValue(record, ["attributes", "specs", "specList", "skuSpecList", "selectedOptions"]);
    const priceValue = objectValue(record, ["price", "salePrice", "sale_price"]);
    const currencyValue = objectValue(record, ["priceCurrency", "currency", "currencyCode"]);
    const stockValue = objectValue(record, ["inStock", "available", "isAvailable", "stock"]);
    const inStock = typeof stockValue === "boolean"
      ? stockValue
      : typeof stockValue === "number" ? stockValue > 0 : null;
    variants.set(skuId, {
      skuId,
      attributes: attributesFrom(attributeValue),
      price: moneyFromOffer(priceValue, currencyValue),
      inStock
    });
  }
  return [...variants.values()].slice(0, 100);
}
