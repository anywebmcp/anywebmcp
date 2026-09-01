import { cleanItemUrlIfPresent, cleanText, EbayError } from "./shared";
import type { SetWatchStateInput } from "./types";

export function watchState(control: Element): boolean | null {
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

function visiblyMounted(control: HTMLElement) {
  for (let element: HTMLElement | null = control; element; element = element.parentElement) {
    if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
    const style = typeof window.getComputedStyle === "function" ? window.getComputedStyle(element) : null;
    if (style?.display === "none" || style?.visibility === "hidden" || style?.visibility === "collapse") return false;
  }
  return true;
}

export function findWatchControl(itemId: string, documentRoot: Document = document, assumeItemPage = false) {
  const current = cleanItemUrlIfPresent(documentRoot.location?.href ?? window.location.href);
  const searchRoot = documentRoot.querySelector(`[data-listingid="${CSS.escape(itemId)}"], [data-itemid="${CSS.escape(itemId)}"]`);
  const scope = searchRoot ?? (assumeItemPage || current?.itemId === itemId ? documentRoot.querySelector("main") : null);
  if (!scope) return null;
  return [...scope.querySelectorAll<HTMLElement>(
    ".s-card__watchheart-click, .s-item__watchheart a, button[aria-label], a[aria-label], a[href*='WatchList']"
  )].find(element => {
    const label = cleanText(`${element.getAttribute("aria-label")} ${element.getAttribute("href")} ${element.textContent}`, 2_000);
    return /watch/i.test(label) && visiblyMounted(element);
  }) ?? null;
}

export function signedIn(documentRoot: Document = document) {
  return !documentRoot.querySelector("header a[href*='SignIn'][href*='sgfl=gh'], [role='banner'] a[href*='SignIn'][href*='sgfl=gh']");
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
