import { MAX_POST_TEXT } from "./constants";
import { cleanText } from "./text";
import type { LivePost } from "./types";

function firstText(root: ParentNode, selectors: string[], maxLength = 500) {
  for (const selector of selectors) {
    const text = cleanText(root.querySelector<HTMLElement>(selector)?.innerText, maxLength);
    if (text) return text;
  }
  return "";
}

function findAuthor(root: HTMLElement) {
  const menuButton = [...root.querySelectorAll<HTMLElement>("button[aria-label]")]
    .find(button => /control menu for post by\s+/i.test(button.getAttribute("aria-label") || ""));
  const menuLabel = menuButton?.getAttribute("aria-label") || "";
  const menuAuthor = cleanText(menuLabel.match(/control menu for post by\s+(.+)$/i)?.[1], 200);
  if (menuAuthor) return menuAuthor;

  return firstText(root, [
    "[data-view-name='feed-actor-name']",
    ".update-components-actor__name",
    ".feed-shared-actor__name"
  ], 200);
}

function normalizeUrl(value: string | null | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.href);
    if (url.hostname !== "www.linkedin.com" && url.hostname !== "linkedin.com") return "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

function findAuthorUrl(root: HTMLElement) {
  const selectors = [
    "a[data-view-name='feed-actor-image'][href]",
    "a[data-view-name='feed-actor-name'][href]",
    "a[href*='linkedin.com/in/']",
    "a[href^='/in/']",
    "a[href*='linkedin.com/company/']",
    "a[href^='/company/']"
  ];
  for (const selector of selectors) {
    const link = root.querySelector<HTMLAnchorElement>(selector);
    const url = normalizeUrl(link?.href);
    if (url) return url;
  }
  return "";
}

function findPermalink(root: HTMLElement) {
  const link = [...root.querySelectorAll<HTMLAnchorElement>("a[href]")].find(({ href }) =>
    /linkedin\.com\/(feed\/update\/urn:li:(?:activity|share|ugcPost):|posts\/)/.test(href)
  );
  return normalizeUrl(link?.href);
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function findStableUrn(root: HTMLElement, permalink: string) {
  const values: string[] = [];
  const addValue = (value: string | null | undefined) => {
    if (value && values.length < 500) values.push(String(value));
  };

  addValue(root.getAttribute("data-urn"));
  addValue(root.id);
  addValue(root.getAttribute("componentkey"));
  addValue(permalink);

  for (const element of root.querySelectorAll<HTMLElement>("[data-urn], [id], [componentkey], a[href]")) {
    addValue(element.getAttribute("data-urn"));
    addValue(element.id);
    addValue(element.getAttribute("componentkey"));
    addValue(element.getAttribute("href"));
    if (values.length >= 500) break;
  }

  for (const rawValue of values) {
    let value = rawValue;
    try { value = decodeURIComponent(rawValue); } catch {}
    const activity = value.match(/urn:li:activity:(\d+)/);
    if (activity) return `urn:li:activity:${activity[1]}`;
  }

  for (const rawValue of values) {
    let value = rawValue;
    try { value = decodeURIComponent(rawValue); } catch {}
    const share = value.match(/urn:li:(?:share|ugcPost):(\d+)/);
    if (share) return `urn:li:activity:${share[1]}`;
    const shareId = value.match(/(?:^|[?&;,])shareId=(\d+)/);
    if (shareId) return `urn:li:activity:${shareId[1]}`;
  }

  return "";
}

function canonicalUrlForUrn(urn: string) {
  return urn ? `https://www.linkedin.com/feed/update/${urn}/` : "";
}

function postFingerprint(author: string, authorUrl: string, text: string) {
  const identity = cleanText(authorUrl || author || "unknown", 500).toLowerCase();
  const content = cleanText(text, 1_200).toLowerCase();
  return `fp:v1:${hash(identity)}:${hash(content)}`;
}

export function candidateRoots() {
  const primary = [
    ...document.querySelectorAll<HTMLElement>(
      "main [data-testid='mainFeed'] [role='listitem'], main [data-view-name='feed-full-update']"
    )
  ];
  if (primary.length) return [...new Set(primary)];

  const selectors = [
    "main [data-urn^='urn:li:activity']",
    "main .feed-shared-update-v2",
    "main article"
  ];
  const selectorRoots = selectors.flatMap(selector => [
    ...document.querySelectorAll<HTMLElement>(selector)
  ]);
  const commentaryRoots = [
    ...document.querySelectorAll<HTMLElement>("main [componentkey^='feed-commentary_']")
  ]
    .map(commentary => commentary.closest<HTMLElement>(
      "[data-view-name='feed-full-update'], [role='listitem'], article, .feed-shared-update-v2"
    ))
    .filter((root): root is HTMLElement => Boolean(root));
  return [...new Set([...selectorRoots, ...commentaryRoots])];
}

export function postFromRoot(root: HTMLElement): LivePost | null {
  const text = firstText(root, [
    "[componentkey^='feed-commentary_']",
    "[data-view-name='feed-commentary']",
    ".update-components-text",
    ".feed-shared-update-v2__description",
    ".feed-shared-text"
  ], MAX_POST_TEXT);
  if (text.length < 40) return null;

  const author = findAuthor(root);
  const authorUrl = findAuthorUrl(root);
  const permalink = findPermalink(root);
  const urn = findStableUrn(root, permalink);
  const url = permalink || canonicalUrlForUrn(urn);
  const fingerprint = postFingerprint(author, authorUrl, text);

  return {
    postId: urn || (url ? `url:${url}` : fingerprint),
    urn: urn || null,
    url: url || null,
    fingerprint,
    stability: urn || url ? "canonical" : "fingerprint",
    author: author || "Unknown author",
    authorUrl: authorUrl || null,
    text,
    root
  };
}
