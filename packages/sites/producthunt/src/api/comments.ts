import { canonicalUrl, clampInteger, cleanMultilineText, cleanText, parseCount } from "./shared";

export type ListCommentsInput = {
  offset?: number;
  limit?: number;
  topLevelOnly?: boolean;
};

function commentUrl(id: string) {
  const url = new URL(location.href);
  url.searchParams.set("comment", id);
  url.hash = "";
  return url.href;
}

function commentThreads(comment: HTMLElement, root: HTMLElement) {
  const ids: string[] = [];
  let current = comment.parentElement;
  while (current && current !== root) {
    const match = current.getAttribute("data-test")?.match(/^thread-(\d+)$/);
    if (match) ids.push(match[1]);
    current = current.parentElement;
  }
  return ids;
}

function readComment(comment: HTMLElement, root: HTMLElement) {
  const id = comment.id.slice("comment-".length);
  const authorLink = Array.from(comment.querySelectorAll<HTMLAnchorElement>('a[href^="/@"]'))
    .find(link => cleanText(link.textContent, 100));
  const authorHeader = authorLink?.closest("button")?.parentElement;
  const companyLink = authorHeader?.querySelector<HTMLAnchorElement>('a[href^="/products/"]');
  const avatar = comment.querySelector<HTMLImageElement>('a[data-test^="user-image-link-"] img');
  const body = comment.querySelector<HTMLElement>(".prose");
  const time = comment.querySelector("time");
  const threads = commentThreads(comment, root);
  const parentId = threads.find(threadId => threadId !== id) ?? null;
  const voteButton = comment.querySelector<HTMLButtonElement>('button[data-test="action-bar-vote-button"]');
  const voteText = cleanText(voteButton?.textContent, 100);

  return {
    id,
    parentId,
    depth: Math.max(0, threads.length - 1),
    url: commentUrl(id),
    author: {
      name: cleanText(authorLink?.textContent, 100),
      handle: authorLink?.getAttribute("href")?.slice(2).split(/[/?#]/, 1)[0] ?? "",
      url: canonicalUrl(authorLink?.getAttribute("href") ?? ""),
      avatarUrl: avatar?.currentSrc || avatar?.src || ""
    },
    text: cleanMultilineText(body?.innerText ?? body?.textContent, 10_000),
    upvotesCount: parseCount(voteText) ?? 0,
    createdAt: time?.getAttribute("datetime") ?? "",
    relativeTime: cleanText(time?.textContent, 100),
    isMaker: Boolean(companyLink),
    makerProduct: companyLink ? {
      name: cleanText(companyLink.textContent, 100),
      url: canonicalUrl(companyLink.getAttribute("href") ?? "")
    } : null,
    isPinned: cleanText(authorHeader?.textContent, 300).includes("📌"),
    isVerified: Boolean(comment.querySelector(`[id="comment-${id}-verified-trigger"]`))
  };
}

function pagination(root: HTMLElement) {
  const currentPage = Math.max(1, Number.parseInt(new URL(location.href).searchParams.get("page") ?? "1", 10) || 1);
  const pageUrls = new Map<number, string>();
  pageUrls.set(currentPage, location.href);

  for (const link of Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href*="page="]'))) {
    try {
      const url = new URL(link.href, location.origin);
      const page = Number.parseInt(url.searchParams.get("page") ?? "", 10);
      if (Number.isInteger(page) && page > 0) pageUrls.set(page, url.href);
    } catch {}
  }

  const pages = Array.from(pageUrls.keys()).sort((a, b) => a - b);
  return {
    currentPage,
    visiblePages: pages,
    previousPageUrl: pageUrls.get(currentPage - 1) ?? null,
    nextPageUrl: pageUrls.get(currentPage + 1) ?? null
  };
}

export function listComments(input: ListCommentsInput = {}) {
  const root = document.querySelector<HTMLElement>("#comments");
  if (!root) {
    return {
      ok: false,
      pageUrl: location.href,
      count: 0,
      comments: [],
      error: "Open a Product Hunt product launch with comments before calling producthunt_list_comments."
    };
  }

  const mounted = Array.from(root.querySelectorAll<HTMLElement>('[id^="comment-"][data-test^="comment-"]'))
    .filter(comment => /^comment-\d+$/.test(comment.id) && comment.getAttribute("data-test") === comment.id)
    .map(comment => readComment(comment, root));
  const topLevelOnly = input.topLevelOnly ?? false;
  const filtered = topLevelOnly ? mounted.filter(comment => comment.depth === 0) : mounted;
  const offset = clampInteger(input.offset, 0, 0, 1_000);
  const limit = clampInteger(input.limit, 20, 1, 50);
  const comments = filtered.slice(offset, offset + limit);

  return {
    ok: true,
    pageUrl: location.href,
    ...pagination(root),
    topLevelOnly,
    offset,
    limit,
    count: comments.length,
    totalMatched: filtered.length,
    totalMounted: mounted.length,
    comments
  };
}
