import {
  commentIdFromPermalink,
  deepQueryAll,
  firstAttribute,
  fullname,
  normalizePermalink,
  postIdFromPermalink
} from "./dom-helpers";
import { MAX_REGISTRY_SIZE, type LivePost, type PostSnapshot } from "./types";

const posts = new Map<string, PostSnapshot>();

export function rememberPost(post: LivePost) {
  const previous = posts.get(post.postId);
  const snapshot: PostSnapshot = {
    ...post,
    permalink: post.permalink || previous?.permalink || null,
    body: post.body || previous?.body || "",
    lastSeenY: post.lastSeenY ?? previous?.lastSeenY ?? null,
    lastSeenAt: Date.now()
  };
  delete (snapshot as Partial<LivePost>).root;
  posts.delete(post.postId);
  posts.set(post.postId, snapshot);
  while (posts.size > MAX_REGISTRY_SIZE) {
    const oldest = posts.keys().next().value;
    if (!oldest) break;
    posts.delete(oldest);
  }
  return snapshot;
}

export function registeredPost(postId: string) {
  return posts.get(postId) || null;
}

function permalinkFromTarget(root: HTMLElement) {
  const attribute = firstAttribute(root, ["permalink", "data-permalink"]);
  if (attribute) return normalizePermalink(attribute);
  return normalizePermalink(deepQueryAll<HTMLAnchorElement>("a[href*='/comments/']", root)[0]?.href);
}

function rootFullname(root: HTMLElement) {
  const isComment = root.matches("shreddit-comment, article[data-testid='comment'], div[data-testid='comment'], .Comment, .thing.comment");
  const raw = firstAttribute(root, [
    "thingid",
    "thing-id",
    "comment-id",
    "post-id",
    "data-fullname",
    "data-comment-id",
    "data-post-id"
  ]) || root.id || permalinkFromTarget(root);
  return fullname(raw, isComment ? "t1" : "t3") ||
    (isComment ? commentIdFromPermalink(normalizePermalink(raw)) : postIdFromPermalink(normalizePermalink(raw)));
}

export function resolveTarget(targetId: string, roots: HTMLElement[]) {
  return roots.find(root => rootFullname(root) === targetId) || null;
}
