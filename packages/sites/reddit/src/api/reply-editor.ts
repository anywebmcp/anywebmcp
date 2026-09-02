import {
  compactText,
  composedAncestor,
  deepQueryAll,
  delay,
  isVisible,
  unique
} from "./dom-helpers";
import { accessFailure, failure, unexpectedFailure } from "./errors";
import { pageContext } from "./page-context";
import { candidatePostRoots, scanPosts } from "./posts";
import { resolveTarget } from "./registry";
import { candidateCommentRoots } from "./thread";
import { MAX_DRAFT_TEXT } from "./types";

const TARGET_ROOT_SELECTOR = [
  "shreddit-post",
  "article[data-testid='post-container']",
  "div[data-testid='post-container']",
  ".Post",
  ".thing.link",
  "shreddit-comment",
  "article[data-testid='comment']",
  "div[data-testid='comment']",
  ".Comment",
  ".thing.comment"
].join(",");

const LEXICAL_BLOCK_TAGS = new Set([
  "ADDRESS",
  "BLOCKQUOTE",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "P",
  "PRE"
]);

function targetRoots() {
  return unique([...candidatePostRoots(), ...candidateCommentRoots()]);
}

function editorText(editor: HTMLElement) {
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) return editor.value;
  if (editor.getAttribute("data-lexical-editor") === "true" && editor.children.length) {
    let value = "";
    const visit = (node: Node) => {
      if (node.nodeType === 3) {
        value += node.nodeValue ?? "";
        return;
      }
      if (!(node instanceof HTMLElement)) return;
      if (node.tagName === "BR") {
        value += "\n";
        return;
      }
      const block = LEXICAL_BLOCK_TAGS.has(node.tagName);
      const lengthBeforeChildren = value.length;
      for (const child of node.childNodes) visit(child);
      if (block && value.length === lengthBeforeChildren) value += "\n";
      else if (block && !value.endsWith("\n")) value += "\n";
    };
    for (const child of editor.childNodes) visit(child);
    return value
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/\n$/, "");
  }
  return String(editor.innerText ?? editor.textContent ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ");
}

function comparableEditorText(value: unknown) {
  return String(value ?? "").replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
}

function findEditors(root: Document | ShadowRoot | Element = document) {
  return deepQueryAll<HTMLElement>([
    "textarea[name='text']",
    "textarea[placeholder*='comment' i]",
    "textarea[placeholder*='reply' i]",
    "[contenteditable='true'][role='textbox']",
    "[contenteditable='true'][data-lexical-editor='true']"
  ].join(","), root).filter(isVisible);
}

function postComposerHosts(targetId: string) {
  if (!targetId.startsWith("t3_")) return [];
  return deepQueryAll<HTMLElement>(`comment-composer-host[post-id="${targetId}"]`);
}

function postComposerRoots(targetId: string) {
  const hosts = postComposerHosts(targetId);
  const loaders = hosts
    .map(host => composedAncestor(host, "shreddit-async-loader"))
    .filter((loader): loader is HTMLElement => loader instanceof HTMLElement);
  return unique([...loaders, ...hosts]);
}

function replyControls(root: HTMLElement, targetId: string) {
  const commentPattern = /^(reply|respond|ответить)$/i;
  const postPattern = /^(add a comment|leave a comment|join the conversation|comment|комментировать|оставить комментарий)$/i;
  const pattern = targetId.startsWith("t1_") ? commentPattern : postPattern;
  const eligible = (control: HTMLElement) => {
    if (control instanceof HTMLButtonElement && control.disabled) return false;
    if (control.getAttribute("aria-disabled") === "true") return false;
    if (!isVisible(control)) return false;
    if (composedAncestor(control, "shreddit-composer, form.comment, .usertext-edit")) return false;
    const label = compactText(
      control.getAttribute("aria-label") ||
      control.getAttribute("placeholder") ||
      control.getAttribute("aria-placeholder") ||
      control.innerText,
      200
    );
    return pattern.test(label);
  };
  const controlSelector = [
    "button",
    "a[data-event-action='comment']",
    "a[role='button']",
    "faceplate-textarea-input[data-testid='trigger-button']"
  ].join(",");
  const roots = targetId.startsWith("t1_") ? [root] : unique([root, ...postComposerRoots(targetId)]);
  const scoped = unique(roots.flatMap(candidate => deepQueryAll<HTMLElement>(controlSelector, candidate)))
    .filter(eligible);
  if (scoped.length || targetId.startsWith("t1_")) return scoped;
  return deepQueryAll<HTMLElement>([
    "main button",
    "main a[role='button']",
    ".commentarea button",
    "main faceplate-textarea-input[data-testid='trigger-button']"
  ].join(","))
    .filter(eligible);
}

function findEditorForTarget(
  target: HTMLElement,
  previousEditors: Set<HTMLElement>,
  targetId: string,
  allowNewUnscopedEditor = false
) {
  const postComposerEditors = postComposerHosts(targetId).flatMap(host => findEditors(host));
  if (postComposerEditors.length) {
    return postComposerEditors.find(editor => !previousEditors.has(editor)) || postComposerEditors[0];
  }
  const scoped = findEditors(target);
  if (scoped.length) return scoped.find(editor => !previousEditors.has(editor)) || scoped[0];
  if (!allowNewUnscopedEditor) return null;
  const all = findEditors();
  const newlyOpened = all.find(editor =>
    !previousEditors.has(editor) && !composedAncestor(editor, TARGET_ROOT_SELECTOR)
  );
  if (newlyOpened) return newlyOpened;
  if (!targetId.startsWith("t3_") || all.length !== 1) return null;
  const owner = composedAncestor(all[0], TARGET_ROOT_SELECTOR);
  return owner ? null : all[0];
}

function waitForEditor(target: HTMLElement, previousEditors: Set<HTMLElement>, targetId: string, timeoutMs: number) {
  return new Promise<HTMLElement | null>(resolve => {
    let finished = false;
    const finish = (editor: HTMLElement | null) => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      resolve(editor);
    };
    const inspect = () => {
      try {
        const editor = findEditorForTarget(target, previousEditors, targetId, true);
        if (editor) finish(editor);
      } catch {}
    };
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(inspect, 150);
    const timeout = window.setTimeout(() => finish(null), timeoutMs);
    inspect();
  });
}

function activationEvent(type: string) {
  const options = { bubbles: true, cancelable: true, composed: true };
  if (type.startsWith("pointer") && typeof PointerEvent === "function") {
    return new PointerEvent(type, { ...options, button: 0, buttons: type === "pointerdown" ? 1 : 0, pointerType: "mouse" });
  }
  if (typeof MouseEvent === "function") {
    return new MouseEvent(type, { ...options, button: 0, buttons: type === "mousedown" ? 1 : 0 });
  }
  return new Event(type, options);
}

async function activateReplyControl(control: HTMLElement) {
  control.scrollIntoView({ block: "center", behavior: "auto" });
  if (!control.matches("faceplate-textarea-input[data-testid='trigger-button']")) {
    control.click();
    return;
  }

  const innerControl = deepQueryAll<HTMLElement>("textarea", control)[0] || control;
  for (const type of ["pointerover", "mouseover", "pointerdown", "mousedown"]) {
    innerControl.dispatchEvent(activationEvent(type));
  }
  innerControl.focus();
  for (const type of ["pointerup", "mouseup", "click"]) {
    innerControl.dispatchEvent(activationEvent(type));
  }
  await delay(50);
}

function dispatchEditorEvents(editor: HTMLElement, text: string | null) {
  editor.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    composed: true,
    inputType: "insertText",
    data: text
  }));
  editor.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
}

async function insertDraft(editor: HTMLElement, text: string) {
  editor.focus();
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    const prototype = editor instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    setter?.call(editor, text);
    if (!setter) editor.value = text;
    dispatchEditorEvents(editor, text);
    await delay(250);
    return editorText(editor);
  }

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  selection?.removeAllRanges();
  selection?.addRange(range);
  const inserted = document.execCommand("insertText", false, text);
  await delay(250);
  if (comparableEditorText(editorText(editor)) === comparableEditorText(text)) return editorText(editor);
  if (inserted && editorText(editor).trim()) return editorText(editor);

  editor.textContent = text;
  dispatchEditorEvents(editor, null);
  await delay(250);
  return editorText(editor);
}

export async function prepareReplyDraft(targetId: string, text: string) {
  try {
    const blocked = accessFailure();
    if (blocked) return blocked;
    if (!/^t[13]_[a-z0-9]+$/i.test(targetId)) {
      return failure("INVALID_TARGET_ID", "The target must be a Reddit post or comment fullname.", {
        suggestedAction: "Use a postId or commentId returned by a Reddit read tool, such as t3_abc or t1_xyz."
      });
    }
    if (typeof text !== "string" || !text.trim()) {
      return failure("INVALID_DRAFT", "Draft text cannot be empty.", {
        suggestedAction: "Provide a non-empty reply draft."
      });
    }
    if (text.length > MAX_DRAFT_TEXT) {
      return failure("DRAFT_TOO_LONG", `Draft text exceeds the ${MAX_DRAFT_TEXT}-character adapter limit.`, {
        diagnostics: { length: text.length, maximumLength: MAX_DRAFT_TEXT },
        suggestedAction: "Provide a shorter reply draft."
      });
    }
    if (pageContext().authentication === "signed_out") {
      return failure("SIGN_IN_REQUIRED", "Reddit requires a signed-in account to prepare a reply draft.", {
        retryable: true,
        suggestedAction: "Sign in to Reddit in this browser, return to the thread, and retry."
      });
    }

    scanPosts();
    const normalizedTargetId = targetId.toLowerCase();
    const roots = targetRoots();
    const target = resolveTarget(normalizedTargetId, roots);
    if (!target) {
      return failure("TARGET_NOT_FOUND", "The requested Reddit post or comment is not mounted in the current page.", {
        retryable: true,
        diagnostics: { targetId: normalizedTargetId, mountedTargets: roots.length },
        suggestedAction: "Open the target thread, read it again, and retry with a returned postId or commentId."
      });
    }

    target.scrollIntoView({ block: "center", behavior: "auto" });
    await delay(150);
    const previousEditors = new Set(findEditors());
    let editor = findEditorForTarget(target, previousEditors, normalizedTargetId);

    if (!editor) {
      const control = replyControls(target, normalizedTargetId)[0];
      if (!control) {
        return failure("REPLY_CONTROL_NOT_FOUND", "Could not find Reddit's reply control for the requested target.", {
          retryable: true,
          diagnostics: { targetId: normalizedTargetId, targetTag: target.tagName.toLowerCase() },
          suggestedAction: "Reload the thread or open the target permalink, then retry."
        });
      }
      await activateReplyControl(control);
      editor = await waitForEditor(target, previousEditors, normalizedTargetId, 8_000);
    }

    if (!editor) {
      return failure("EDITOR_LOAD_FAILED", "Reddit did not expose a reply editor for the requested target.", {
        retryable: true,
        diagnostics: { targetId: normalizedTargetId },
        suggestedAction: "Wait for the page to finish loading, then retry."
      });
    }

    const existingText = editorText(editor);
    if (existingText.trim() && comparableEditorText(existingText) !== comparableEditorText(text)) {
      return failure("EDITOR_NOT_EMPTY", "The Reddit reply editor already contains a different draft, so it was left unchanged.", {
        retryable: false,
        diagnostics: { targetId: normalizedTargetId, existingLength: existingText.length },
        suggestedAction: "Review or clear the existing draft manually before retrying."
      });
    }

    const verifiedText = existingText.trim() ? existingText : await insertDraft(editor, text);
    if (comparableEditorText(verifiedText) !== comparableEditorText(text)) {
      return failure("DRAFT_VERIFICATION_FAILED", "The text read back from Reddit's editor did not match the requested draft.", {
        retryable: true,
        diagnostics: {
          targetId: normalizedTargetId,
          requestedLength: text.length,
          observedLength: verifiedText.length
        },
        suggestedAction: "Inspect the visible editor and retry only if it is safe to replace."
      });
    }

    editor.scrollIntoView({ block: "center", behavior: "auto" });
    editor.focus();
    return {
      ok: true as const,
      pageContext: pageContext(),
      targetId: normalizedTargetId,
      targetType: normalizedTargetId.startsWith("t1_") ? "comment" : "post",
      draft: {
        text: verifiedText,
        length: verifiedText.length,
        verified: true
      },
      submitted: false,
      requiresUserReview: true,
      note: "The draft is visible in Reddit's editor. Review it and use Reddit's own submit control to publish."
    };
  } catch (error) {
    return unexpectedFailure(error);
  }
}
