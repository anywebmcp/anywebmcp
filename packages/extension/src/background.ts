import {
  createHackerNewsWorkerDependencies,
  handleHackerNewsBackgroundRequest
} from "@anywebmcp/site-hackernews/transport/background";
import { HACKER_NEWS_BACKGROUND_REQUEST } from "@anywebmcp/site-hackernews/transport/protocol";

type RuntimeMessageSender = {
  origin?: string;
  url?: string;
  tab?: { url?: string };
};

type RuntimeApi = {
  onMessage: {
    addListener(listener: (
      message: unknown,
      sender: RuntimeMessageSender,
      sendResponse: (response: unknown) => void
    ) => boolean | void): void;
  };
};

declare const chrome: { runtime: RuntimeApi };

const hackerNewsDependencies = createHackerNewsWorkerDependencies(globalThis, error => {
  const detail = error instanceof Error
    ? `${error.name}: ${error.message}`
    : "Unknown worker error";
  console.warn(`Hacker News background request failed: ${detail}`);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object"
    || (message as { type?: unknown }).type !== HACKER_NEWS_BACKGROUND_REQUEST) {
    return undefined;
  }

  void handleHackerNewsBackgroundRequest(message, sender, hackerNewsDependencies)
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false, code: "network" }));
  return true;
});
