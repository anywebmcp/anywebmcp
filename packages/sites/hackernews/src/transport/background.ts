import type { AlgoliaItem, AlgoliaSearchResponse, FirebaseItem } from "../api/types";
import {
  HACKER_NEWS_ORIGIN,
  isHackerNewsBackgroundRequest,
  type HackerNewsBackgroundRequest,
  type HackerNewsTransportResult
} from "./protocol";

const FIREBASE_BASE_URL = "https://hacker-news.firebaseio.com/v0";
const ALGOLIA_BASE_URL = "https://hn.algolia.com/api/v1";
export const HACKER_NEWS_REQUEST_TIMEOUT_MS = 20_000;
export const HACKER_NEWS_MAX_RESPONSE_BYTES = 20 * 1024 * 1024;

export type HackerNewsMessageSender = {
  origin?: string;
  url?: string;
  tab?: { url?: string };
};

export type HackerNewsBackgroundDependencies = {
  fetch: typeof fetch;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
  timeoutMs?: number;
  maxResponseBytes?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFirebaseItem(value: unknown): value is FirebaseItem | null {
  return value === null || (isRecord(value) && Number.isInteger(value.id));
}

function isAlgoliaHit(value: unknown) {
  return isRecord(value) && typeof value.objectID === "string";
}

function isAlgoliaSearchResponse(value: unknown): value is AlgoliaSearchResponse {
  return isRecord(value)
    && Array.isArray(value.hits)
    && value.hits.every(isAlgoliaHit)
    && typeof value.nbHits === "number"
    && Number.isFinite(value.nbHits);
}

function isAlgoliaItem(value: unknown): value is AlgoliaItem {
  return isRecord(value)
    && Number.isInteger(value.id)
    && (value.children === undefined
      || (Array.isArray(value.children) && value.children.every(isAlgoliaItem)));
}

function senderHasHackerNewsOrigin(sender: HackerNewsMessageSender) {
  const candidate = sender.url ?? sender.origin ?? sender.tab?.url;
  if (!candidate) return false;
  try {
    return new URL(candidate).origin === HACKER_NEWS_ORIGIN;
  } catch {
    return false;
  }
}

function requestUrl(request: HackerNewsBackgroundRequest) {
  if (request.operation === "algoliaItem") {
    return `${ALGOLIA_BASE_URL}/items/${request.parameters.id}`;
  }
  if (request.operation === "firebaseItem") {
    return `${FIREBASE_BASE_URL}/item/${request.parameters.id}.json`;
  }
  if (request.operation === "algoliaSearch") {
    const parameters = request.parameters;
    const query = new URLSearchParams({
      query: parameters.query,
      tags: parameters.tag,
      numericFilters: `created_at_i>=${parameters.from},created_at_i<${parameters.to}`,
      hitsPerPage: String(parameters.hitsPerPage),
      page: String(parameters.page)
    });
    const endpoint = parameters.sort === "date" ? "search_by_date" : "search";
    return `${ALGOLIA_BASE_URL}/${endpoint}?${query}`;
  }
  return undefined;
}

async function readBoundedResponse(response: Response, maximumBytes: number) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) throw new Error("response_too_large");
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maximumBytes) throw new Error("response_too_large");
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximumBytes) {
      await reader.cancel();
      throw new Error("response_too_large");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function responseIsExpected(request: HackerNewsBackgroundRequest, value: unknown) {
  if (request.operation === "algoliaSearch") return isAlgoliaSearchResponse(value);
  if (request.operation === "algoliaItem") return value === null || isAlgoliaItem(value);
  if (request.operation === "firebaseItem") return isFirebaseItem(value);
  return request.operation === "probe";
}

export async function handleHackerNewsBackgroundRequest(
  message: unknown,
  sender: HackerNewsMessageSender,
  dependencies: HackerNewsBackgroundDependencies
): Promise<HackerNewsTransportResult> {
  if (!senderHasHackerNewsOrigin(sender) || !isHackerNewsBackgroundRequest(message)) {
    return { ok: false, code: "invalid_request" };
  }
  if (message.operation === "probe") return { ok: true, value: null };

  const url = requestUrl(message);
  if (!url) return { ok: false, code: "invalid_request" };
  const controller = new AbortController();
  const setTimer = dependencies.setTimeout ?? globalThis.setTimeout;
  const clearTimer = dependencies.clearTimeout ?? globalThis.clearTimeout;
  const timer = setTimer.call(
    globalThis,
    () => controller.abort(),
    dependencies.timeoutMs ?? HACKER_NEWS_REQUEST_TIMEOUT_MS
  );

  try {
    const response = await dependencies.fetch.call(globalThis, url, {
      method: "GET",
      headers: { accept: "application/json" },
      credentials: "omit",
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) return { ok: false, code: "http" };
    let value: unknown;
    try {
      value = JSON.parse(await readBoundedResponse(
        response,
        dependencies.maxResponseBytes ?? HACKER_NEWS_MAX_RESPONSE_BYTES
      ));
    } catch {
      return { ok: false, code: "malformed_response" };
    }
    if (!responseIsExpected(message, value)) return { ok: false, code: "malformed_response" };
    return { ok: true, value };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, code: "timeout" };
    return { ok: false, code: "network" };
  } finally {
    clearTimer.call(globalThis, timer);
  }
}
