import { compactText, subredditFromPath } from "./dom-helpers";
import type { PageContext, PageType } from "./types";

function accessStatus(): PageContext["access"] {
  const text = compactText(document.body?.innerText, 4_000).toLowerCase();
  if (text.includes("prove your humanity") || text.includes("complete the challenge")) {
    return "human_verification_required";
  }
  if (text.includes("blocked by network security") || text.includes("you've been blocked")) {
    return "network_blocked";
  }
  return "available";
}

function authenticationStatus(): PageContext["authentication"] {
  if (document.querySelector([
    "[data-testid='user-drawer-button']",
    "button[aria-label*='user menu' i]",
    "a[href^='/settings/']",
    "#header-bottom-right .user a[href*='/user/']"
  ].join(","))) {
    return "signed_in";
  }
  const login = [...document.querySelectorAll<HTMLElement>("a, button")].some(element =>
    /^(log in|sign in|войти)$/i.test(compactText(element.innerText, 100))
  );
  return login ? "signed_out" : "unknown";
}

export function pageContext(): PageContext {
  const pathname = window.location.pathname;
  const url = new URL(window.location.href);
  const access = accessStatus();
  const threadMatch = pathname.match(/^\/r\/([^/]+)\/comments\/([a-z0-9]+)/i);
  let pageType: PageType = "unknown";
  if (access !== "available") pageType = "blocked";
  else if (/\/about\/rules\/?$/i.test(pathname) || /^\/mod\/[^/]+\/rules\/?$/i.test(pathname)) pageType = "community_rules";
  else if (threadMatch) pageType = "thread";
  else if (/\/submit\/?$/i.test(pathname)) pageType = "submit";
  else if (/^\/(?:r\/[^/]+\/)?search\/?$/i.test(pathname)) pageType = "search";
  else if (/^\/(?:user|u)\/[^/]+/i.test(pathname)) pageType = "user_profile";
  else if (pathname === "/" || /^\/r\/[^/]+\/(?:best|hot|new|top|rising|controversial)?\/?$/i.test(pathname) || /^\/(?:best|hot|new|top|rising)\/?$/i.test(pathname)) {
    pageType = "listing";
  }

  const pathSort = pathname.match(/\/(best|hot|new|top|rising|controversial)\/?$/i)?.[1];
  return {
    url: window.location.href,
    pageType,
    subreddit: threadMatch ? `r/${decodeURIComponent(threadMatch[1])}` : subredditFromPath(pathname),
    postId: threadMatch ? `t3_${threadMatch[2].toLowerCase()}` : null,
    sort: url.searchParams.get("sort") || pathSort?.toLowerCase() || null,
    access,
    authentication: authenticationStatus()
  };
}
