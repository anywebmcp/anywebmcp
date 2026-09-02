import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { parseHTML } from "linkedom";
import {
  collectListing,
  getCommunityRules,
  prepareReplyDraft,
  readThread
} from "../src/api/dom";

const fixtureDirectory = path.join(process.cwd(), "test");

type DomFixture = Awaited<ReturnType<typeof installFixture>>;

async function installFixture(name: string, url: string) {
  const html = await readFile(path.join(fixtureDirectory, name), "utf8");
  const { document, window: domWindow } = parseHTML(html);
  const location = new URL(url);
  let scrollY = 0;
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const globals = {
    document,
    window: {
      location,
      innerHeight: 900,
      get scrollY() { return scrollY; },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      setInterval: globalThis.setInterval.bind(globalThis),
      clearInterval: globalThis.clearInterval.bind(globalThis),
      getComputedStyle(element: HTMLElement) {
        const hidden = element.closest("[hidden]") !== null;
        return { display: hidden ? "none" : "block", visibility: "visible" };
      },
      scrollBy(options: ScrollToOptions) { scrollY += Number(options.top ?? 0); },
      scrollTo(options: ScrollToOptions) { scrollY = Number(options.top ?? 0); },
      getSelection: domWindow.getSelection?.bind(domWindow) ?? (() => null)
    },
    Element: domWindow.Element,
    HTMLElement: domWindow.HTMLElement,
    HTMLButtonElement: domWindow.HTMLButtonElement,
    HTMLInputElement: domWindow.HTMLInputElement,
    HTMLTextAreaElement: domWindow.HTMLTextAreaElement,
    HTMLTimeElement: domWindow.HTMLTimeElement,
    ShadowRoot: domWindow.ShadowRoot,
    MutationObserver: domWindow.MutationObserver,
    InputEvent: domWindow.InputEvent,
    Event: domWindow.Event
  };

  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }

  Object.defineProperty(domWindow.HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value() {
      const hidden = (this as HTMLElement).closest("[hidden]") !== null;
      return { x: 0, y: 0, top: 0, left: 0, right: hidden ? 0 : 100, bottom: hidden ? 0 : 20, width: hidden ? 0 : 100, height: hidden ? 0 : 20 };
    }
  });
  Object.defineProperty(domWindow.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value() {}
  });
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value() { return false; }
  });

  return {
    document,
    window: globals.window,
    restore() {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete (globalThis as Record<string, unknown>)[key];
      }
    }
  };
}

async function withFixture<T>(name: string, url: string, action: (fixture: DomFixture) => Promise<T> | T) {
  const fixture = await installFixture(name, url);
  try {
    return await action(fixture);
  } finally {
    fixture.restore();
  }
}

test("collects modern listings with stable and deterministic fallback IDs", async () => {
  await withFixture("modern-listing.html", "https://www.reddit.com/r/typescript/new/?sort=new", async () => {
    const result = await collectListing({ limit: 10, maxScrolls: 0 });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pageContext.pageType, "listing");
    assert.equal(result.pageContext.authentication, "signed_in");
    assert.deepEqual(result.posts.map(post => post.postId), [
      "t3_modern1",
      "url:https://www.reddit.com/r/typescript/s/shared-link",
      "fp:v1:th5zts"
    ]);
    assert.deepEqual(result.posts.map(post => post.stability), ["fullname", "permalink", "fingerprint"]);
    assert.equal(result.posts[0].score, 1_200);
    assert.equal(result.posts.some(post => post.postId === "t3_advert"), false);
  });
});

test("collects old Reddit listings", async () => {
  await withFixture("legacy-listing.html", "https://old.reddit.com/r/javascript/hot/", async () => {
    const result = await collectListing({ limit: 5, maxScrolls: 0 });
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) return;
    assert.equal(result.pageContext.pageType, "listing");
    assert.equal(result.pageContext.authentication, "signed_in");
    assert.equal(result.posts[0].postId, "t3_legacy1");
    assert.equal(result.posts[0].title, "Legacy listing post");
    assert.equal(result.posts[0].body, "Legacy body text.");
  });
});

test("collects current Reddit search SDUI listings", async () => {
  await withFixture("search-listing.html", "https://www.reddit.com/search/?q=self-hosted+internal+apps&type=posts", async () => {
    const result = await collectListing({ limit: 10, maxScrolls: 0 });
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) return;
    assert.equal(result.pageContext.pageType, "search");
    assert.deepEqual(result.posts.map(post => post.postId), ["t3_search1", "t3_search2"]);
    assert.deepEqual(result.posts.map(post => post.title), ["Current Reddit search result", "Fallback search result"]);
    assert.equal(result.posts[0].permalink, "https://www.reddit.com/r/selfhosted/comments/search1/current_reddit_search_result/");
    assert.equal(result.posts[0].subreddit, "r/selfhosted");
    assert.equal(result.posts[0].author, "search_author");
    assert.equal(result.posts[0].score, 1_400);
    assert.equal(result.posts[0].commentCount, 83);
    assert.equal(result.posts[0].createdAt, "2026-09-01T10:11:30.613Z");
    assert.equal(result.posts[0].nsfw, true);
    assert.equal(result.posts[0].spoiler, false);
    assert.equal(result.posts[1].author, null);
    assert.equal(result.posts[1].score, 42);
    assert.equal(result.posts[1].commentCount, 7);
    assert.equal(result.posts.some(post => post.postId === "t3_search_ad"), false);
  });
});

test("reads modern and legacy threads with stable comment relationships", async () => {
  await withFixture("fixture.html", "https://www.reddit.com/r/typescript/comments/abc123/webmcp_fixture?sort=best", async () => {
    const result = await readThread({ limit: 10, maxDepth: 4, maxExpansions: 0 });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.post?.postId, "t3_abc123");
    assert.deepEqual(result.comments.map(comment => [comment.commentId, comment.parentId, comment.depth]), [
      ["t1_reply1", "t3_abc123", 0],
      ["t1_reply2", "t1_reply1", 1]
    ]);
    assert.equal(result.comments[1].isOp, true);
  });

  await withFixture("legacy-thread.html", "https://old.reddit.com/r/javascript/comments/legacythread/a_legacy_thread/", async () => {
    const result = await readThread({ limit: 10, maxDepth: 4, maxExpansions: 0 });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.post?.postId, "t3_legacythread");
    assert.deepEqual(result.comments.map(comment => comment.commentId), ["t1_oldreply1", "t1_oldreply2"]);
    assert.equal(result.comments[1].isModerator, true);
  });
});

test("clamps collection/depth/expansion limits and expands only bounded visible controls", async () => {
  await withFixture("modern-listing.html", "https://www.reddit.com/r/typescript/new/", async () => {
    const result = await collectListing({ limit: 500, maxScrolls: 0 });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.requestedLimit, 50);
    assert.equal(result.scrollsPerformed, 0);
  });

  await withFixture("fixture.html", "https://www.reddit.com/r/typescript/comments/abc123/webmcp_fixture", async ({ document }) => {
    const main = document.querySelector("main")!;
    const expansion = document.createElement("button");
    expansion.textContent = "View more comments";
    expansion.addEventListener("click", () => {
      const comment = document.createElement("shreddit-comment");
      comment.setAttribute("thingid", "t1_expanded");
      comment.setAttribute("parentid", "t3_abc123");
      comment.setAttribute("depth", "0");
      comment.innerHTML = '<div slot="comment">Expanded comment.</div>';
      main.append(comment);
      expansion.remove();
    });
    main.append(expansion);

    const result = await readThread({ limit: 500, maxDepth: 500, maxExpansions: 500 });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.requestedLimit, 200);
    assert.equal(result.maxDepth, 20);
    assert.equal(result.expansionsPerformed, 1);
    assert.equal(result.comments.some(comment => comment.commentId === "t1_expanded"), true);

    const depthLimited = await readThread({ limit: 10, maxDepth: 0, maxExpansions: 0 });
    assert.equal(depthLimited.ok, true);
    if (!depthLimited.ok) return;
    assert.equal(depthLimited.comments.some(comment => comment.commentId === "t1_reply2"), false);
  });
});

test("reads sidebar, complete rules page, and mod-rules redirect layouts", async () => {
  await withFixture("fixture.html", "https://www.reddit.com/r/typescript/comments/abc123/webmcp_fixture", () => {
    const result = getCommunityRules();
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.complete, false);
    assert.equal(result.source, "current_page_sidebar");
    assert.deepEqual(result.rules.map(rule => rule.title), ["Be constructive", "Stay on topic"]);
  });

  await withFixture("rules-page.html", "https://www.reddit.com/r/typescript/about/rules", () => {
    const result = getCommunityRules();
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.complete, true);
    assert.deepEqual(result.rules.map(rule => rule.title), ["Use descriptive titles", "No spam"]);
  });

  await withFixture("mod-rules-fixture.html", "https://www.reddit.com/mod/typescript/rules/", () => {
    const result = getCommunityRules();
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.pageContext.subreddit, "r/typescript");
    assert.deepEqual(result.rules.map(rule => [rule.number, rule.title]), [[1, "Be constructive"], [2, "Stay on topic"]]);
  });
});

test("reports human verification, network blocks, and signed-out draft attempts", async () => {
  await withFixture("modern-listing.html", "https://www.reddit.com/r/typescript/", async ({ document }) => {
    document.body.textContent = "Prove your humanity. Complete the challenge.";
    const result = await collectListing({ maxScrolls: 0 });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "HUMAN_VERIFICATION_REQUIRED");
    assert.equal(result.pageContext.pageType, "blocked");
  });

  await withFixture("modern-listing.html", "https://www.reddit.com/r/typescript/", async ({ document }) => {
    document.body.textContent = "You've been blocked by network security.";
    const result = await readThread();
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "NETWORK_BLOCKED");
    assert.equal(result.error.retryable, false);
  });

  await withFixture("fixture.html", "https://www.reddit.com/r/typescript/comments/abc123/webmcp_fixture", async ({ document }) => {
    const login = document.createElement("button");
    login.textContent = "Log in";
    document.body.append(login);
    const result = await prepareReplyDraft("t1_reply1", "A draft");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "SIGN_IN_REQUIRED");
  });
});

test("inserts and verifies reply drafts, refuses conflicts, and never submits", async () => {
  await withFixture("fixture.html", "https://www.reddit.com/r/typescript/comments/abc123/webmcp_fixture", async ({ document }) => {
    const control = document.querySelector<HTMLButtonElement>("shreddit-comment[thingid='t1_reply1'] button[aria-label='Reply']")!;
    control.addEventListener("click", () => document.querySelector("#reply-editor")?.removeAttribute("hidden"));
    const postControl = document.querySelector<HTMLButtonElement>("shreddit-post button[aria-label='Add a comment']")!;
    postControl.addEventListener("click", () => document.querySelector("#post-editor")?.removeAttribute("hidden"));

    const text = "A fixture reply that must remain a draft.";
    const result = await prepareReplyDraft("t1_reply1", text);
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) return;
    assert.equal(result.draft.verified, true);
    assert.equal(result.submitted, false);
    assert.equal(document.querySelector("#reply-editor-input")?.textContent, text);
    assert.equal(document.body.dataset.submitCount, "0");

    const conflict = await prepareReplyDraft("t1_reply1", "Do not overwrite the first draft.");
    assert.equal(conflict.ok, false);
    if (conflict.ok) return;
    assert.equal(conflict.error.code, "EDITOR_NOT_EMPTY");
    assert.equal(document.querySelector("#reply-editor-input")?.textContent, text);
    assert.equal(document.body.dataset.submitCount, "0");

    const postDraft = await prepareReplyDraft("t3_abc123", "A post-level draft.");
    assert.equal(postDraft.ok, true, JSON.stringify(postDraft));
    if (!postDraft.ok) return;
    assert.equal(document.querySelector<HTMLTextAreaElement>("#post-editor textarea")?.value, "A post-level draft.");
    assert.equal(postDraft.submitted, false);
    assert.equal(document.body.dataset.submitCount, "0");
  });
});

test("opens the modern post composer and inserts a contenteditable draft exactly once", async () => {
  await withFixture("modern-reply-editor.html", "https://www.reddit.com/r/typescript/comments/modernreply/modern_post_composer_fixture/", async ({ document }) => {
    const trigger = document.querySelector<HTMLElement>("#modern-post-trigger")!;
    const host = document.querySelector<HTMLElement>("comment-composer-host[post-id='t3_modernreply']")!;
    const editor = document.querySelector<HTMLElement>("#modern-post-editor")!;
    trigger.addEventListener("click", () => host.removeAttribute("hidden"));

    let syntheticInsertions = 0;
    editor.addEventListener("input", event => {
      const data = (event as InputEvent).data;
      if (!data) return;
      syntheticInsertions += 1;
      editor.textContent = `${editor.textContent ?? ""}${data}`;
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value(command: string, _showUi: boolean, value: string) {
        if (command !== "insertText") return false;
        const blocks = value.split("\n").map(line => {
          const paragraph = document.createElement("p");
          if (line) paragraph.textContent = line;
          else paragraph.append(document.createElement("br"));
          return paragraph;
        });
        const lexicalRoot = document.createElement("div");
        lexicalRoot.append(...blocks);
        editor.replaceChildren(lexicalRoot);
        return true;
      }
    });

    const text = "A modern post-level draft that must be inserted once.\n\nThe second paragraph must survive Lexical readback.";
    const result = await prepareReplyDraft("t3_modernreply", text);
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) return;
    assert.equal(result.draft.text, text);
    assert.deepEqual([...editor.children[0].children].map(child => child.textContent), [
      "A modern post-level draft that must be inserted once.",
      "",
      "The second paragraph must survive Lexical readback."
    ]);
    assert.equal(syntheticInsertions, 0);
    assert.equal(result.submitted, false);
    assert.equal(document.body.dataset.submitCount, "0");

    const conflict = await prepareReplyDraft("t3_modernreply", "Do not overwrite the verified modern draft.");
    assert.equal(conflict.ok, false);
    if (conflict.ok) return;
    assert.equal(conflict.error.code, "EDITOR_NOT_EMPTY");
    assert.equal(editor.textContent, text.replaceAll("\n", ""));
    assert.equal(document.body.dataset.submitCount, "0");
  });
});

test("activates Reddit's custom textarea trigger with pointer and focus events", async () => {
  await withFixture("modern-reply-editor.html", "https://www.reddit.com/r/typescript/comments/modernreply/modern_post_composer_fixture/", async ({ document }) => {
    const trigger = document.querySelector<HTMLElement>("#modern-post-trigger")!;
    const host = document.querySelector<HTMLElement>("comment-composer-host[post-id='t3_modernreply']")!;
    const shadow = trigger.attachShadow({ mode: "open" });
    const textarea = document.createElement("textarea");
    shadow.append(textarea);
    textarea.addEventListener("pointerdown", () => host.removeAttribute("hidden"));

    const result = await prepareReplyDraft("t3_modernreply", "A draft opened through the custom trigger.");
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) return;
    assert.equal(result.submitted, false);
    assert.equal(document.querySelector<HTMLElement>("#modern-post-editor")?.textContent, result.draft.text);
  });
});

test("does not reuse an existing unscoped post composer for a comment reply", async () => {
  await withFixture("modern-reply-editor.html", "https://www.reddit.com/r/typescript/comments/modernreply/modern_post_composer_fixture/", async ({ document }) => {
    const postHost = document.querySelector<HTMLElement>("comment-composer-host[post-id='t3_modernreply']")!;
    const postEditor = document.querySelector<HTMLElement>("#modern-post-editor")!;
    postHost.removeAttribute("hidden");
    postEditor.textContent = "Keep this post draft unchanged.";

    const comment = document.createElement("shreddit-comment");
    comment.setAttribute("thingid", "t1_commentreply");
    comment.setAttribute("parentid", "t3_modernreply");
    comment.setAttribute("postid", "t3_modernreply");
    comment.setAttribute("author", "comment_author");
    comment.innerHTML = '<div slot="comment">A comment with an external reply composer.</div><button type="button" aria-label="Reply">Reply</button>';
    document.querySelector("main")?.append(comment);

    const commentEditor = document.createElement("div");
    commentEditor.setAttribute("contenteditable", "true");
    commentEditor.setAttribute("role", "textbox");
    commentEditor.setAttribute("hidden", "");
    document.querySelector("main")?.append(commentEditor);
    comment.querySelector("button")?.addEventListener("click", () => commentEditor.removeAttribute("hidden"));

    const text = "A comment-specific draft.";
    const result = await prepareReplyDraft("t1_commentreply", text);
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) return;
    assert.equal(commentEditor.textContent, text);
    assert.equal(postEditor.textContent, "Keep this post draft unchanged.");
    assert.equal(result.submitted, false);
  });
});
