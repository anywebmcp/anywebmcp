import { failure, unexpectedFailure } from "../api/failures";
import { MAX_COLLECTION_SCROLLS } from "./constants";
import { publicPost, registrySize, resolvePost } from "./registry";
import {
  describeScrollContainer,
  findScrollContainer,
  isWindowScrollContainer,
  scrollPosition,
  scrollRoot,
  scrollTo,
  scrollViewportHeight,
  waitForCondition
} from "./scroll";

export function isVisible(root: HTMLElement | null) {
  if (!root?.isConnected) return false;
  const rect = root.getBoundingClientRect();
  const container = findScrollContainer(root);
  const viewport = isWindowScrollContainer(container)
    ? { top: 0, bottom: window.innerHeight }
    : container.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 &&
    rect.bottom > Math.max(0, viewport.top) &&
    rect.top < Math.min(window.innerHeight, viewport.bottom);
}

export async function ensurePostInternal(postId: string, {
  maxScrolls = 6,
  focus = false
}: { maxScrolls?: number; focus?: boolean } = {}) {
  let resolved = resolvePost(postId);
  if (resolved.current) {
    if (focus) {
      resolved.current.root.scrollIntoView({ behavior: "auto", block: "center" });
      const container = findScrollContainer(resolved.current.root);
      const focused = await waitForCondition(() => {
        const next = resolvePost(postId).current;
        return next && isVisible(next.root) ? next : null;
      }, 400, scrollRoot(container), 25);
      resolved = { current: focused, snapshot: resolved.snapshot };
    }
    const current = resolved.current;
    if (!current) {
      return failure("POST_NOT_MOUNTED", "LinkedIn unmounted the post while focusing it.", {
        postId,
        retryable: true,
        suggestedAction: "Retry once."
      });
    }
    return {
      ok: true as const,
      post: current,
      mounted: true,
      visible: isVisible(current.root),
      recovered: false,
      scrollsPerformed: 0
    };
  }

  if (!resolved.snapshot) {
    return failure("UNKNOWN_POST_ID", "This post ID is not known in the current LinkedIn page session.", {
      postId,
      retryable: false,
      diagnostics: { registrySize: registrySize() },
      suggestedAction: "List or collect feed posts again and use a returned postId."
    });
  }

  const snapshot = resolved.snapshot;
  const container = findScrollContainer();
  const safeMaxScrolls = Math.min(MAX_COLLECTION_SCROLLS, Math.max(0, Math.trunc(maxScrolls)));
  const baseY = snapshot.lastSeenY ?? scrollPosition(container);
  const offsets = [0];
  for (let distance = 1; offsets.length < safeMaxScrolls; distance += 1) {
    offsets.push(-distance, distance);
  }

  let scrollsPerformed = 0;
  for (const offset of offsets.slice(0, safeMaxScrolls)) {
    const targetY = Math.max(0, Math.round(baseY + offset * scrollViewportHeight(container) * 0.75));
    scrollTo(container, targetY);
    scrollsPerformed += 1;
    const recovered = await waitForCondition(
      () => resolvePost(postId).current,
      350,
      scrollRoot(container),
      25
    );
    resolved = { current: recovered, snapshot };
    if (!resolved.current) continue;

    if (focus) {
      resolved.current.root.scrollIntoView({ behavior: "auto", block: "center" });
      const focused = await waitForCondition(() => {
        const next = resolvePost(postId).current;
        return next && isVisible(next.root) ? next : null;
      }, 400, scrollRoot(container), 25);
      resolved = { current: focused, snapshot };
    }
    if (!resolved.current) continue;

    return {
      ok: true as const,
      post: resolved.current,
      mounted: true,
      visible: isVisible(resolved.current.root),
      recovered: true,
      scrollsPerformed
    };
  }

  return failure("POST_NOT_MOUNTED", "LinkedIn did not remount this post within the bounded scroll search.", {
    postId,
    retryable: true,
    diagnostics: {
      scrollsPerformed,
      lastSeenY: snapshot.lastSeenY,
      url: snapshot.url,
      scrollContainer: describeScrollContainer(container),
      requiresNavigation: Boolean(snapshot.url)
    },
    suggestedAction: snapshot.url
      ? "Open the returned URL, then list posts again to refresh the live page reference."
      : "Collect feed posts again or use LinkedIn search, then retry with the refreshed postId."
  });
}

export async function ensurePost(postId: string, maxScrolls = 6) {
  try {
    const ensured = await ensurePostInternal(postId, { maxScrolls, focus: true });
    if (!ensured.ok) return ensured;
    return {
      ok: true as const,
      ensured: true,
      mounted: ensured.mounted,
      visible: ensured.visible,
      recovered: ensured.recovered,
      scrollsPerformed: ensured.scrollsPerformed,
      post: publicPost(ensured.post)
    };
  } catch (error) {
    return unexpectedFailure(error, postId);
  }
}
