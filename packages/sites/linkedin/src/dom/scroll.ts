import { candidateRoots } from "./posts";
import type { ScrollContainer } from "./types";

export const delay = (milliseconds: number) =>
  new Promise<void>(resolve => window.setTimeout(resolve, milliseconds));

export function isWindowScrollContainer(container: ScrollContainer): container is Window {
  return container === window;
}

function isScrollable(element: HTMLElement) {
  const overflowY = window.getComputedStyle(element).overflowY;
  return /^(auto|scroll|overlay)$/.test(overflowY) && element.scrollHeight > element.clientHeight + 1;
}

export function findScrollContainer(root: HTMLElement | null = null): ScrollContainer {
  let element: HTMLElement | null = root || candidateRoots()[0] || document.querySelector<HTMLElement>("main");
  while (element) {
    if (isScrollable(element)) return element;
    element = element.parentElement;
  }
  return window;
}

export function scrollPosition(container: ScrollContainer) {
  return isWindowScrollContainer(container) ? window.scrollY : container.scrollTop;
}

export function scrollViewportHeight(container: ScrollContainer) {
  return isWindowScrollContainer(container) ? window.innerHeight : container.clientHeight;
}

export function scrollExtent(container: ScrollContainer) {
  return isWindowScrollContainer(container)
    ? (document.scrollingElement?.scrollHeight || document.documentElement.scrollHeight)
    : container.scrollHeight;
}

export function scrollRoot(container: ScrollContainer) {
  return isWindowScrollContainer(container) ? document.body : container;
}

export function scrollBy(container: ScrollContainer, top: number) {
  if (isWindowScrollContainer(container)) {
    window.scrollBy({ top, behavior: "auto" });
  } else {
    container.scrollBy({ top, behavior: "auto" });
  }
}

export function scrollTo(container: ScrollContainer, top: number) {
  if (isWindowScrollContainer(container)) {
    window.scrollTo({ top, behavior: "auto" });
  } else {
    container.scrollTo({ top, behavior: "auto" });
  }
}

export function describeScrollContainer(container: ScrollContainer) {
  if (isWindowScrollContainer(container)) return "window";
  if (container.id) return `${container.tagName.toLowerCase()}#${container.id}`;
  return container.tagName.toLowerCase();
}

export function positionWithinScrollContainer(root: HTMLElement, container: ScrollContainer) {
  const rootRect = root.getBoundingClientRect();
  if (isWindowScrollContainer(container)) return window.scrollY + rootRect.top;
  const containerRect = container.getBoundingClientRect();
  return container.scrollTop + rootRect.top - containerRect.top;
}

export function waitForCondition<T>(
  check: () => T | null,
  timeoutMs: number,
  observerRoot: Node = document.body,
  intervalMs = 50
) {
  return new Promise<T | null>(resolve => {
    let finished = false;
    const finish = (value: T | null) => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      resolve(value);
    };
    const inspect = () => {
      try {
        const value = check();
        if (value) finish(value);
      } catch {}
    };
    const observer = new MutationObserver(inspect);
    observer.observe(observerRoot, { childList: true, subtree: true });
    const interval = window.setInterval(inspect, intervalMs);
    const timeout = window.setTimeout(() => finish(null), timeoutMs);
    inspect();
  });
}
