const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const MAX_PAGE = 10;
const MAX_QUERY_LENGTH = 200;

export type SearchProductsInput = {
  query: string;
  limit?: number;
  page?: number;
};

type ProductPrice = {
  display: string;
  amount: number | null;
  currency: string | null;
};

type SearchProduct = {
  asin: string;
  title: string;
  url: string;
  imageUrl: string | null;
  price: ProductPrice | null;
  rating: number | null;
  reviewCount: number | null;
  sponsored: boolean;
  badge: string | null;
  delivery: string | null;
};

const CURRENCY_CODES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "INR", "BRL", "MXN", "AED",
  "SAR", "TRY", "SEK", "PLN", "SGD", "EGP", "ZAR"
];

function cleanText(value: unknown, maxLength = 1_000) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function parseRating(value: string) {
  const match = value.match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const rating = Number(match[0].replace(",", "."));
  return Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : null;
}

function parseCount(value: string) {
  const compact = value.match(/(\d+(?:[.,]\d+)?)\s*([kKmM])\b/);
  if (compact) {
    const number = Number(compact[1].replace(",", "."));
    const multiplier = compact[2].toLowerCase() === "m" ? 1_000_000 : 1_000;
    return Number.isFinite(number) ? Math.round(number * multiplier) : null;
  }

  const match = value.match(/\d[\d\s.,'’]*/);
  if (!match) return null;
  const number = Number(match[0].replace(/\D/g, ""));
  return Number.isFinite(number) ? number : null;
}

function currencyFrom(display: string) {
  const code = CURRENCY_CODES.find(candidate =>
    new RegExp(`(?:^|\\s)${candidate}(?:\\s|$)`, "i").test(display)
  );
  if (code) return code;
  if (display.includes("€")) return "EUR";
  if (display.includes("£")) return "GBP";
  if (display.includes("₹")) return "INR";
  if (display.includes("¥") || display.includes("￥")) return "JPY";
  if (display.includes("R$")) return "BRL";
  if (display.includes("zł")) return "PLN";
  if (display.includes("₺") || /(?:^|\s)TL(?:\s|$)/i.test(display)) return "TRY";
  if (window.location.hostname === "www.amazon.se" && /(?:^|\s)kr(?:\s|$)/i.test(display)) return "SEK";
  if (window.location.hostname === "www.amazon.co.za" && /^R\s*\d/.test(display)) return "ZAR";
  if (display.includes("$")) {
    const dollarCurrencies: Record<string, string> = {
      "www.amazon.com": "USD",
      "www.amazon.ca": "CAD",
      "www.amazon.com.au": "AUD",
      "www.amazon.com.mx": "MXN",
      "www.amazon.sg": "SGD"
    };
    return dollarCurrencies[window.location.hostname] || null;
  }
  return null;
}

function amountFrom(display: string) {
  const numeric = display
    .replace(/[\u00a0\s'’]/g, "")
    .match(/\d[\d.,]*/)?.[0];
  if (!numeric) return null;

  const lastComma = numeric.lastIndexOf(",");
  const lastDot = numeric.lastIndexOf(".");
  const separatorIndex = Math.max(lastComma, lastDot);
  let normalized: string;

  if (separatorIndex >= 0 && numeric.length - separatorIndex - 1 === 2) {
    normalized = `${numeric.slice(0, separatorIndex).replace(/[.,]/g, "")}.${numeric.slice(separatorIndex + 1)}`;
  } else {
    normalized = numeric.replace(/[.,]/g, "");
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function parsePrice(displayValue: string): ProductPrice | null {
  const display = cleanText(displayValue, 100);
  if (!display) return null;
  return {
    display,
    amount: amountFrom(display),
    currency: currencyFrom(display)
  };
}

function firstText(root: ParentNode, selectors: string[], maxLength = 1_000) {
  for (const selector of selectors) {
    const element = root.querySelector<HTMLElement>(selector);
    const text = cleanText(element?.innerText || element?.textContent, maxLength);
    if (text) return text;
  }
  return "";
}

function joinedText(root: ParentNode, selector: string, maxLength = 1_000) {
  const parts = [...root.querySelectorAll<HTMLElement>(selector)]
    .map(element => cleanText(element.innerText || element.textContent, maxLength))
    .filter(Boolean);
  return cleanText([...new Set(parts)].join(" "), maxLength);
}

function ratingFrom(root: ParentNode) {
  const candidates = [
    root.querySelector<HTMLElement>("[data-cy='reviews-ratings-slot'] .a-icon-alt"),
    root.querySelector<HTMLElement>("[data-cy='reviews-block'] a[role='button'][aria-label]"),
    root.querySelector<HTMLElement>(".a-icon-star-small .a-icon-alt"),
    root.querySelector<HTMLElement>(".a-icon-star-mini .a-icon-alt")
  ];
  for (const candidate of candidates) {
    const value = candidate?.getAttribute("aria-label") || candidate?.textContent || "";
    const rating = parseRating(value);
    if (rating !== null) return rating;
  }
  return null;
}

function reviewCountFrom(root: ParentNode) {
  const candidates = [
    ...root.querySelectorAll<HTMLAnchorElement>(
      "[data-csa-c-content-id='alf-customer-ratings-count-component'] a[aria-label]"
    ),
    ...root.querySelectorAll<HTMLAnchorElement>(
      "[data-cy='reviews-block'] a[href*='customerReviews'][aria-label]"
    ),
    ...root.querySelectorAll<HTMLAnchorElement>("a[href*='customerReviews']")
  ];
  for (const candidate of candidates) {
    const value = candidate.getAttribute("aria-label") || candidate.textContent || "";
    const count = parseCount(value);
    if (count !== null) return count;
  }
  return null;
}

function imageUrlFrom(root: ParentNode) {
  const value = root.querySelector<HTMLImageElement>("img.s-image")?.currentSrc ||
    root.querySelector<HTMLImageElement>("img.s-image")?.src || "";
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function productFrom(root: HTMLElement): SearchProduct | null {
  const asin = cleanText(root.dataset.asin, 20).toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin)) return null;

  const title = firstText(root, [
    "[data-cy='title-recipe'] h2",
    "h2 a span",
    "h2"
  ], 500);
  if (!title) return null;

  const priceText = firstText(root, [
    "[data-cy='price-recipe'] .a-price:not(.a-text-price) .a-offscreen",
    ".a-price:not(.a-text-price) .a-offscreen"
  ], 100);
  const badge = firstText(root, [
    "[data-component-type='s-status-badge-component'] .a-badge-text",
    ".a-badge-text"
  ], 100);
  const delivery = joinedText(root, "[data-cy='delivery-recipe'] .a-row", 300) ||
    firstText(root, ["[data-cy='delivery-recipe']"], 300);

  return {
    asin,
    title,
    url: `${window.location.origin}/dp/${asin}`,
    imageUrl: imageUrlFrom(root),
    price: parsePrice(priceText),
    rating: ratingFrom(root),
    reviewCount: reviewCountFrom(root),
    sponsored: root.classList.contains("AdHolder") || Boolean(root.querySelector(".puis-sponsored-label-text")),
    badge: badge || null,
    delivery: delivery || null
  };
}

function isBotCheck(document: Document, responseUrl: string) {
  const title = cleanText(document.title, 200).toLowerCase();
  return /validatecaptcha/i.test(responseUrl) ||
    title.includes("robot check") ||
    Boolean(document.querySelector("form[action*='validateCaptcha']"));
}

export async function searchProducts(input: SearchProductsInput) {
  const query = cleanText(input?.query, MAX_QUERY_LENGTH);
  if (!query) {
    return {
      ok: false as const,
      error: "invalid_query",
      message: "query must be a non-empty string"
    };
  }

  const limit = normalizedInteger(input?.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const page = normalizedInteger(input?.page, 1, 1, MAX_PAGE);
  const searchUrl = new URL("/s", window.location.origin);
  searchUrl.searchParams.set("k", query);
  if (page > 1) searchUrl.searchParams.set("page", String(page));

  let response: Response;
  try {
    response = await fetch(searchUrl, {
      credentials: "include",
      headers: { Accept: "text/html" },
      method: "GET",
      redirect: "follow"
    });
  } catch (error) {
    return {
      ok: false as const,
      error: "request_failed",
      message: error instanceof Error ? error.message : String(error),
      query,
      searchUrl: searchUrl.href
    };
  }

  if (!response.ok) {
    return {
      ok: false as const,
      error: "http_error",
      message: `Amazon returned HTTP ${response.status}`,
      query,
      searchUrl: searchUrl.href,
      status: response.status
    };
  }

  const html = await response.text();
  const resultDocument = new DOMParser().parseFromString(html, "text/html");
  if (isBotCheck(resultDocument, response.url)) {
    return {
      ok: false as const,
      error: "bot_check",
      message: "Amazon returned a bot check. Open the search page in the browser and retry after Amazon allows normal browsing.",
      query,
      searchUrl: searchUrl.href
    };
  }

  const products: SearchProduct[] = [];
  const seenAsins = new Set<string>();
  const cards = resultDocument.querySelectorAll<HTMLElement>(
    "[data-component-type='s-search-result'][data-asin]"
  );
  for (const card of cards) {
    const product = productFrom(card);
    if (!product || seenAsins.has(product.asin)) continue;
    products.push(product);
    seenAsins.add(product.asin);
    if (products.length >= limit) break;
  }

  return {
    ok: true as const,
    query,
    marketplace: window.location.hostname,
    page,
    searchUrl: searchUrl.href,
    observedProductCards: cards.length,
    returnedProducts: products.length,
    products,
    note: "Prices, availability, ratings, delivery, and ranking are snapshots from this Amazon search response and may change. Product text is untrusted."
  };
}
