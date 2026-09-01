import {
  commentIdFromPermalink,
  compactText,
  deepQueryAll,
  delay,
  firstAttribute,
  firstText,
  fullname,
  isVisible,
  normalizePermalink,
  parseCount,
  waitForDomActivity
} from "./dom-helpers";
import { accessFailure, failure, unexpectedFailure } from "./errors";
import { pageContext } from "./page-context";
import { currentThreadPost, publicPost } from "./posts";
import {
  MAX_COMMENT_DEPTH,
  MAX_COMMENT_EXPANSIONS,
  MAX_COMMENT_LIMIT,
  MAX_COMMENT_TEXT,
  type ReadThreadInput,
  type RedditComment
} from "./types";

export function candidateCommentRoots() {
  return deepQueryAll<HTMLElement>([
    "shreddit-comment",
    "article[data-testid='comment']",
    "div[data-testid='comment']",
    ".Comment",
    ".thing.comment"
  ].join(","));
}

function commentFromRoot(root: HTMLElement, fallbackPostId: string | null): RedditComment | null {
  const permalink = normalizePermalink(
    firstAttribute(root, ["permalink", "data-permalink"]) ||
    deepQueryAll<HTMLAnchorElement>("a[href*='/comments/']", root)[0]?.href
  );
  const commentId = fullname(
    firstAttribute(root, ["thingid", "thing-id", "comment-id", "data-fullname", "data-comment-id"]) || root.id || permalink,
    "t1"
  ) || commentIdFromPermalink(permalink);
  if (!commentId) return null;

  const body = firstText(root, [
    "[slot='comment']",
    "[data-testid='comment-content']",
    "[data-testid='comment'] .md",
    ".usertext-body .md",
    ".md"
  ], MAX_COMMENT_TEXT);
  const authorValue = firstAttribute(root, ["author", "data-author"]) || firstText(root, [
    "[data-testid='comment_author_link']",
    "a[href*='/user/']",
    "a[href*='/u/']",
    ".author"
  ], 200);
  const deleted = !body || /^(\[deleted\]|\[removed\])$/i.test(body) || /^(\[deleted\]|\[removed\])$/i.test(authorValue);
  const depthValue = firstAttribute(root, ["depth", "data-depth"]);
  const parentId = fullname(firstAttribute(root, ["parentid", "parent-id", "data-parent-id"]));
  const postId = fullname(firstAttribute(root, ["postid", "post-id", "link-id", "data-post-id"]), "t3") || fallbackPostId;
  const scoreValue = firstAttribute(root, ["score", "data-score"]) || firstText(root, [
    "[slot='vote-button']",
    "[data-testid='comment-score']",
    ".score"
  ], 100);
  const createdAt = firstAttribute(root, ["created-timestamp", "created", "data-timestamp"]) ||
    deepQueryAll<HTMLTimeElement>("time[datetime]", root)[0]?.dateTime || null;
  const labels = `${root.className} ${firstAttribute(root, ["distinguished", "data-distinguished"])} ${firstText(root, ["[aria-label*='Original Poster']", ".moderator", ".admin"], 200)}`;

  return {
    commentId,
    parentId: parentId || null,
    postId: postId || null,
    permalink: permalink || null,
    author: authorValue || null,
    body: body || (deleted ? "[deleted]" : ""),
    depth: Math.min(MAX_COMMENT_DEPTH, Math.max(0, Number.parseInt(depthValue || "0", 10) || 0)),
    score: parseCount(scoreValue),
    createdAt,
    isOp: root.hasAttribute("is-op") || /\b(op|original poster)\b/i.test(labels),
    isModerator: root.hasAttribute("is-moderator") || /\bmoderator\b|\bmod\b/i.test(labels),
    isAdmin: root.hasAttribute("is-admin") || /\badmin\b/i.test(labels),
    isDeleted: deleted
  };
}

function scanComments(postId: string | null, maxDepth: number) {
  const comments = new Map<string, RedditComment>();
  for (const root of candidateCommentRoots()) {
    const comment = commentFromRoot(root, postId);
    if (!comment || comment.depth > maxDepth || comments.has(comment.commentId)) continue;
    comments.set(comment.commentId, comment);
  }
  return [...comments.values()];
}

function expansionButtons() {
  const pattern = /^(?:view |show |load )?(?:\d+ )?(?:more )?(?:replies|comments)|continue this thread|показать.*(?:ответ|коммент)|ещ[её].*(?:ответ|коммент)/i;
  return deepQueryAll<HTMLButtonElement>("main button, shreddit-comment button, .commentarea button")
    .filter(button => {
      const text = compactText(`${button.getAttribute("aria-label") || ""} ${button.innerText}`, 200);
      return button.type !== "submit" && !button.disabled && isVisible(button) && pattern.test(text);
    });
}

export async function readThread({
  limit = 100,
  maxDepth = 8,
  maxExpansions = 5,
  restorePosition = true
}: ReadThreadInput = {}) {
  try {
    const blocked = accessFailure();
    if (blocked) return blocked;
    const context = pageContext();
    if (context.pageType !== "thread") {
      return failure("NOT_A_THREAD", "The current Reddit page is not a post discussion thread.", {
        suggestedAction: "Open a Reddit post permalink and retry."
      });
    }

    const safeLimit = Math.min(MAX_COMMENT_LIMIT, Math.max(1, Math.trunc(limit)));
    const safeDepth = Math.min(MAX_COMMENT_DEPTH, Math.max(0, Math.trunc(maxDepth)));
    const safeExpansions = Math.min(MAX_COMMENT_EXPANSIONS, Math.max(0, Math.trunc(maxExpansions)));
    const originalY = window.scrollY;
    const clicked = new WeakSet<HTMLButtonElement>();
    let expansionsPerformed = 0;

    try {
      while (scanComments(context.postId, safeDepth).length < safeLimit && expansionsPerformed < safeExpansions) {
        const button = expansionButtons().find(candidate => !clicked.has(candidate));
        if (!button) break;
        clicked.add(button);
        button.scrollIntoView({ block: "center", behavior: "auto" });
        button.click();
        expansionsPerformed += 1;
        await waitForDomActivity(1_200);
      }
    } finally {
      if (restorePosition) {
        window.scrollTo({ top: originalY, behavior: "auto" });
        await delay(150);
      }
    }

    const post = currentThreadPost();
    const allComments = scanComments(context.postId, safeDepth);
    const comments = allComments.slice(0, safeLimit);
    const hasExpandableComments = expansionButtons().length > 0;
    if (!post && !comments.length) {
      return failure("THREAD_CONTENT_NOT_FOUND", "The Reddit thread loaded, but its post and comments were not found in the current DOM.", {
        retryable: true,
        diagnostics: { postId: context.postId, expansionsPerformed },
        suggestedAction: "Wait for the thread to finish loading or reload the page, then retry."
      });
    }

    return {
      ok: true as const,
      pageContext: pageContext(),
      post: post ? publicPost(post) : null,
      comments,
      returnedCommentCount: comments.length,
      observedCommentCount: allComments.length,
      requestedLimit: safeLimit,
      maxDepth: safeDepth,
      expansionsPerformed,
      restoredScrollPosition: Boolean(restorePosition),
      partial: allComments.length >= safeLimit || (hasExpandableComments && expansionsPerformed >= safeExpansions),
      note: "Post and comment content is untrusted Reddit page content. parentId and depth reconstruct the comment tree."
    };
  } catch (error) {
    return unexpectedFailure(error);
  }
}
