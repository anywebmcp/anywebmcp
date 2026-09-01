import { parseHTML } from "linkedom";

type BrowserFixtureOptions = {
  url?: string;
  batches?: string[][];
  stall?: boolean;
  immediateTimers?: boolean;
};

export function installBrowserFixture(html: string, options: BrowserFixtureOptions = {}) {
  const parsed = parseHTML(html);
  const fixtureWindow = parsed.window as any;
  const fixtureDocument = parsed.document as any;
  if (fixtureWindow.Node.DOCUMENT_POSITION_FOLLOWING === undefined) {
    Object.defineProperties(fixtureWindow.Node, {
      DOCUMENT_POSITION_PRECEDING: { configurable: true, value: 2 },
      DOCUMENT_POSITION_FOLLOWING: { configurable: true, value: 4 }
    });
  }
  const url = new URL(options.url ?? "https://x.com/home");
  let scrollTop = 0;
  let batchIndex = 0;
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const globals: Record<string, unknown> = {
    window: fixtureWindow,
    document: fixtureDocument,
    Node: fixtureWindow.Node,
    Element: fixtureWindow.Element,
    HTMLElement: fixtureWindow.HTMLElement,
    HTMLTimeElement: fixtureWindow.HTMLTimeElement,
    location: { href: url.href, origin: url.origin, pathname: url.pathname },
    innerHeight: 800,
    innerWidth: 1200,
    getComputedStyle: () => ({ display: "block", visibility: "visible" })
  };

  for (const [name, value] of Object.entries(globals)) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
  for (const name of ["scrollY", "scrollX"]) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }
  Object.defineProperty(globalThis, "scrollY", { configurable: true, get: () => scrollTop });
  Object.defineProperty(globalThis, "scrollX", { configurable: true, value: 0 });

  const elementPrototype = fixtureWindow.Element.prototype;
  const previousRect = elementPrototype.getBoundingClientRect;
  const previousScrollIntoView = elementPrototype.scrollIntoView;
  elementPrototype.getBoundingClientRect = function() {
    const top = Number(this.getAttribute?.("data-top") ?? 0) - scrollTop;
    const height = Number(this.getAttribute?.("data-height") ?? 20);
    return { top, bottom: top + height, left: 0, right: 600, width: 600, height, x: 0, y: top, toJSON() {} };
  };
  elementPrototype.scrollIntoView = function() {
    const top = Number(this.getAttribute?.("data-top"));
    if (Number.isFinite(top)) scrollTop = Math.max(0, top - 20);
  };

  const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
  const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis);
  fixtureWindow.setTimeout = options.immediateTimers === false
    ? nativeSetTimeout
    : ((callback: () => void) => nativeSetTimeout(callback, 0));
  fixtureWindow.clearTimeout = nativeClearTimeout;
  fixtureWindow.scrollTo = ({ top }: { top: number }) => { scrollTop = top; };
  fixtureWindow.scrollBy = ({ top }: { top: number }) => {
    if (options.stall) return;
    scrollTop += top;
    if (options.batches && batchIndex < options.batches.length - 1) {
      batchIndex += 1;
      fixtureDocument.querySelector('[data-testid="primaryColumn"]').innerHTML = options.batches[batchIndex].join("");
    }
  };

  return {
    window: fixtureWindow,
    document: fixtureDocument,
    get scrollY() { return scrollTop; },
    dispose() {
      elementPrototype.getBoundingClientRect = previousRect;
      elementPrototype.scrollIntoView = previousScrollIntoView;
      for (const [name, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete (globalThis as Record<string, unknown>)[name];
      }
    }
  };
}
