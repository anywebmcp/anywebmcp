export const HACKER_NEWS_ORIGIN = "https://news.ycombinator.com";
export const HACKER_NEWS_PAGE_REQUEST = "anywebmcp:hackernews:page-request";
export const HACKER_NEWS_PAGE_RESPONSE = "anywebmcp:hackernews:page-response";
export const HACKER_NEWS_BACKGROUND_REQUEST = "anywebmcp:hackernews:background-request";

export type AlgoliaSearchParameters = {
  query: string;
  tag: "story" | "comment";
  from: number;
  to: number;
  hitsPerPage: number;
  page: number;
  sort: "relevance" | "date";
};

export type HackerNewsOperation =
  | { operation: "algoliaSearch"; parameters: AlgoliaSearchParameters }
  | { operation: "algoliaItem"; parameters: { id: number } }
  | { operation: "firebaseItem"; parameters: { id: number } };

export type HackerNewsPageOperation = HackerNewsOperation | {
  operation: "probe";
  parameters: Record<string, never>;
};

export type HackerNewsTransportErrorCode =
  | "http"
  | "invalid_request"
  | "malformed_response"
  | "network"
  | "timeout"
  | "transport_unavailable";

export type HackerNewsTransportResult =
  | { ok: true; value: unknown }
  | { ok: false; code: HackerNewsTransportErrorCode };

export type HackerNewsPageRequest = HackerNewsPageOperation & {
  type: typeof HACKER_NEWS_PAGE_REQUEST;
  requestId: string;
};

export type HackerNewsPageResponse = HackerNewsTransportResult & {
  type: typeof HACKER_NEWS_PAGE_RESPONSE;
  requestId: string;
};

export type HackerNewsBackgroundRequest = HackerNewsPageOperation & {
  type: typeof HACKER_NEWS_BACKGROUND_REQUEST;
  requestId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]) {
  const allowed = new Set(keys);
  return Object.keys(value).every(key => allowed.has(key));
}

function isRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}

function isSafeIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function isItemParameters(value: unknown): value is { id: number } {
  return isRecord(value)
    && hasOnlyKeys(value, ["id"])
    && isSafeIntegerInRange(value.id, 1, Number.MAX_SAFE_INTEGER);
}

function isSearchParameters(value: unknown): value is AlgoliaSearchParameters {
  return isRecord(value)
    && hasOnlyKeys(value, ["query", "tag", "from", "to", "hitsPerPage", "page", "sort"])
    && typeof value.query === "string"
    && value.query.length >= 1
    && value.query.length <= 200
    && (value.tag === "story" || value.tag === "comment")
    && isSafeIntegerInRange(value.from, 0, Number.MAX_SAFE_INTEGER)
    && isSafeIntegerInRange(value.to, 1, Number.MAX_SAFE_INTEGER)
    && value.from < value.to
    && isSafeIntegerInRange(value.hitsPerPage, 0, 100)
    && isSafeIntegerInRange(value.page, 0, 50)
    && (value.sort === "relevance" || value.sort === "date");
}

function isOperation(value: Record<string, unknown>, allowProbe: boolean): value is Record<string, unknown> & HackerNewsPageOperation {
  if (!hasOnlyKeys(value, ["type", "requestId", "operation", "parameters"])) return false;
  if (value.operation === "probe") {
    return allowProbe && isRecord(value.parameters) && Object.keys(value.parameters).length === 0;
  }
  if (value.operation === "algoliaSearch") return isSearchParameters(value.parameters);
  if (value.operation === "algoliaItem" || value.operation === "firebaseItem") {
    return isItemParameters(value.parameters);
  }
  return false;
}

export function isHackerNewsPageRequest(value: unknown): value is HackerNewsPageRequest {
  return isRecord(value)
    && value.type === HACKER_NEWS_PAGE_REQUEST
    && isRequestId(value.requestId)
    && isOperation(value, true);
}

export function isHackerNewsBackgroundRequest(value: unknown): value is HackerNewsBackgroundRequest {
  return isRecord(value)
    && value.type === HACKER_NEWS_BACKGROUND_REQUEST
    && isRequestId(value.requestId)
    && isOperation(value, true);
}

export function isHackerNewsTransportResult(value: unknown): value is HackerNewsTransportResult {
  if (!isRecord(value) || typeof value.ok !== "boolean") return false;
  if (value.ok) return hasOnlyKeys(value, ["ok", "value"]);
  return hasOnlyKeys(value, ["ok", "code"])
    && [
      "http",
      "invalid_request",
      "malformed_response",
      "network",
      "timeout",
      "transport_unavailable"
    ].includes(String(value.code));
}

export function isHackerNewsPageResponse(value: unknown): value is HackerNewsPageResponse {
  if (!isRecord(value)
    || value.type !== HACKER_NEWS_PAGE_RESPONSE
    || !isRequestId(value.requestId)) return false;
  if (value.ok === true) {
    return hasOnlyKeys(value, ["type", "requestId", "ok", "value"]);
  }
  return value.ok === false
    && hasOnlyKeys(value, ["type", "requestId", "ok", "code"])
    && isHackerNewsTransportResult({ ok: value.ok, code: value.code });
}
