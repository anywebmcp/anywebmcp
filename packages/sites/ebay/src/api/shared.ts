import type { ItemReference, Money } from "./types";

export const MAX_SEARCH_RESULTS = 50;
export const MAX_BATCH_ITEMS = 10;
export const MAX_ITEM_SPECIFICS = 100;
export const MAX_TEXT = 12_000;

export class EbayError extends Error {}

export function cleanText(value: unknown, maxLength = MAX_TEXT) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function cleanEncodedText(value: unknown, maxLength = MAX_TEXT) {
  const raw = String(value ?? "");
  if (!/&(?:#\d+|#x[\da-f]+|[a-z]+);/i.test(raw)) return cleanText(raw, maxLength);
  const parsed = new DOMParser().parseFromString(`<!doctype html><html><body>${raw}</body></html>`, "text/html");
  return cleanText(parsed.body?.textContent, maxLength);
}

export function textOf(root: ParentNode, selector: string, maxLength = 1_000) {
  const element = root.querySelector<HTMLElement>(selector);
  return cleanText(element?.innerText || element?.textContent, maxLength);
}

export function ebayHost(hostname = window.location.hostname) {
  return /(^|\.)ebay\.(com|co\.uk|de|fr|it|es|ca|com\.au)$/i.test(hostname);
}

export function cleanItemUrl(value: string): ItemReference {
  const url = new URL(value, window.location.href);
  if (!ebayHost(url.hostname)) throw new EbayError("The item URL must belong to a supported eBay site.");
  const itemId = url.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})(?:[/?]|$)/)?.[1];
  if (!itemId) throw new EbayError("The eBay item URL does not contain a valid item ID.");
  return { itemId, url: `${url.origin}/itm/${itemId}` };
}

export function cleanItemUrlIfPresent(value: string) {
  try {
    return cleanItemUrl(value);
  } catch {
    return null;
  }
}

export function itemReference(value: string): ItemReference {
  const trimmed = cleanText(value, 2_000);
  if (/^\d{9,15}$/.test(trimmed)) {
    return { itemId: trimmed, url: `${window.location.origin}/itm/${trimmed}` };
  }
  return cleanItemUrl(trimmed);
}

export function defaultCurrency() {
  const host = window.location.hostname;
  if (/ebay\.co\.uk$/i.test(host)) return "GBP";
  if (/ebay\.(de|fr|it|es)$/i.test(host)) return "EUR";
  if (/ebay\.ca$/i.test(host)) return "CAD";
  if (/ebay\.com\.au$/i.test(host)) return "AUD";
  return "USD";
}

export function parseMoney(value: unknown, currencyHint = defaultCurrency()): Money | null {
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

export function canonicalItemUrl(link: HTMLAnchorElement | null, itemId: string) {
  if (!link) return `${window.location.origin}/itm/${itemId}`;
  try {
    const url = new URL(link.href, window.location.href);
    return `${url.origin}/itm/${itemId}`;
  } catch {
    return `${window.location.origin}/itm/${itemId}`;
  }
}

export function titleWithoutAccessibilitySuffix(value: unknown) {
  return cleanText(value, 1_000).replace(/\s*Opens in a new window or tab\s*$/i, "").trim();
}

export function isSignInDocument(documentRoot: Document, responseUrl: string) {
  return /signin\.ebay\./i.test(responseUrl)
    || /sign in or register/i.test(cleanText(documentRoot.title, 200))
    || Boolean(documentRoot.querySelector("form[action*='SignIn'], input[name='userid']"));
}

export function isChallengeDocument(documentRoot: Document, responseUrl: string) {
  const title = cleanText(documentRoot.title, 300);
  const body = cleanText(documentRoot.body?.textContent, 2_000);
  return /\/splashui\/challenge|captcha|challenge/i.test(responseUrl)
    || /^(?:Error Page|Security Measure)\s*\|\s*eBay$/i.test(title)
    || /pardon our interruption|verify (?:that )?you are human|security measure/i.test(body);
}

export async function fetchDocument(url: URL) {
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
