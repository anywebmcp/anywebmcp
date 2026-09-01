import { MAX_POST_TEXT } from "./types";

export const delay = (milliseconds: number) =>
  new Promise<void>(resolve => window.setTimeout(resolve, milliseconds));

export function cleanText(value: unknown, maxLength = MAX_POST_TEXT) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
    .slice(0, maxLength);
}

export function compactText(value: unknown, maxLength = 500) {
  return cleanText(value, maxLength).replace(/\s+/g, " ");
}

export function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

export function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export function deepQueryAll<T extends Element = HTMLElement>(
  selector: string,
  root: Document | ShadowRoot | Element = document
) {
  const results: T[] = [];
  const roots: Array<Document | ShadowRoot | Element> = [root];
  const visited = new Set<Document | ShadowRoot | Element>();
  if (root instanceof Element && root.shadowRoot) roots.push(root.shadowRoot);

  while (roots.length && visited.size < 500) {
    const current = roots.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    results.push(...current.querySelectorAll<T>(selector));
    for (const element of current.querySelectorAll<HTMLElement>("*")) {
      if (element.shadowRoot) roots.push(element.shadowRoot);
    }
  }

  return unique(results);
}

export function firstText(root: Document | ShadowRoot | Element, selectors: string[], maxLength = 500) {
  for (const selector of selectors) {
    const element = deepQueryAll<HTMLElement>(selector, root)[0];
    const value = cleanText(element?.innerText ?? element?.textContent, maxLength);
    if (value) return value;
  }
  return "";
}

export function firstAttribute(root: Element, names: string[]) {
  for (const name of names) {
    const value = compactText(root.getAttribute(name), 1_000);
    if (value) return value;
  }
  return "";
}

export function normalizePermalink(value: string | null | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.href);
    if (!/(^|\.)reddit\.com$/i.test(url.hostname)) return "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

export function fullname(value: unknown, prefix?: "t1" | "t3") {
  const match = String(value ?? "").match(/\b(t[13]_[a-z0-9]+)\b/i);
  if (!match) return "";
  const result = match[1].toLowerCase();
  return !prefix || result.startsWith(`${prefix}_`) ? result : "";
}

export function postIdFromPermalink(value: string) {
  const match = value.match(/\/comments\/([a-z0-9]+)(?:\/|$)/i);
  return match ? `t3_${match[1].toLowerCase()}` : "";
}

export function commentIdFromPermalink(value: string) {
  const match = value.match(/\/comments\/[a-z0-9]+\/comment\/([a-z0-9]+)(?:\/|$)/i) ||
    value.match(/\/comments\/[a-z0-9]+\/[^/]+\/([a-z0-9]+)(?:\/|$)/i);
  return match ? `t1_${match[1].toLowerCase()}` : "";
}

export function parseCount(value: unknown): number | null {
  const text = compactText(value, 100).toLowerCase().replace(/,/g, "");
  if (!text || /^(vote|score hidden|—|-)$/.test(text)) return null;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  let result = Number(match[0]);
  if (!Number.isFinite(result)) return null;
  if (/\bk\b|k$/.test(text)) result *= 1_000;
  if (/\bm\b|m$/.test(text)) result *= 1_000_000;
  return Math.round(result);
}

export function subredditFromPath(pathname = window.location.pathname) {
  const match = pathname.match(/^\/(?:r|mod)\/([^/]+)/i);
  return match ? `r/${decodeURIComponent(match[1])}` : null;
}

export function isVisible(element: HTMLElement | null) {
  if (!element?.isConnected) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function waitForDomActivity(timeoutMs = 700) {
  return new Promise<void>(resolve => {
    let finished = false;
    let quietTimer = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      window.clearTimeout(quietTimer);
      window.clearTimeout(maximumTimer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      window.clearTimeout(quietTimer);
      quietTimer = window.setTimeout(finish, Math.min(250, timeoutMs));
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const maximumTimer = window.setTimeout(finish, timeoutMs);
    quietTimer = window.setTimeout(finish, Math.min(250, timeoutMs));
  });
}

export function composedAncestor(element: Element | null, selector: string): Element | null {
  let current: Element | null = element;
  while (current) {
    if (current.matches(selector)) return current;
    const root = current.getRootNode();
    current = current.parentElement || (root instanceof ShadowRoot ? root.host : null);
  }
  return null;
}
