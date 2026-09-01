import {
  cleanText,
  normalizeTemuUrl,
  parseMoneyCandidates,
  parseRating,
  parseReviewCount,
  productIdFromUrl
} from "../api/parsing";
import { rememberProduct } from "../api/registry";
import type { ProductSource, ProductSummary } from "../api/types";
import { deliveryText, elementText } from "./text";

function productAnchors(root: ParentNode) {
  return [...root.querySelectorAll<HTMLAnchorElement>("a[href]")]
    .filter(anchor => productIdFromUrl(anchor.href))
    .slice(0, 1_000);
}

function nearestCard(anchor: HTMLAnchorElement) {
  const explicit = anchor.closest<HTMLElement>(
    "[data-goods-id], [data-product-id], [data-testid*='product'], article, [role='listitem'], li"
  );
  if (explicit) return explicit;

  let candidate: HTMLElement = anchor;
  for (let depth = 0; depth < 6 && candidate.parentElement; depth += 1) {
    const parent = candidate.parentElement;
    const text = cleanText(parent.innerText, 4_000);
    const ids = new Set(productAnchors(parent).map(link => productIdFromUrl(link.href)));
    if (text.length >= 20 && text.length <= 3_000 && ids.size <= 2) candidate = parent;
    else break;
  }
  return candidate;
}

function productTitle(anchor: HTMLAnchorElement, card: HTMLElement) {
  const candidates = [
    anchor.getAttribute("aria-label"),
    anchor.getAttribute("title"),
    card.querySelector<HTMLImageElement>("img[alt]")?.alt,
    elementText(card, ["[data-testid*='title']", "[class*='title']", "h1", "h2", "h3"], 500),
    anchor.innerText
  ];
  return candidates
    .map(value => cleanText(value, 500))
    .find(value => value.length >= 4 && !(value.length < 30 && parseMoneyCandidates(value, 1).length)) || "Untitled Temu product";
}

function soldText(value: string) {
  return cleanText(value.match(/[\d.,]+[kKmM]?\+?\s*(?:sold|продано|verkauft|vendus?)/i)?.[0], 80);
}

function imageUrl(card: ParentNode) {
  const image = card.querySelector<HTMLImageElement>("img");
  const value = image?.currentSrc || image?.src || image?.getAttribute("data-src") || "";
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function summaryFromAnchor(anchor: HTMLAnchorElement, source: ProductSource): ProductSummary | null {
  const url = normalizeTemuUrl(anchor.href);
  const productId = productIdFromUrl(url);
  if (!url || !productId) return null;
  const card = nearestCard(anchor);
  const cardText = cleanText(card.innerText, 8_000);
  const explicitPriceText = elementText(card, [
    "[data-testid*='price']",
    "[class*='sale-price']",
    "[class*='price']"
  ], 500);
  const prices = parseMoneyCandidates(explicitPriceText || cardText);
  const referencePrice = prices.slice(1).find(price =>
    (!prices[0]?.currency || price.currency === prices[0].currency) && price.amount > prices[0]!.amount
  ) || null;
  const ratingText = [
    ...card.querySelectorAll<HTMLElement>("[aria-label*='star' i], [aria-label*='rating' i], [title*='star' i]")
  ].map(element => element.getAttribute("aria-label") || element.getAttribute("title") || element.innerText).join(" ");

  return rememberProduct({
    productId,
    url,
    title: productTitle(anchor, card),
    imageUrl: imageUrl(card),
    displayedPrice: prices[0] || null,
    referencePrice,
    rating: parseRating(ratingText || cardText),
    reviewCount: parseReviewCount(`${ratingText} ${cardText}`),
    soldText: soldText(cardText) || null,
    deliveryText: deliveryText(cardText) || null,
    sponsored: /(?:^|\s)(?:sponsored|advertisement|реклама|Anzeige)(?:\s|$)/i.test(cardText),
    source,
    observedAt: new Date().toISOString()
  });
}

export function domProducts(root: ParentNode, source: ProductSource) {
  const products = new Map<string, ProductSummary>();
  for (const anchor of productAnchors(root)) {
    const product = summaryFromAnchor(anchor, source);
    if (!product || products.has(product.productId)) continue;
    products.set(product.productId, product);
  }
  return [...products.values()];
}
