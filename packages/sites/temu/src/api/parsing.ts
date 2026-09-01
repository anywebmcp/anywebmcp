const PRODUCT_ID_QUERY_KEYS = ["goods_id", "goodsId", "product_id", "productId"];
const TRACKING_QUERY_KEYS = [
  "_bg_fs",
  "_p_rfs",
  "refer_page_el_sn",
  "refer_page_id",
  "refer_page_name",
  "refer_page_sn",
  "search_key",
  "search_method",
  "search_type"
];

const CURRENCY_BY_SYMBOL: Record<string, string> = {
  "€": "EUR",
  "$": "USD",
  "£": "GBP",
  "¥": "CNY",
  "₹": "INR",
  "₩": "KRW",
  "₺": "TRY",
  "₽": "RUB",
  "₴": "UAH"
};

const CURRENCY_TOKEN = "(?:EUR|USD|GBP|CAD|AUD|NZD|CNY|JPY|INR|KRW|PLN|CZK|HUF|RON|SEK|NOK|DKK|CHF|TRY|RUB|UAH|AED|SAR|MXN|BRL|€|\\$|£|¥|₹|₩|₺|₽|₴|zł|Kč|Ft|lei|kr)";
const NUMBER_TOKEN = "(?:\\d{1,3}(?:[\\s.,']\\d{3})+|\\d+)(?:[.,]\\d{1,2})?";
const MONEY_PATTERN = new RegExp(`(${CURRENCY_TOKEN})\\s*(${NUMBER_TOKEN})|(${NUMBER_TOKEN})\\s*(${CURRENCY_TOKEN})`, "gi");

export type Money = {
  amount: number;
  currency: string | null;
  formatted: string;
};

export function cleanText(value: unknown, maxLength = 2_000) {
  return String(value ?? "")
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function isTemuHostname(hostname: string) {
  const value = hostname.toLowerCase().replace(/\.$/, "");
  return value === "temu.com" || value.endsWith(".temu.com");
}

export function normalizeTemuUrl(
  value: string | null | undefined,
  base = typeof window === "undefined" ? "https://www.temu.com/" : window.location.href
) {
  if (!value) return "";
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" || !isTemuHostname(url.hostname)) return "";
    url.hash = "";
    for (const key of TRACKING_QUERY_KEYS) url.searchParams.delete(key);
    return url.href;
  } catch {
    return "";
  }
}

export function productIdFromUrl(value: string | null | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value, "https://www.temu.com/");
    for (const key of PRODUCT_ID_QUERY_KEYS) {
      const id = url.searchParams.get(key)?.match(/\d{6,}/)?.[0];
      if (id) return id;
    }

    const pathPatterns = [
      /-g-(\d{6,})(?:\.html)?(?:[/?]|$)/i,
      /\/goods\/(\d{6,})(?:[/?]|$)/i,
      /\/product\/(\d{6,})(?:[/?]|$)/i
    ];
    for (const pattern of pathPatterns) {
      const id = url.pathname.match(pattern)?.[1];
      if (id) return id;
    }
  } catch {}
  return "";
}

function currencyCode(token: string) {
  const normalized = token.trim();
  if (CURRENCY_BY_SYMBOL[normalized]) return CURRENCY_BY_SYMBOL[normalized];
  if (normalized === "zł") return "PLN";
  if (normalized === "Kč") return "CZK";
  if (normalized === "Ft") return "HUF";
  if (normalized === "lei") return "RON";
  if (normalized === "kr") return null;
  return normalized.toUpperCase();
}

function numericAmount(raw: string) {
  let value = raw.replace(/[\s']/g, "");
  const comma = value.lastIndexOf(",");
  const dot = value.lastIndexOf(".");
  const decimal = Math.max(comma, dot);

  if (comma >= 0 && dot >= 0) {
    const separator = comma > dot ? "," : ".";
    value = value.replace(separator === "," ? /\./g : /,/g, "");
    value = value.replace(separator, ".");
  } else if (decimal >= 0) {
    const digitsAfter = value.length - decimal - 1;
    if (digitsAfter === 1 || digitsAfter === 2) {
      value = `${value.slice(0, decimal).replace(/[.,]/g, "")}.${value.slice(decimal + 1)}`;
    } else {
      value = value.replace(/[.,]/g, "");
    }
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function parseMoneyCandidates(value: unknown, limit = 6): Money[] {
  const text = cleanText(value, 10_000);
  const results: Money[] = [];
  MONEY_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(MONEY_PATTERN)) {
    const currency = match[1] || match[4] || "";
    const rawAmount = match[2] || match[3] || "";
    const amount = numericAmount(rawAmount);
    if (amount === null || amount < 0) continue;
    const formatted = cleanText(match[0], 80);
    if (results.some(result => result.amount === amount && result.currency === currencyCode(currency))) continue;
    results.push({ amount, currency: currencyCode(currency), formatted });
    if (results.length >= limit) break;
  }
  return results;
}

export function moneyFromOffer(value: unknown, currencyValue?: unknown): Money | null {
  if (typeof value === "string") {
    const parsed = parseMoneyCandidates(value, 1)[0];
    if (parsed) return parsed;
    const amount = numericAmount(value);
    const currency = cleanText(currencyValue, 8).toUpperCase() || null;
    return amount === null || !currency ? null : { amount, currency, formatted: `${amount} ${currency}` };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const currency = cleanText(currencyValue, 8).toUpperCase() || null;
    return currency ? { amount: value, currency, formatted: `${value} ${currency}` } : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return moneyFromOffer(
      record.amount ?? record.value ?? record.price,
      record.currency ?? record.currencyCode ?? currencyValue
    );
  }
  return null;
}

export function parseRating(value: unknown) {
  const text = cleanText(value, 5_000);
  const patterns = [
    /(?:rating|rated)\s*[:\-]?\s*([0-5](?:[.,]\d{1,2})?)/i,
    /([0-5](?:[.,]\d{1,2})?)\s*(?:out of 5|stars?|★|⭐)/i,
    /([0-5](?:[.,]\d{1,2})?)\s*\/\s*5/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const rating = Number(match[1].replace(",", "."));
    if (rating >= 0 && rating <= 5) return rating;
  }
  return null;
}

export function parseReviewCount(value: unknown) {
  const text = cleanText(value, 5_000);
  const match = text.match(/((?:\d{1,3}(?:[.,\s]\d{3})+|\d+(?:[.,]\d+)?)\s*[kKmM]?)\s*(?:reviews?|ratings?|отзыв(?:ов|а)?|Bewertungen?|avis|recensioni)/i);
  if (!match) return null;
  const compact = match[1].replace(/[\s,]/g, "");
  const suffix = compact.slice(-1).toLowerCase();
  const numeric = Number.parseFloat(compact);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * (suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : 1));
}

export function isSecurityVerification(
  value: unknown,
  urlValue = typeof window === "undefined" ? "" : window.location.href
) {
  const text = cleanText(value, 10_000).toLowerCase();
  try {
    const url = new URL(urlValue);
    if (/\/(?:bgn_)?verification\.html$/i.test(url.pathname) || url.searchParams.has("verifyCode")) return true;
  } catch {}
  return [
    "security verification",
    "slide to complete the puzzle",
    "complete the verification to continue"
  ].some(marker => text.includes(marker));
}

export function isAuthenticationRequired(
  value: unknown,
  urlValue = typeof window === "undefined" ? "" : window.location.href
) {
  const text = cleanText(value, 10_000).toLowerCase();
  try {
    const url = new URL(urlValue);
    if (/\/login\.html$/i.test(url.pathname)) return true;
  } catch {}
  return text.includes("sign in / register") &&
    (text.includes("email or phone number") || text.includes("trouble signing in"));
}

export function currentSearchQuery(urlValue = window.location.href) {
  try {
    const url = new URL(urlValue);
    return cleanText(
      url.searchParams.get("search_key") ??
      url.searchParams.get("search_query") ??
      url.searchParams.get("q"),
      300
    );
  } catch {
    return "";
  }
}

export function searchUrl(query: string) {
  const url = new URL("/search_result.html", window.location.origin);
  url.searchParams.set("search_key", cleanText(query, 300));
  return url.href;
}
