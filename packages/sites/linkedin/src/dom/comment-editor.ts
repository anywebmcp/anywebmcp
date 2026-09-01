import { failure, unexpectedFailure } from "../api/failures";
import { MAX_DRAFT_TEXT } from "./constants";
import { ensurePostInternal, isVisible } from "./recovery";
import { publicPost, resolvePost } from "./registry";
import { delay, waitForCondition } from "./scroll";
import { cleanText, comparableEditorText, editorText } from "./text";

function findCommentButton(root: HTMLElement) {
  const exactLabels = ["Comment", "Comment on this post", "Комментировать", "Оставить комментарий"];
  for (const label of exactLabels) {
    const button = root.querySelector<HTMLButtonElement>(`button[aria-label="${CSS.escape(label)}"]`);
    if (button) return button;
  }
  for (const selector of ["button[data-view-name='feed-comment-button']", "button.comment-button"]) {
    const button = root.querySelector<HTMLButtonElement>(selector);
    if (button) return button;
  }
  return [...root.querySelectorAll<HTMLButtonElement>("button")].find(button =>
    /^(comment|комментировать)$/i.test(cleanText(button.innerText, 100))
  ) || null;
}

function findCommentEditor(root: HTMLElement) {
  const selectors = [
    ".comments-comment-box__form [contenteditable='true'][role='textbox']",
    ".comments-comment-box__form .ql-editor[contenteditable='true']",
    "[data-view-name='comment-box'] [contenteditable='true'][role='textbox']",
    "[contenteditable='true'][role='textbox']"
  ];
  for (const selector of selectors) {
    const editor = root.querySelector<HTMLElement>(selector);
    if (editor) return editor;
  }
  return null;
}

function findRetryButton(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLButtonElement>("button")].find(button =>
    /^(try again|retry|повторить|попробовать снова)$/i.test(cleanText(button.innerText, 100))
  ) || null;
}

function waitForCommentEditor(postId: string, timeoutMs: number) {
  return waitForCondition(() => {
    const resolved = resolvePost(postId);
    return resolved.current ? findCommentEditor(resolved.current.root) : null;
  }, timeoutMs);
}

function selectEditableContents(editor: HTMLElement) {
  editor.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function dispatchEditorEvents(editor: HTMLElement, text: string) {
  editor.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    composed: true,
    inputType: "insertText",
    data: text
  }));
  editor.dispatchEvent(new Event("change", { bubbles: true }));
}

async function replaceEditableText(editor: HTMLElement, text: string) {
  selectEditableContents(editor);
  document.execCommand("insertText", false, text);
  dispatchEditorEvents(editor, text);
  await delay(200);
  if (comparableEditorText(editorText(editor)) === comparableEditorText(text)) return editorText(editor);

  editor.focus();
  editor.textContent = text;
  dispatchEditorEvents(editor, text);
  await delay(250);
  return editorText(editor);
}

export async function prepareCommentDraft(postId: string, text: string) {
  try {
    if (typeof text !== "string" || !text.trim()) {
      return failure("INVALID_DRAFT", "Draft text cannot be empty.", {
        postId,
        suggestedAction: "Provide a non-empty comment draft."
      });
    }
    if (text.length > MAX_DRAFT_TEXT) {
      return failure("DRAFT_TOO_LONG", `Draft text exceeds the ${MAX_DRAFT_TEXT}-character adapter limit.`, {
        postId,
        diagnostics: { length: text.length, maximumLength: MAX_DRAFT_TEXT },
        suggestedAction: "Provide a shorter comment draft."
      });
    }

    const ensured = await ensurePostInternal(postId, { maxScrolls: 8, focus: true });
    if (!ensured.ok) return ensured;

    let editor = findCommentEditor(ensured.post.root);
    if (!editor) {
      const button = findCommentButton(ensured.post.root);
      if (!button) {
        return failure("COMMENT_BUTTON_NOT_FOUND", "Could not find LinkedIn's Comment button for this post.", {
          postId,
          retryable: true,
          diagnostics: { postMounted: true, postVisible: isVisible(ensured.post.root) },
          suggestedAction: "Reload LinkedIn or open the post permalink, then retry."
        });
      }
      button.click();
      editor = await waitForCommentEditor(postId, 8_000);
    }

    if (!editor) {
      const refreshed = resolvePost(postId).current;
      const retryButton = refreshed && findRetryButton(refreshed.root);
      if (retryButton) {
        retryButton.click();
        editor = await waitForCommentEditor(postId, 5_000);
      }
    }

    if (!editor) {
      const refreshed = resolvePost(postId);
      return failure("EDITOR_LOAD_FAILED", "LinkedIn did not expose a comment editor for this post.", {
        postId,
        retryable: true,
        diagnostics: {
          postMounted: Boolean(refreshed.current),
          postVisible: Boolean(refreshed.current && isVisible(refreshed.current.root)),
          url: refreshed.snapshot?.url || null
        },
        suggestedAction: refreshed.snapshot?.url
          ? "Open the post URL, wait for it to finish loading, then retry."
          : "Reload LinkedIn, collect posts again, and retry with the refreshed postId."
      });
    }

    const existingText = editorText(editor);
    if (existingText.trim() && comparableEditorText(existingText) !== comparableEditorText(text)) {
      return failure("EDITOR_NOT_EMPTY", "The LinkedIn comment editor already contains a different draft, so it was left unchanged.", {
        postId,
        retryable: false,
        diagnostics: { existingLength: existingText.length },
        suggestedAction: "Review or clear the existing draft manually before retrying."
      });
    }

    const actualText = existingText.trim() ? existingText : await replaceEditableText(editor, text);
    const matchesExpected = comparableEditorText(actualText) === comparableEditorText(text);
    if (!matchesExpected) {
      return {
        ...failure("DRAFT_VERIFICATION_FAILED", "The text visible in LinkedIn's editor does not exactly match the requested draft.", {
          postId,
          retryable: true,
          diagnostics: { expectedLength: text.length, actualLength: actualText.length },
          suggestedAction: "Do not submit. Retry once or replace the editor text manually."
        }),
        prepared: false,
        submitted: false,
        editorOpen: true,
        text: actualText,
        matchesExpected: false
      };
    }

    const refreshed = resolvePost(postId).current || ensured.post;
    return {
      ok: true as const,
      prepared: true,
      submitted: false,
      editorOpen: true,
      post: publicPost(refreshed),
      text: actualText,
      matchesExpected: true,
      nextStep: "The user must review the verified field and click LinkedIn's Comment button manually."
    };
  } catch (error) {
    return unexpectedFailure(error, postId);
  }
}
