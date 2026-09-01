import { readFileSync } from "node:fs";
import path from "node:path";
import { parseHTML } from "linkedom";

export function fixture(name: string) {
  return readFileSync(path.join(process.cwd(), "test", "fixtures", name), "utf8");
}

type DomOptions = {
  elementScroll?: boolean;
  onWindowScroll?: (top: number) => void;
};

export function linkedInDom(html: string, options: DomOptions = {}) {
  const parsed = parseHTML(html);
  const { document, window } = parsed;
  let windowY = 120;
  let activeEditor: HTMLElement | null = null;

  Object.defineProperty(window, "location", {
    configurable: true,
    enumerable: true,
    value: { href: "https://www.linkedin.com/feed/", hostname: "www.linkedin.com" }
  });
  Object.defineProperty(window, "innerHeight", { configurable: true, enumerable: true, value: 800 });
  Object.defineProperty(window, "scrollY", { configurable: true, enumerable: true, get: () => windowY });
  Object.assign(window, {
    getComputedStyle(element: Element) {
      return { overflowY: element.getAttribute("data-overflow-y") || "visible" };
    },
    scrollBy({ top }: { top: number }) {
      windowY += top;
      options.onWindowScroll?.(windowY);
    },
    scrollTo({ top }: { top: number }) {
      windowY = top;
      options.onWindowScroll?.(windowY);
    },
    getSelection() {
      return { removeAllRanges() {}, addRange() {} };
    }
  });

  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 10_000 });
  Object.defineProperty(document, "scrollingElement", { configurable: true, value: document.documentElement });
  Object.assign(document, {
    execCommand(command: string, _showUi: boolean, value: string) {
      if (command !== "insertText" || !activeEditor) return false;
      activeEditor.textContent = value;
      return true;
    }
  });

  const main = document.querySelector<HTMLElement>("main");
  if (main && options.elementScroll) {
    let scrollTop = 120;
    main.setAttribute("data-overflow-y", "auto");
    Object.defineProperties(main, {
      clientHeight: { configurable: true, value: 800 },
      scrollHeight: { configurable: true, value: 10_000 },
      scrollTop: { configurable: true, get: () => scrollTop, set: value => { scrollTop = value; } }
    });
    Object.assign(main, {
      scrollBy({ top }: { top: number }) { scrollTop += top; },
      scrollTo({ top }: { top: number }) { scrollTop = top; },
      getBoundingClientRect() {
        return { top: 0, bottom: 800, left: 0, right: 1_000, width: 1_000, height: 800, x: 0, y: 0, toJSON() {} };
      }
    });
  }

  for (const [index, post] of [...document.querySelectorAll<HTMLElement>("[role='listitem']")].entries()) {
    Object.assign(post, {
      getBoundingClientRect() {
        const containerY = options.elementScroll ? (main?.scrollTop || 0) : windowY;
        const top = 100 + index * 260 - containerY;
        return { top, bottom: top + 220, left: 0, right: 700, width: 700, height: 220, x: 0, y: top, toJSON() {} };
      },
      scrollIntoView() {}
    });
  }

  for (const editor of document.querySelectorAll<HTMLElement>("[contenteditable='true']")) {
    Object.assign(editor, { focus() { activeEditor = editor; } });
  }

  return {
    document,
    window,
    windowScrollPosition: () => windowY,
    elementScrollPosition: () => main?.scrollTop ?? null,
    installGlobals() {
      Object.assign(globalThis, {
        MutationObserver: window.MutationObserver,
        InputEvent: window.InputEvent,
        Event: window.Event,
        CSS: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`) }
      });
    },
    activateEditor(editor: HTMLElement) {
      activeEditor = editor;
      Object.assign(editor, { focus() { activeEditor = editor; } });
    },
    setWindowScrollPosition(top: number) { windowY = top; }
  };
}
