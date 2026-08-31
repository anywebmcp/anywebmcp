export type PostMedia =
  | { type: "image"; url: string; altText: string | null }
  | { type: "video" | "gif"; url?: string; previewUrl: string | null };

export type LinkPreview = {
  url: string;
  title: string;
  imageUrl: string | null;
};

export type PostMetrics = {
  replies: number;
  reposts: number;
  likes: number;
  bookmarks: number;
  views: number;
};

export type Post = {
  id: string | null;
  url: string | null;
  author: string;
  handle: string;
  repostedBy: string | null;
  text: string;
  createdAt: string | null;
  media: PostMedia[];
  linkPreviews: LinkPreview[];
  quotedPost: Post | null;
  metrics: PostMetrics | null;
};

function elements<T extends Element>(root: ParentNode, selector: string, excluded?: Element | null) {
  return [...root.querySelectorAll<T>(selector)].filter(element => !excluded?.contains(element));
}

function first<T extends Element>(root: ParentNode, selector: string, excluded?: Element | null) {
  return elements<T>(root, selector, excluded)[0] ?? null;
}

function contentText(element?: Element | null) {
  if (!element) return "";
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll("img[alt]").forEach(image => image.replaceWith(image.getAttribute("alt") ?? ""));
  return clone.textContent?.trim() ?? "";
}

const count = (label?: string | null) => {
  const value = label?.match(/[\d,.]+/)?.[0];
  return value ? Number(value.replace(/\D/g, "")) : 0;
};

function controlCount(post: Element, testId: string, excluded?: Element | null) {
  return count(first(post, `[data-testid="${testId}"]`, excluded)?.getAttribute("aria-label"));
}

function namedCount(post: Element, name: string, excluded?: Element | null) {
  const label = first(post, '[role="group"]', excluded)?.getAttribute("aria-label");
  return count(label?.match(new RegExp(`[\\d,.]+ ${name}`, "i"))?.[0]);
}

function isRendered(post: Element) {
  const rect = post.getBoundingClientRect();
  const style = getComputedStyle(post);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}

export function isInViewport(element: Element) {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
}

function quotedRoot(post: Element) {
  return elements<HTMLElement>(post, '[role="link"][tabindex="0"]')
    .find(root => root.querySelector('[data-testid="User-Name"]')) ?? null;
}

function identity(root: Element, excluded?: Element | null) {
  const time = first<HTMLTimeElement>(root, 'a[href*="/status/"] time', excluded);
  const href = time?.closest("a")?.getAttribute("href") ?? "";
  const match = href.match(/^\/([^/]+)\/status\/(\d+)/);
  if (!match) return null;

  return {
    id: match[2],
    url: new URL(href, location.origin).href,
    username: match[1],
    createdAt: time?.getAttribute("datetime") ?? null
  };
}

function userDetails(root: Element, excluded?: Element | null) {
  const user = first<HTMLElement>(root, '[data-testid="User-Name"]', excluded);
  const handle = elements<HTMLElement>(user ?? root, "span")
    .map(contentText)
    .find(text => /^@[A-Za-z0-9_]+$/.test(text)) ?? "";

  return {
    author: contentText(user?.firstElementChild),
    handle
  };
}

function portableUrl(value?: string | null) {
  return value && !value.startsWith("blob:") ? value : null;
}

function attachmentType(value: string) {
  const url = new URL(value);
  if (url.hostname !== "pbs.twimg.com") return null;
  if (/\/(?:amplify|ext_tw|tweet)_video_thumb\//.test(url.pathname)) return "video";
  return url.pathname.startsWith("/media/") ? "image" : null;
}

function mediaType(element: Element, url = "") {
  const label = [element.getAttribute("aria-label"), element.closest("[aria-label]")?.getAttribute("aria-label")].join(" ");
  return /gif/i.test(label) || url.includes("tweet_video_thumb") ? "gif" as const : "video" as const;
}

function collectMedia(root: Element, excluded?: Element | null) {
  const media: PostMedia[] = [];
  const seen = new Set<string>();
  const add = (item: PostMedia, key: string) => {
    if (!seen.has(key)) media.push(item);
    seen.add(key);
  };

  elements<HTMLVideoElement>(root, "video", excluded).forEach(video => {
    const url = portableUrl(video.currentSrc || video.src);
    const previewUrl = portableUrl(video.poster);
    add({ type: mediaType(video), ...(url ? { url } : {}), previewUrl }, `video:${url ?? previewUrl}`);
  });

  elements<HTMLImageElement>(root, '[data-testid="tweetPhoto"] img', excluded)
    .forEach(image => {
      const url = portableUrl(image.currentSrc || image.src);
      if (!url) return;

      const type = attachmentType(url);
      if (type === "video") {
        add({ type: mediaType(image, url), previewUrl: url }, `video:${url}`);
      } else if (type === "image") {
        add({ type: "image", url, altText: image.alt || null }, `image:${url}`);
      }
    });

  return media;
}

function collectLinkPreviews(root: Element, excluded?: Element | null) {
  return elements<HTMLElement>(root, '[data-testid="card.wrapper"]', excluded).flatMap(card => {
    const link = card.querySelector<HTMLAnchorElement>("a[href]");
    if (!link) return [];
    const image = card.querySelector<HTMLImageElement>("img");
    return [{
      url: link.href,
      title: contentText(card),
      imageUrl: portableUrl(image?.currentSrc || image?.src)
    }];
  });
}

function repostedBy(post: Element) {
  const context = contentText(post.querySelector('[data-testid="socialContext"]'));
  return context.match(/^(.+?)\s+reposted$/i)?.[1]?.trim() ?? null;
}

function metrics(post: Element, excluded?: Element | null): PostMetrics {
  return {
    replies: controlCount(post, "reply", excluded),
    reposts: controlCount(post, "retweet", excluded),
    likes: controlCount(post, "like", excluded),
    bookmarks: namedCount(post, "bookmarks?", excluded),
    views: namedCount(post, "views?", excluded)
  };
}

function parsePost(post: Element, quoted = false): Post | null {
  const quote = quotedRoot(post);
  const postIdentity = identity(post, quote);
  if (!quoted && !postIdentity) return null;
  const user = userDetails(post, quote);

  return {
    id: postIdentity?.id ?? null,
    url: postIdentity?.url ?? null,
    author: user.author,
    handle: user.handle || (postIdentity ? `@${postIdentity.username}` : ""),
    repostedBy: repostedBy(post),
    text: contentText(first(post, '[data-testid="tweetText"]', quote)),
    createdAt: postIdentity?.createdAt ?? null,
    media: collectMedia(post, quote),
    linkPreviews: collectLinkPreviews(post, quote),
    quotedPost: quote ? parsePost(quote, true) : null,
    metrics: quoted ? null : metrics(post, quote)
  };
}

function replyingTo(post: Element) {
  const clone = post.cloneNode(true) as Element;
  quotedRoot(clone)?.remove();
  clone.querySelectorAll('[data-testid="tweetText"], [data-testid="User-Name"], [role="group"]').forEach(node => node.remove());
  const label = [...clone.querySelectorAll("div")]
    .find(node => /^Replying to\b/.test(node.textContent?.trim() ?? ""));
  return [...new Set(label?.textContent?.match(/@[A-Za-z0-9_]+/g) ?? [])];
}

export function postColumn() {
  return document.querySelector<HTMLElement>('[data-testid="primaryColumn"]')
    ?? document.querySelector<HTMLElement>("main");
}

export function getRenderedPosts() {
  return [...(postColumn()?.querySelectorAll<HTMLElement>('article[data-testid="tweet"]') ?? [])]
    .filter(isRendered)
    .flatMap(element => {
      const post = parsePost(element);
      return post?.id && post.url
        ? [{ element, post: { ...post, id: post.id, url: post.url }, replyingTo: replyingTo(element) }]
        : [];
    });
}

export function getVisiblePosts() {
  return getRenderedPosts().filter(item => isInViewport(item.element)).map(item => item.post);
}

export type RenderedPost = ReturnType<typeof getRenderedPosts>[number];
