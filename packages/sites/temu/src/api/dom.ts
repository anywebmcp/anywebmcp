import {
  cleanText,
  currentSearchQuery,
  isAuthenticationRequired,
  isSecurityVerification,
  moneyFromOffer,
  normalizeTemuUrl,
  parseMoneyCandidates,
  parseRating,
  parseReviewCount,
  productIdFromUrl,
  searchUrl,
  type Money
} from "./parsing";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_SCROLLS = 8;
const MAX_REGISTRY_SIZE = 300;
const MAX_SCRIPT_BYTES = 5_000_000;

export type SearchProductsInput = {
  query?: string;
  limit?: number;
  maxScrolls?: number;
  restorePosition?: boolean;
};

export type ReadProductInput = { product: string };
export type CompareProductsInput = { products: string[] };

type ProductSource = "live-page" | "fetched-page" | "structured-data" | "search-snapshot";

export type ProductSummary = {
  productId: string;
  url: string;
  title: string;
  imageUrl: string | null;
  displayedPrice: Money | null;
  referencePrice: Money | null;
  rating: number | null;
  reviewCount: number | null;
  soldText: string | null;
  deliveryText: string | null;
  sponsored: boolean;
  source: ProductSource;
  observedAt: string;
};

type ProductVariant = {
  skuId: string;
  attributes: Record<string, string>;
  price: Money | null;
  inStock: boolean | null;
};

type ProductDetail = ProductSummary & {
  variants: ProductVariant[];
  selectedAttributes: Record<string, string>;
  sellerName: string | null;
  description: string | null;
  completeness: "detail" | "summary";
  warnings: string[];
};

type FailureOptions = {
  retryable?: boolean;
  diagnostics?: Record<string, unknown>;
  suggestedAction?: string;
};

const state = {
  products: new Map<string, ProductSummary>()
};

function delay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted();
    const timeout = window.setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    const abort = () => {
      window.clearTimeout(timeout);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function failure(code: string, message: string, {
  retryable = false,
  diagnostics = {},
  suggestedAction
}: FailureOptions = {}) {
  return {
    ok: false as const,
    error: {
      code,
      message,
      retryable,
      diagnostics,
      ...(suggestedAction ? { suggestedAction } : {})
    }
  };
}

function unexpectedFailure(error: unknown) {
  const value = error as { name?: string; message?: string };
  return failure("UNEXPECTED_ERROR", "The Temu page operation failed unexpectedly.", {
    retryable: true,
    diagnostics: {
      name: cleanText(value?.name || "Error", 100),
      detail: cleanText(value?.message || String(error), 500)
    }
  });
}

function remember(product: ProductSummary) {
  state.products.delete(product.productId);
  state.products.set(product.productId, product);
  while (state.products.size > MAX_REGISTRY_SIZE) {
    const oldest = state.products.keys().next().value;
    if (!oldest) break;
    state.products.delete(oldest);
  }
  return product;
}

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

function elementText(root: ParentNode, selectors: string[], maxLength = 1_000) {
  for (const selector of selectors) {
    const text = cleanText(root.querySelector<HTMLElement>(selector)?.innerText, maxLength);
    if (text) return text;
  }
  return "";
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

function deliveryText(value: string) {
  const patterns = [
    /(?:delivery|arrives?|ships?)\b[^.!|]{0,160}/i,
    /(?:доставк\w*|прибудет)\b[^.!|]{0,160}/i,
    /(?:Lieferung|livraison|consegna)\b[^.!|]{0,160}/i
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern)?.[0];
    if (match) return cleanText(match, 180);
  }
  return "";
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

  return remember({
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

function domProducts(root: ParentNode, source: ProductSource) {
  const products = new Map<string, ProductSummary>();
  for (const anchor of productAnchors(root)) {
    const product = summaryFromAnchor(anchor, source);
    if (!product || products.has(product.productId)) continue;
    products.set(product.productId, product);
  }
  return [...products.values()];
}

function objectValue(record: Record<string, unknown>, names: string[]) {
  for (const name of names) if (record[name] !== undefined && record[name] !== null) return record[name];
  return undefined;
}

function scalarText(value: unknown, maxLength = 500) {
  return typeof value === "string" || typeof value === "number"
    ? cleanText(value, maxLength)
    : "";
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

  return remember({
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

function structuredProducts(doc: Document) {
  const products = new Map<string, ProductSummary>();
  const queue: Array<{ value: unknown; depth: number }> = parsedScripts(doc).map(value => ({ value, depth: 0 }));
  let cursor = 0;
  let visited = 0;
  while (cursor < queue.length && visited < 80_000) {
    const item = queue[cursor++];
    visited += 1;
    if (!item.value || typeof item.value !== "object" || item.depth > 12) continue;
    if (Array.isArray(item.value)) {
      for (const value of item.value.slice(0, 2_000)) queue.push({ value, depth: item.depth + 1 });
      continue;
    }
    const record = item.value as Record<string, unknown>;
    const product = structuredSummary(record);
    if (product && !products.has(product.productId)) products.set(product.productId, product);
    for (const value of Object.values(record).slice(0, 500)) {
      if (value && typeof value === "object") queue.push({ value, depth: item.depth + 1 });
    }
  }
  return [...products.values()];
}

function allProducts(doc: Document, source: ProductSource) {
  const products = new Map<string, ProductSummary>();
  for (const product of [...domProducts(doc, source), ...structuredProducts(doc)]) {
    const previous = products.get(product.productId);
    if (!previous || (!previous.displayedPrice && product.displayedPrice)) products.set(product.productId, product);
  }
  return [...products.values()];
}

async function fetchDocument(url: string, signal?: AbortSignal) {
  const target = new URL(url);
  if (target.origin !== window.location.origin) {
    target.protocol = window.location.protocol;
    target.host = window.location.host;
  }
  const response = await fetch(target.href, {
    method: "GET",
    credentials: "include",
    headers: { accept: "text/html,application/xhtml+xml" },
    signal
  });
  const html = await response.text();
  if (!response.ok) {
    throw new Error(`Temu returned HTTP ${response.status} for ${target.pathname}.`);
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const responseUrl = response.url || target.href;
  const base = doc.createElement("base");
  base.href = responseUrl;
  doc.head.prepend(base);
  return {
    doc,
    url: responseUrl,
    verification: isSecurityVerification(doc.body?.innerText || html, responseUrl),
    authenticationRequired: isAuthenticationRequired(doc.body?.innerText || html, responseUrl)
  };
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

export async function searchProducts(input: SearchProductsInput = {}, signal?: AbortSignal) {
  let originalY: number | null = null;
  let shouldRestore = false;
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

    originalY = window.scrollY;
    shouldRestore = restorePosition;
    const products = new Map<string, ProductSummary>();
    const collect = (includeStructured = false) => {
      const found = includeStructured
        ? allProducts(document, "live-page")
        : domProducts(document, "live-page");
      for (const product of found) {
        if (!products.has(product.productId)) products.set(product.productId, product);
      }
    };

    collect(true);
    let scrolls = 0;
    while (products.size < limit && scrolls < maxScrolls) {
      const before = window.scrollY;
      window.scrollBy({ top: Math.max(500, Math.round(window.innerHeight * 0.85)), behavior: "auto" });
      await delay(700, signal);
      collect();
      scrolls += 1;
      if (window.scrollY === before) break;
    }
    if (restorePosition && window.scrollY !== originalY) {
      window.scrollTo({ top: originalY, behavior: "auto" });
      await delay(100, signal);
    }
    shouldRestore = false;

    const result = [...products.values()].slice(0, limit);
    if (!result.length) {
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
      products: result,
      count: result.length,
      scrolls,
      restoredPosition: restorePosition
    };
  } catch (error) {
    return unexpectedFailure(error);
  } finally {
    if (shouldRestore && originalY !== null && window.scrollY !== originalY) {
      window.scrollTo({ top: originalY, behavior: "auto" });
    }
  }
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

function structuredVariants(doc: Document) {
  const variants = new Map<string, ProductVariant>();
  const queue: Array<{ value: unknown; depth: number }> = parsedScripts(doc).map(value => ({ value, depth: 0 }));
  let cursor = 0;
  let visited = 0;
  while (cursor < queue.length && visited < 80_000) {
    const item = queue[cursor++];
    visited += 1;
    if (!item.value || typeof item.value !== "object" || item.depth > 12) continue;
    if (Array.isArray(item.value)) {
      for (const value of item.value.slice(0, 2_000)) queue.push({ value, depth: item.depth + 1 });
      continue;
    }
    const record = item.value as Record<string, unknown>;
    const skuId = scalarText(objectValue(record, ["sku", "skuId", "sku_id", "productSkuId", "product_sku_id"]), 100);
    if (skuId && /\d{4,}/.test(skuId)) {
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
    for (const value of Object.values(record).slice(0, 500)) {
      if (value && typeof value === "object") queue.push({ value, depth: item.depth + 1 });
    }
  }
  return [...variants.values()].slice(0, 100);
}

function selectedAttributes(doc: Document) {
  const result: Record<string, string> = {};
  const roots = [...doc.querySelectorAll<HTMLElement>(
    "main [aria-pressed='true'], main [aria-selected='true'], main input:checked"
  )].slice(0, 30);
  for (const element of roots) {
    const value = cleanText(
      element.getAttribute("aria-label") ||
      (element as HTMLInputElement).value ||
      element.closest("label")?.innerText ||
      element.innerText,
      200
    );
    if (!value) continue;
    const group = cleanText(
      element.closest("fieldset")?.querySelector("legend")?.textContent ||
      element.parentElement?.previousElementSibling?.textContent,
      100
    ) || `option${Object.keys(result).length + 1}`;
    result[group] = value;
  }
  return result;
}

function detailFromDocument(doc: Document, reference: ProductSummary, source: ProductSource): ProductDetail {
  const products = allProducts(doc, source);
  const matched = products.find(product => product.productId === reference.productId) || products[0] || reference;
  const heading = elementText(doc, ["main h1", "h1", "[data-testid*='title']"], 1_000);
  const description = elementText(doc, [
    "[data-testid*='description']",
    "[class*='description']",
    "[itemprop='description']"
  ], 5_000);
  const seller = doc.querySelector<HTMLAnchorElement>(
    "a[href*='seller'], a[href*='shop'], [data-testid*='seller'] a"
  );
  const text = cleanText(doc.body?.innerText, 20_000);
  const shipping = deliveryText(text);
  const variants = structuredVariants(doc);
  const warnings: string[] = [];
  if (!variants.length) warnings.push("No structured SKU variants were exposed by this page.");
  if (!matched.displayedPrice) warnings.push("No currency-qualified product price was found.");
  if (source !== "live-page") warnings.push("Variant selection state may require opening the product page interactively.");

  return {
    ...matched,
    title: heading || matched.title,
    deliveryText: shipping || matched.deliveryText,
    sellerName: cleanText(seller?.innerText || seller?.getAttribute("aria-label"), 300) || null,
    description: description || null,
    variants,
    selectedAttributes: source === "live-page" ? selectedAttributes(doc) : {},
    source,
    completeness: heading || variants.length || description ? "detail" : "summary",
    warnings
  };
}

function resolveProduct(product: string) {
  const value = cleanText(product, 2_000);
  const directUrl = normalizeTemuUrl(value);
  const productId = productIdFromUrl(directUrl) || value.match(/^\d{6,}$/)?.[0] || "";
  const snapshot = state.products.get(productId);
  const url = directUrl || snapshot?.url || "";
  return { value, productId, url, snapshot };
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
      const fallback = reference.snapshot || {
        productId: reference.productId,
        url: reference.url,
        title: "Untitled Temu product",
        imageUrl: null,
        displayedPrice: null,
        referencePrice: null,
        rating: null,
        reviewCount: null,
        soldText: null,
        deliveryText: null,
        sponsored: false,
        source: "live-page" as const,
        observedAt: new Date().toISOString()
      };
      return { ok: true as const, product: detailFromDocument(document, fallback, "live-page") };
    }

    const fetched = await fetchDocument(reference.url, signal);
    if (fetched.verification) {
      if (reference.snapshot) {
        return {
          ok: true as const,
          product: {
            ...reference.snapshot,
            variants: [],
            selectedAttributes: {},
            sellerName: null,
            description: null,
            source: "search-snapshot" as const,
            completeness: "summary" as const,
            warnings: ["Temu required security verification for the detail page; returning the known search snapshot."]
          }
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
          product: {
            ...reference.snapshot,
            variants: [],
            selectedAttributes: {},
            sellerName: null,
            description: null,
            source: "search-snapshot" as const,
            completeness: "summary" as const,
            warnings: ["Temu redirected the detail request to sign in; returning the known search snapshot."]
          }
        };
      }
      return failure("AUTHENTICATION_REQUIRED", "Temu requires this browser session to sign in before showing the product.", {
        retryable: true,
        diagnostics: { productId: reference.productId, url: fetched.url },
        suggestedAction: "Sign in to Temu in this browser session, open the product page, and retry."
      });
    }
    const fallback = reference.snapshot || {
      productId: reference.productId,
      url: reference.url,
      title: "Untitled Temu product",
      imageUrl: null,
      displayedPrice: null,
      referencePrice: null,
      rating: null,
      reviewCount: null,
      soldText: null,
      deliveryText: null,
      sponsored: false,
      source: "fetched-page" as const,
      observedAt: new Date().toISOString()
    };
    return { ok: true as const, product: detailFromDocument(fetched.doc, fallback, "fetched-page") };
  } catch (error) {
    return unexpectedFailure(error);
  }
}

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
