import type { AlgoliaHit, AlgoliaItem, FirebaseItem, PublicStory } from "./types";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\""
};

function decodeEntity(entity: string) {
  if (entity.startsWith("#x") || entity.startsWith("#X")) {
    const value = Number.parseInt(entity.slice(2), 16);
    return validCodePoint(value) ? String.fromCodePoint(value) : `&${entity};`;
  }
  if (entity.startsWith("#")) {
    const value = Number.parseInt(entity.slice(1), 10);
    return validCodePoint(value) ? String.fromCodePoint(value) : `&${entity};`;
  }
  return NAMED_ENTITIES[entity.toLowerCase()] ?? `&${entity};`;
}

function validCodePoint(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff;
}

export function htmlToText(value: unknown) {
  return String(value ?? "")
    .replace(/<(?:br|\/?p|\/?pre|\/li)(?:\s[^>]*)?\s*\/?>/gi, "\n")
    .replace(/<li(?:\s[^>]*)?>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&([a-zA-Z]+|#\d+|#x[\da-fA-F]+);/g, (_, entity: string) => decodeEntity(entity))
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function isoFromUnix(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

export function storyDomain(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export function publicStoryFromFirebase(item: FirebaseItem): PublicStory | null {
  if (!item.id || !item.title || (item.type && item.type !== "story" && item.type !== "job")) {
    return null;
  }
  return {
    id: item.id,
    title: htmlToText(item.title),
    url: item.url || null,
    hnUrl: `https://news.ycombinator.com/item?id=${item.id}`,
    domain: storyDomain(item.url),
    author: item.by || null,
    createdAt: isoFromUnix(item.time),
    points: item.score ?? 0,
    commentCount: item.descendants ?? 0,
    text: item.text ? htmlToText(item.text) : null
  };
}

export function publicStoryFromHit(hit: AlgoliaHit): PublicStory | null {
  const id = Number(hit.objectID);
  if (!Number.isInteger(id) || !hit.title) return null;
  return {
    id,
    title: htmlToText(hit.title),
    url: hit.url || null,
    hnUrl: `https://news.ycombinator.com/item?id=${id}`,
    domain: storyDomain(hit.url),
    author: hit.author || null,
    createdAt: hit.created_at || isoFromUnix(hit.created_at_i),
    points: hit.points ?? 0,
    commentCount: hit.num_comments ?? 0,
    text: hit.story_text ? htmlToText(hit.story_text) : null
  };
}

export function publicStoryFromAlgoliaItem(item: AlgoliaItem): PublicStory | null {
  if (!item.id || !item.title) return null;
  return {
    id: item.id,
    title: htmlToText(item.title),
    url: item.url || null,
    hnUrl: `https://news.ycombinator.com/item?id=${item.id}`,
    domain: storyDomain(item.url),
    author: item.author || null,
    createdAt: item.created_at || isoFromUnix(item.created_at_i),
    points: item.points ?? 0,
    commentCount: countComments(item.children ?? []),
    text: item.text ? htmlToText(item.text) : null
  };
}

function countComments(comments: AlgoliaItem[]): number {
  return comments.reduce(
    (total, comment) => total + 1 + countComments(comment.children ?? []),
    0
  );
}
