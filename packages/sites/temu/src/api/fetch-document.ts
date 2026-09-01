import { isAuthenticationRequired, isSecurityVerification } from "./parsing";

export async function fetchDocument(url: string, signal?: AbortSignal) {
  const target = new URL(url);
  if (target.origin !== window.location.origin) {
    target.protocol = window.location.protocol;
    target.host = window.location.host;
  }
  const response = await fetch(target.href, {
    method: "GET",
    credentials: "include",
    headers: { accept: "text/html,application/xhtml+xml" },
    signal
  });
  const html = await response.text();
  if (!response.ok) {
    throw new Error(`Temu returned HTTP ${response.status} for ${target.pathname}.`);
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const responseUrl = response.url || target.href;
  const base = doc.createElement("base");
  base.href = responseUrl;
  doc.head.prepend(base);
  return {
    doc,
    url: responseUrl,
    verification: isSecurityVerification(doc.body?.innerText || html, responseUrl),
    authenticationRequired: isAuthenticationRequired(doc.body?.innerText || html, responseUrl)
  };
}
