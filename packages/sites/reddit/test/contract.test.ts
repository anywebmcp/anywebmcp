import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { assertSiteContract, importAndMountSite } from "@anywebmcp/common/test";
import { parseHTML } from "linkedom";

test("registers and wraps all Reddit tools", async t => {
  const html = await readFile(path.join(process.cwd(), "test/fixture.html"), "utf8");
  const { document, window: domWindow } = parseHTML(html);
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  for (const key of ["Element", "HTMLElement", "HTMLButtonElement", "HTMLInputElement", "HTMLTextAreaElement", "HTMLTimeElement", "ShadowRoot", "MutationObserver", "InputEvent", "Event"] as const) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value: domWindow[key] });
  }
  Object.defineProperty(domWindow.HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value() {
      const hidden = (this as HTMLElement).closest("[hidden]") !== null;
      return { top: 0, left: 0, right: hidden ? 0 : 100, bottom: hidden ? 0 : 20, width: hidden ? 0 : 100, height: hidden ? 0 : 20 };
    }
  });
  Object.defineProperty(domWindow.HTMLElement.prototype, "scrollIntoView", { configurable: true, value() {} });
  Object.defineProperty(document, "execCommand", { configurable: true, value() { return false; } });
  document.querySelector<HTMLButtonElement>("shreddit-comment[thingid='t1_reply1'] button[aria-label='Reply']")!
    .addEventListener("click", () => document.querySelector("#reply-editor")?.removeAttribute("hidden"));

  const windowFixture = {
    location: new URL("https://www.reddit.com/r/typescript/comments/abc123/webmcp_fixture?sort=best"),
    innerHeight: 900,
    scrollY: 0,
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
    getComputedStyle(element: HTMLElement) {
      return { display: element.closest("[hidden]") ? "none" : "block", visibility: "visible" };
    },
    scrollBy() {},
    scrollTo() {},
    getSelection: domWindow.getSelection?.bind(domWindow) ?? (() => null)
  };
  const harness = await importAndMountSite(() => import("../src/index"), { document, window: windowFixture });
  t.after(() => {
    harness.dispose();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  });

  assertSiteContract(harness, [
    "reddit_collect_listing",
    "reddit_read_thread",
    "reddit_get_community_rules",
    "reddit_prepare_reply_draft"
  ]);

  for (const [name, input] of [
    ["reddit_collect_listing", { limit: 5, maxScrolls: 0 }],
    ["reddit_read_thread", { limit: 5, maxDepth: 4, maxExpansions: 0 }],
    ["reddit_get_community_rules", {}],
    ["reddit_prepare_reply_draft", { targetId: "t1_reply1", text: "Wrapped fixture draft." }]
  ] as const) {
    const result = await harness.execute(name, input);
    assert.equal(result.status, "completed", `${name} should return a wrapped completed result: ${JSON.stringify(result)}`);
  }
  assert.equal(document.body.dataset.submitCount, "0");
});
