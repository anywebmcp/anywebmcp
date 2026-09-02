import { HACKER_NEWS_ORIGIN } from "@anywebmcp/site-hackernews/transport/protocol";
import { installHackerNewsBridge, type RuntimeApi } from "./hackernews-bridge";

declare const chrome: { runtime: RuntimeApi };

if (typeof window !== "undefined"
  && typeof chrome !== "undefined"
  && window.location.origin === HACKER_NEWS_ORIGIN) {
  installHackerNewsBridge(window, chrome.runtime);
}
