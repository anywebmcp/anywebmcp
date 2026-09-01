import { ToolError } from "@anywebmcp/common";
import { getRenderedPosts, isInViewport, postColumn } from "./posts";
import { pageContext, pageKey, withPostContext, type ContextualPost, type PostContext, type PostPage } from "./post-context";

export type GetPostsInput = {
  mode?: "visible" | "batch" | "next";
  limit?: number;
  afterPostId?: string;
  filter?: "all" | "replies";
};

type StopReason = "viewport" | "limit" | "end" | "stalled" | "budget";
type Anchor = { top: number; filters: Set<string> };
type Collection = {
  posts: ContextualPost["post"][];
  seen: Set<string>;
  started: boolean;
  last?: ContextualPost;
};
const anchors = new Map<string, Anchor>();
const contexts = new Map<string, PostContext>();
let currentPage = "";
let rememberedPage: PostPage | undefined;
let reading = false;

function currentContext() {
  const page = pageContext();
  // Reply sort controls and profile tabs can leave the rendered window while scrolling.
  if (page.url === rememberedPage?.url) {
    page.tab ??= rememberedPage.tab;
    page.sort ??= rememberedPage.sort;
    if (page.kind === "other") page.kind = rememberedPage.kind;
  }
  return page;
}

function pause(ms: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const finish = () => { signal?.removeEventListener("abort", abort); resolve(); };
    const timer = window.setTimeout(finish, ms);
    const abort = () => { window.clearTimeout(timer); reject(signal?.reason); };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function checkPage(key: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (pageKey(currentContext()) !== key) throw new ToolError("The X page, tab, or reply order changed while reading. Read the current page again.");
}

function remember(item: ContextualPost, filter: string) {
  const filters = anchors.get(item.post.id)?.filters ?? new Set<string>();
  filters.add(filter);
  anchors.delete(item.post.id);
  anchors.set(item.post.id, { top: scrollY + item.element.getBoundingClientRect().top, filters });
  if (anchors.size > 200) anchors.delete(anchors.keys().next().value!);
}

async function findAnchor(id: string, filter: string, key: string, signal?: AbortSignal) {
  const saved = anchors.get(id);
  if (!saved?.filters.has(filter)) {
    throw new ToolError("afterPostId must be a post returned on this page with the same filter. Start with visible or batch.");
  }
  const find = () => getRenderedPosts().find(item => item.post.id === id);
  let anchor = find();
  if (anchor) return anchor;
  window.scrollTo({ top: Math.max(0, saved.top - 100), behavior: "instant" });
  const deadline = Date.now() + 3000;
  while (!anchor && Date.now() < deadline) {
    await pause(100, signal);
    checkPage(key, signal);
    anchor = find();
  }
  if (!anchor) throw new ToolError("The continuation post is no longer available in this feed. Start a new batch from the current position.");
  return anchor;
}

function validate({ mode = "visible", limit, afterPostId, filter = "all" }: GetPostsInput) {
  if (!["visible", "batch", "next"].includes(mode) || !["all", "replies"].includes(filter)) {
    throw new ToolError("Use mode visible, batch, or next, and filter all or replies.");
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
    throw new ToolError("limit must be an integer between 1 and 100.");
  }
  if ((mode === "next") !== Boolean(afterPostId)) {
    throw new ToolError("afterPostId is required for next and must be omitted for visible and batch.");
  }
}

function startingItems(items: ContextualPost[], collection: Collection, afterPostId?: string) {
  if (collection.started) return items;
  const index = afterPostId ? items.findIndex(item => item.post.id === afterPostId)
    : items.findIndex(item => isInViewport(item.element));
  if (afterPostId && index < 0) throw new ToolError("The continuation post disappeared before reading could resume. Start a new batch.");
  if (index < 0) return [];
  const start = index + (afterPostId ? 1 : 0);
  items.slice(0, start).forEach(item => collection.seen.add(item.post.id));
  collection.started = true;
  return items.slice(start);
}

function appendPosts(items: ContextualPost[], collection: Collection, mode: string, filter: string, limit: number) {
  let reachedRelated = false;
  for (const item of items) {
    if (collection.seen.has(item.post.id) || (mode === "visible" && !isInViewport(item.element))) continue;
    collection.seen.add(item.post.id);
    if (filter === "replies" && item.post.context.role !== "reply") {
      reachedRelated ||= item.post.context.role === "related";
      continue;
    }
    remember(item, filter);
    collection.posts.push(item.post);
    collection.last = item;
    if (collection.posts.length >= limit) break;
  }
  return reachedRelated;
}

async function advance(items: ContextualPost[], key: string, signal?: AbortSignal) {
  const beforeY = scrollY;
  const beforeIds = items.map(item => item.post.id).join(",");
  window.scrollBy({ top: Math.max(250, innerHeight * 0.8), behavior: "instant" });
  await pause(250, signal);
  // Give an unchanged bottom edge time to load instead of treating it as the end.
  if (Math.abs(scrollY - beforeY) < 1) await pause(1000, signal);
  checkPage(key, signal);
  const changed = getRenderedPosts().map(item => item.post.id).join(",") !== beforeIds;
  return !changed && Math.abs(scrollY - beforeY) < 1;
}

async function read(input: GetPostsInput, signal?: AbortSignal) {
  validate(input);
  const { mode = "visible", filter = "all", afterPostId } = input;
  const limit = input.limit ?? (mode === "visible" ? Infinity : 20);
  const page = currentContext();
  const key = pageKey(page);
  if (currentPage !== key) {
    anchors.clear();
    contexts.clear();
    currentPage = key;
  }
  rememberedPage = page;
  checkPage(key, signal);
  const scan = () => withPostContext(getRenderedPosts(), page, contexts);
  const collection: Collection = { posts: [], seen: new Set(), started: false };
  const { posts } = collection;
  let stopReason: StopReason = "viewport";
  let scrollsPerformed = 0;
  const start = mode === "next" ? afterPostId : undefined;

  if (start) {
    const anchor = await findAnchor(start, filter, key, signal);
    anchor.element.scrollIntoView({ block: "start", behavior: "instant" });
    await pause(150, signal);
  }

  const deadline = Date.now() + 30_000;
  let idle = 0;
  for (;;) {
    checkPage(key, signal);
    const items = scan();
    const candidates = startingItems(items, collection, start);
    const reachedRelated = appendPosts(candidates, collection, mode, filter, limit);
    if (posts.length >= limit) { stopReason = "limit"; break; }
    if (mode === "visible") break;
    if (reachedRelated) { stopReason = "end"; break; }
    if (Date.now() >= deadline || scrollsPerformed >= 60) { stopReason = "budget"; break; }

    scrollsPerformed++;
    idle = await advance(items, key, signal) ? idle + 1 : 0;
    if (idle >= 3) { stopReason = "stalled"; break; }
  }

  const { last } = collection;
  if (mode !== "visible" && last?.element.isConnected) {
    checkPage(key, signal);
    last.element.scrollIntoView({ block: "nearest", behavior: "instant" });
  }
  // Keep context for an overlapping virtualized window without retaining an entire feed.
  while (contexts.size > 600) contexts.delete(contexts.keys().next().value!);
  checkPage(key, signal);
  return { page, mode, filter, requestedLimit: Number.isFinite(limit) ? limit : null,
    count: posts.length, stopReason, scrollsPerformed, lastPostId: posts.at(-1)?.id ?? null, posts };
}

export async function readPosts(input: GetPostsInput = {}, signal?: AbortSignal) {
  if (reading) throw new ToolError("Another post read is still running on this page. Wait for it to finish.");
  if (!postColumn()) throw new ToolError("X's main content is not ready. Wait for the page to load and retry.");
  reading = true;
  try { return await read(input, signal); }
  finally { reading = false; }
}
