import { MAX_REGISTRY_SIZE } from "./constants";
import { candidateRoots, postFromRoot } from "./posts";
import { findScrollContainer, positionWithinScrollContainer } from "./scroll";
import type { LivePost, PostSnapshot, PublicPost } from "./types";

const state = {
  postsByFingerprint: new Map<string, PostSnapshot>(),
  postAliases: new Map<string, string>()
};

function rememberPost(post: LivePost) {
  const previous = state.postsByFingerprint.get(post.fingerprint);
  const container = findScrollContainer(post.root);
  const knownUrn = post.urn || previous?.urn || null;
  const knownUrl = post.url || previous?.url || null;
  const snapshot: PostSnapshot = {
    postId: knownUrn || (knownUrl ? `url:${knownUrl}` : null) || previous?.postId || post.fingerprint,
    urn: knownUrn,
    url: knownUrl,
    fingerprint: post.fingerprint,
    stability: post.urn || post.url || previous?.stability === "canonical" ? "canonical" : "fingerprint",
    author: post.author || previous?.author || "Unknown author",
    authorUrl: post.authorUrl || previous?.authorUrl || null,
    text: post.text || previous?.text || "",
    lastSeenY: Math.max(0, Math.round(positionWithinScrollContainer(post.root, container))),
    lastSeenAt: Date.now()
  };

  state.postsByFingerprint.delete(post.fingerprint);
  state.postsByFingerprint.set(post.fingerprint, snapshot);

  const aliases = [
    snapshot.postId,
    snapshot.urn,
    snapshot.url,
    snapshot.url ? `url:${snapshot.url}` : null,
    snapshot.fingerprint,
    previous?.postId
  ].filter((alias): alias is string => Boolean(alias));
  for (const alias of aliases) state.postAliases.set(alias, snapshot.fingerprint);

  while (state.postsByFingerprint.size > MAX_REGISTRY_SIZE) {
    const oldestFingerprint = state.postsByFingerprint.keys().next().value;
    if (!oldestFingerprint) break;
    state.postsByFingerprint.delete(oldestFingerprint);
    for (const [alias, fingerprint] of state.postAliases) {
      if (fingerprint === oldestFingerprint) state.postAliases.delete(alias);
    }
  }

  return snapshot;
}

export function scanLoadedPosts() {
  const byFingerprint = new Map<string, LivePost>();
  for (const root of candidateRoots()) {
    const post = postFromRoot(root);
    if (!post || byFingerprint.has(post.fingerprint)) continue;
    const snapshot = rememberPost(post);
    Object.assign(post, {
      postId: snapshot.postId,
      urn: snapshot.urn,
      url: snapshot.url,
      stability: snapshot.stability
    });
    byFingerprint.set(post.fingerprint, post);
  }
  return [...byFingerprint.values()];
}

export function resolvePost(postId: string) {
  const posts = scanLoadedPosts();
  const direct = posts.find(post => [
    post.postId,
    post.urn,
    post.url,
    post.url ? `url:${post.url}` : null,
    post.fingerprint
  ].includes(postId));
  if (direct) {
    return { current: direct, snapshot: state.postsByFingerprint.get(direct.fingerprint) || null };
  }

  const fingerprint = state.postAliases.get(postId) ||
    (state.postsByFingerprint.has(postId) ? postId : null);
  if (!fingerprint) return { current: null, snapshot: null };
  return {
    current: posts.find(post => post.fingerprint === fingerprint) || null,
    snapshot: state.postsByFingerprint.get(fingerprint) || null
  };
}

export function publicPost(
  post: LivePost | PostSnapshot,
  includeFullText = false,
  mountedOverride?: boolean
): PublicPost {
  const text = includeFullText ? post.text : post.text.slice(0, 700);
  const root = "root" in post ? post.root : null;
  return {
    postId: post.postId,
    urn: post.urn,
    url: post.url,
    fingerprint: post.fingerprint,
    stability: post.stability,
    author: post.author || "Unknown author",
    authorUrl: post.authorUrl,
    text,
    truncated: text.length < post.text.length,
    mounted: mountedOverride ?? Boolean(root?.isConnected)
  };
}

export function registrySnapshot(fingerprint: string) {
  return state.postsByFingerprint.get(fingerprint);
}

export function registrySize() {
  return state.postsByFingerprint.size;
}
