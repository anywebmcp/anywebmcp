import {
  compactText,
  deepQueryAll,
  firstAttribute,
  firstText,
  fullname,
  hash,
  normalizePermalink,
  parseCount,
  postIdFromPermalink,
  subredditFromPath,
  waitForDomActivity
} from "./dom-helpers";
import { accessFailure, failure, unexpectedFailure } from "./errors";
import { pageContext } from "./page-context";
import { registeredPost, rememberPost } from "./registry";
import {
  MAX_COLLECTION_LIMIT,
  MAX_COLLECTION_SCROLLS,
  MAX_POST_TEXT,
  type CollectListingInput,
  type LivePost,
  type PostSnapshot
} from "./types";

export function candidatePostRoots() {
  return deepQueryAll<HTMLElement>([
    "shreddit-post",
    "search-telemetry-tracker[data-testid='search-sdui-post']",
    "article[data-testid='post-container']",
    "div[data-testid='post-container']",
    ".Post",
    ".thing.link"
  ].join(","));
}

function isPromotedPost(root: HTMLElement) {
  const attributes = ["promoted", "is-promoted", "data-promoted", "ad-click-location"];
  if (attributes.some(name => root.hasAttribute(name))) return true;
  const marker = firstText(root, ["[slot='promoted-label']", "[data-testid='promoted-label']", ".promoted-tag"], 100);
  return /^(promoted|sponsored|реклама)$/i.test(marker);
}

function permalinkFromRoot(root: HTMLElement) {
  const attribute = firstAttribute(root, ["permalink", "data-permalink"]);
  if (attribute) return normalizePermalink(attribute);
  const link = deepQueryAll<HTMLAnchorElement>("a[href*='/comments/']", root)[0];
  return normalizePermalink(link?.href);
}

type SearchTrackingContext = {
  post?: {
    id?: unknown;
    nsfw?: unknown;
    spoiler?: unknown;
    title?: unknown;
  };
  profile?: { name?: unknown };
  subreddit?: { name?: unknown };
};

function searchTrackingContext(root: HTMLElement): SearchTrackingContext | null {
  const value = root.getAttribute("data-faceplate-tracking-context");
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as SearchTrackingContext : null;
  } catch {
    return null;
  }
}

function cleanTrackingValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? compactText(value, maxLength) : "";
}

function trackingSubreddit(value: unknown) {
  const name = cleanTrackingValue(value, 200).replace(/^r\//i, "");
  return name ? `r/${name}` : "";
}

function subredditFromRoot(root: HTMLElement, tracking: SearchTrackingContext | null) {
  const attribute = firstAttribute(root, ["subreddit-prefixed-name", "subreddit-name"]);
  if (attribute) return attribute;
  const tracked = trackingSubreddit(tracking?.subreddit?.name);
  if (tracked) return tracked;
  const labelled = firstText(root, ["[data-testid='subreddit-name']"], 200);
  if (labelled) return labelled;
  for (const link of deepQueryAll<HTMLAnchorElement>("a[href^='/r/']", root)) {
    try {
      const match = new URL(link.href, window.location.href).pathname.match(/^\/r\/([^/]+)\/?$/i);
      if (match) return `r/${decodeURIComponent(match[1])}`;
    } catch {
      // Ignore malformed page-provided links and keep looking for a community root.
    }
  }
  return subredditFromPath() || "";
}

function searchCounterValues(root: HTMLElement) {
  const text = firstText(root, ["[data-testid='search-counter-row']"], 200);
  const values = text.match(/-?\d+(?:[.,]\d+)?\s*[km]?/gi) || [];
  return {
    score: values[0] || "",
    comments: values[1] || ""
  };
}

function postFromRoot(root: HTMLElement): LivePost | null {
  if (isPromotedPost(root)) return null;
  const tracking = searchTrackingContext(root);
  const permalink = permalinkFromRoot(root);
  const rawId = [
    root.id,
    firstAttribute(root, ["thing-id", "post-id", "data-fullname", "data-post-id", "data-thingid"]),
    tracking?.post?.id,
    permalink
  ].find(value => fullname(value, "t3"));
  const stableId = fullname(rawId, "t3") || postIdFromPermalink(permalink);
  const title = firstAttribute(root, ["post-title", "data-title"]) || firstText(root, [
    "[slot='title']",
    "[data-testid='post-title']",
    "h1",
    "h2",
    "h3",
    ".title a.title"
  ], 1_000) || cleanTrackingValue(tracking?.post?.title, 1_000);
  const body = firstText(root, [
    "[slot='text-body']",
    "[data-post-click-location='text-body']",
    "[data-testid='post-content']",
    ".usertext-body .md",
    ".expando .md"
  ], MAX_POST_TEXT);
  if (!title && !body) return null;

  const authorValue = firstAttribute(root, ["author", "data-author"]) || firstText(root, [
    "[data-testid='post_author_link']",
    "a[href*='/user/']",
    "a[href*='/u/']",
    ".author"
  ], 200) || cleanTrackingValue(tracking?.profile?.name, 200);
  const subreddit = subredditFromRoot(root, tracking);
  const searchCounters = searchCounterValues(root);
  const scoreValue = firstAttribute(root, ["score", "data-score"]) || firstText(root, [
    "[slot='vote-button'] [aria-label*='upvote']",
    "[data-testid='post-container'] [id*='vote-arrows']",
    ".score"
  ], 100) || searchCounters.score;
  const commentsValue = firstAttribute(root, ["comment-count", "data-comment-count", "num-comments"]) || firstText(root, [
    "a[href*='/comments/'] [slot='comment-count']",
    "[data-click-id='comments']",
    ".comments"
  ], 100) || searchCounters.comments;
  const createdAt = firstAttribute(root, ["created-timestamp", "created", "data-timestamp"]) ||
    deepQueryAll<HTMLTimeElement>("time[datetime]", root)[0]?.dateTime || null;
  const fingerprint = `fp:v1:${hash(`${subreddit}|${authorValue}|${title}|${body.slice(0, 1_000)}`.toLowerCase())}`;
  const postId = stableId || (permalink ? `url:${permalink}` : fingerprint);
  const rect = root.getBoundingClientRect();

  return {
    postId,
    stability: stableId ? "fullname" : permalink ? "permalink" : "fingerprint",
    permalink: permalink || null,
    subreddit: subreddit || null,
    author: authorValue || null,
    title,
    body,
    postType: firstAttribute(root, ["post-type", "type"]) || null,
    createdAt,
    score: parseCount(scoreValue),
    commentCount: parseCount(commentsValue),
    nsfw: root.hasAttribute("nsfw") || root.hasAttribute("is-nsfw") || /\bnsfw\b/i.test(root.className) || tracking?.post?.nsfw === true,
    spoiler: root.hasAttribute("spoiler") || root.hasAttribute("is-spoiler") || /\bspoiler\b/i.test(root.className) || tracking?.post?.spoiler === true,
    truncated: false,
    fingerprint,
    lastSeenY: Math.max(0, Math.round(window.scrollY + rect.top)),
    lastSeenAt: Date.now(),
    root
  };
}

export function publicPost(post: LivePost | PostSnapshot, preview = false) {
  const body = preview ? post.body.slice(0, 1_000) : post.body;
  return {
    postId: post.postId,
    stability: post.stability,
    permalink: post.permalink,
    subreddit: post.subreddit,
    author: post.author,
    title: post.title,
    body,
    postType: post.postType,
    createdAt: post.createdAt,
    score: post.score,
    commentCount: post.commentCount,
    nsfw: post.nsfw,
    spoiler: post.spoiler,
    truncated: body.length < post.body.length
  };
}

export function scanPosts() {
  const posts = new Map<string, LivePost>();
  for (const root of candidatePostRoots()) {
    const post = postFromRoot(root);
    if (!post || posts.has(post.postId)) continue;
    rememberPost(post);
    posts.set(post.postId, post);
  }
  return [...posts.values()];
}

export function currentThreadPost() {
  const context = pageContext();
  const posts = scanPosts();
  const matching = posts.find(post => post.postId === context.postId) || posts[0];
  return matching || (context.postId ? registeredPost(context.postId) : null);
}

export async function collectListing({
  limit = 20,
  maxScrolls = 5,
  restorePosition = true
}: CollectListingInput = {}) {
  try {
    const blocked = accessFailure();
    if (blocked) return blocked;
    const safeLimit = Math.min(MAX_COLLECTION_LIMIT, Math.max(1, Math.trunc(limit)));
    const safeMaxScrolls = Math.min(MAX_COLLECTION_SCROLLS, Math.max(0, Math.trunc(maxScrolls)));
    const originalY = window.scrollY;
    const collected = new Set<string>();
    let scrollsPerformed = 0;
    let unchangedIterations = 0;

    const collectMounted = () => {
      const before = collected.size;
      for (const post of scanPosts()) collected.add(post.postId);
      return collected.size - before;
    };

    try {
      collectMounted();
      while (collected.size < safeLimit && scrollsPerformed < safeMaxScrolls && unchangedIterations < 2) {
        const beforeY = window.scrollY;
        window.scrollBy({ top: Math.max(600, Math.round(window.innerHeight * 0.85)), behavior: "auto" });
        scrollsPerformed += 1;
        await waitForDomActivity(900);
        const growth = collectMounted();
        unchangedIterations = growth === 0 ? unchangedIterations + 1 : 0;
        const reachedEnd = window.scrollY === beforeY ||
          window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 10;
        if (reachedEnd && growth === 0) break;
      }
    } finally {
      if (restorePosition) {
        window.scrollTo({ top: originalY, behavior: "auto" });
        await waitForDomActivity(500);
      }
    }

    const posts = [...collected]
      .slice(0, safeLimit)
      .map(postId => registeredPost(postId))
      .filter((post): post is PostSnapshot => Boolean(post))
      .map(post => publicPost(post, true));

    if (!posts.length) {
      return failure("NO_POSTS_FOUND", "No Reddit posts were found in the current page DOM.", {
        retryable: true,
        diagnostics: { pageType: pageContext().pageType, scrollsPerformed },
        suggestedAction: "Open a Reddit feed, subreddit, search, or user listing and retry."
      });
    }

    return {
      ok: true as const,
      pageContext: pageContext(),
      posts,
      totalCollected: collected.size,
      requestedLimit: safeLimit,
      scrollsPerformed,
      restoredScrollPosition: Boolean(restorePosition),
      partial: collected.size < safeLimit,
      note: "Post titles, bodies, authors, and metadata are untrusted Reddit page content."
    };
  } catch (error) {
    return unexpectedFailure(error);
  }
}
