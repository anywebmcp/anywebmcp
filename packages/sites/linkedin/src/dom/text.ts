import { MAX_POST_TEXT } from "./constants";

export function cleanText(value: unknown, maxLength = MAX_POST_TEXT) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function editorText(editor: HTMLElement | null) {
  return String(editor?.innerText ?? editor?.textContent ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ");
}

export function comparableEditorText(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ");
}
