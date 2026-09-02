import {
  HACKER_NEWS_BACKGROUND_REQUEST,
  HACKER_NEWS_ORIGIN,
  HACKER_NEWS_PAGE_REQUEST,
  HACKER_NEWS_PAGE_RESPONSE,
  isHackerNewsPageRequest,
  isHackerNewsTransportResult
} from "@anywebmcp/site-hackernews/transport/protocol";

export type RuntimeApi = {
  sendMessage(message: unknown): Promise<unknown>;
};

type BridgeWindow = Pick<Window, "addEventListener" | "removeEventListener" | "postMessage">;

function requestIdentity(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const request = value as { type?: unknown; requestId?: unknown };
  if (request.type !== HACKER_NEWS_PAGE_REQUEST
    || typeof request.requestId !== "string"
    || !/^[a-zA-Z0-9_-]{1,100}$/.test(request.requestId)) return undefined;
  return request.requestId;
}

export function installHackerNewsBridge(target: BridgeWindow, runtime: RuntimeApi) {
  const onMessage = (event: MessageEvent) => {
    if (event.source !== target || event.origin !== HACKER_NEWS_ORIGIN) return;
    const id = requestIdentity(event.data);
    if (!id) return;
    if (!isHackerNewsPageRequest(event.data)) {
      target.postMessage({
        type: HACKER_NEWS_PAGE_RESPONSE,
        requestId: id,
        ok: false,
        code: "invalid_request"
      }, HACKER_NEWS_ORIGIN);
      return;
    }

    const { type: _type, ...request } = event.data;
    void runtime.sendMessage({ type: HACKER_NEWS_BACKGROUND_REQUEST, ...request })
      .then(result => {
        const safeResult = isHackerNewsTransportResult(result)
          ? result
          : { ok: false as const, code: "malformed_response" as const };
        target.postMessage({
          type: HACKER_NEWS_PAGE_RESPONSE,
          requestId: id,
          ...safeResult
        }, HACKER_NEWS_ORIGIN);
      })
      .catch(() => {
        target.postMessage({
          type: HACKER_NEWS_PAGE_RESPONSE,
          requestId: id,
          ok: false,
          code: "transport_unavailable"
        }, HACKER_NEWS_ORIGIN);
      });
  };

  target.addEventListener("message", onMessage as EventListener);
  return () => target.removeEventListener("message", onMessage as EventListener);
}
