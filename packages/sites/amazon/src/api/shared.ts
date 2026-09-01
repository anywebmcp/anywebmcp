export type AmazonPrice = {
  display: string;
  amount: number | null;
  currency: string | null;
};

export type AmazonFailure = {
  ok: false;
  error: string;
  message: string;
  status?: number;
};

const CURRENCY_CODES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "INR", "BRL", "MXN", "AED",
  "SAR", "TRY", "SEK", "PLN", "SGD", "EGP", "ZAR"
];

export function cleanText(value: unknown, maxLength = 1_000) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function elementText(element: Element | null | undefined, maxLength = 1_000) {
  if (!element) return "";
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll(
    "script, style, noscript, template, .a-popover-preload, .aok-hidden, .a-hidden, [aria-hidden='true']"
  ).forEach(child => child.remove());
  return cleanText(clone.textContent, maxLength);
}

export function firstText(root: ParentNode, selectors: string[], maxLength = 1_000) {
  for (const selector of selectors) {
    const text = elementText(root.querySelector(selector), maxLength);
    if (text) return text;
  }
  return "";
}

export function normalizedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function normalizeAsin(value: unknown) {
  const asin = cleanText(value, 20).toUpperCase();
  return /^[A-Z0-9]{10}$/.test(asin) ? asin : null;
}

export function parseRating(value: string) {
  const match = value.match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const rating = Number(match[0].replace(",", "."));
  return Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : null;
}

export function parseCount(value: string) {
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
  if (/\bfree\b/i.test(display)) return 0;
  const numeric = display.replace(/[\u00a0\s'’]/g, "").match(/\d[\d.,]*/)?.[0];
  if (!numeric) return null;
  const lastComma = numeric.lastIndexOf(",");
  const lastDot = numeric.lastIndexOf(".");
  const separatorIndex = Math.max(lastComma, lastDot);
  const normalized = separatorIndex >= 0 && numeric.length - separatorIndex - 1 === 2
    ? `${numeric.slice(0, separatorIndex).replace(/[.,]/g, "")}.${numeric.slice(separatorIndex + 1)}`
    : numeric.replace(/[.,]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export function parsePrice(value: string): AmazonPrice | null {
  const display = cleanText(value, 120);
  if (!display) return null;
  return { display, amount: amountFrom(display), currency: currencyFrom(display) };
}

export function isBotCheck(document: Document, responseUrl: string) {
  const title = cleanText(document.title, 200).toLowerCase();
  return /validatecaptcha/i.test(responseUrl) ||
    title.includes("robot check") ||
    Boolean(document.querySelector("form[action*='validateCaptcha']"));
}

export async function fetchAmazonDocument(path: string) {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin) {
    return { ok: false as const, error: "invalid_url", message: "Amazon request must stay on the current marketplace." };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      credentials: "include",
      headers: { Accept: "text/html" },
      method: "GET",
      redirect: "follow"
    });
  } catch (error) {
    return {
      ok: false as const,
      error: "request_failed",
      message: error instanceof Error ? error.message : String(error)
    };
  }

  if (!response.ok) {
    return {
      ok: false as const,
      error: "http_error",
      message: `Amazon returned HTTP ${response.status}`,
      status: response.status
    };
  }

  const document = new DOMParser().parseFromString(await response.text(), "text/html");
  if (isBotCheck(document, response.url)) {
    return {
      ok: false as const,
      error: "bot_check",
      message: "Amazon returned a bot check. Open the requested page in the browser and retry after Amazon allows normal browsing."
    };
  }

  if (/\/ap\/signin/i.test(response.url)) {
    return {
      ok: false as const,
      error: "sign_in_required",
      message: "Amazon redirected this request to sign-in."
    };
  }

  return { ok: true as const, document, url: response.url || url.href };
}
